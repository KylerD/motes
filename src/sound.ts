// sound.ts — Generative audio engine. Note-trigger architecture.
// Clusters trigger discrete envelope-driven notes. Motes chirp individually.
// Weather sounds are audible. Phase arc is dramatic.

import type { Mote, SoundEngine, Weather } from "./types";
import { findClusters } from "./physics";
import { W, H } from "./config";

// Re-export for backward compatibility
export type { SoundEngine };

/** Scale degrees by phase */
const PHASE_SCALES: number[][] = [
  [0, 3, 7, 10, 14, 19, 22],              // genesis: pentatonic minor
  [0, 2, 4, 7, 9, 12, 14, 16],            // exploration: major pentatonic
  [0, 2, 3, 5, 7, 8, 10, 12, 14, 15],     // organization: natural minor
  [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24], // complexity: chromatic
  [0, 3, 5, 7, 10, 12, 15],               // dissolution: pentatonic minor
  [0, 7, 12],                              // silence: root + fifth
];

const BASE_FREQ = 130.81;

function semitonesToFreq(semitones: number): number {
  return BASE_FREQ * Math.pow(2, semitones / 12);
}

function mapToScale(value: number, scale: number[]): number {
  const idx = Math.floor(value * scale.length) % scale.length;
  return semitonesToFreq(scale[idx]);
}

const MAX_VOICES = 8;

// Per-voice note scheduling state
interface VoiceSlot {
  lastNoteTime: number;
  noteInterval: number;
}

// Module-level state for note scheduling (not serializable, not in types)
const voiceSlots: VoiceSlot[] = [];
for (let i = 0; i < MAX_VOICES; i++) {
  voiceSlots.push({ lastNoteTime: 0, noteInterval: 2 });
}
let lastChirpTime = 0;

export function createSoundEngine(): SoundEngine {
  return {
    ctx: null!,
    voices: [],
    masterGain: null!,
    reverb: null!,
    compressor: null!,
    initialized: false,
    weatherAmbient: {
      rainSource: null, rainGain: null, rainFilter: null,
      windSource: null, windGain: null, windFilter: null,
      currentType: null, thunderCooldown: 0,
    },
  };
}

export function initAudio(engine: SoundEngine): void {
  if (engine.initialized) return;

  const ctx = new AudioContext();
  engine.ctx = ctx;

  engine.compressor = ctx.createDynamicsCompressor();
  engine.compressor.threshold.value = -15;
  engine.compressor.knee.value = 6;
  engine.compressor.ratio.value = 3;

  engine.masterGain = ctx.createGain();
  engine.masterGain.gain.value = 0.20;

  engine.reverb = createReverb(ctx);

  // Dry path: compressor → master
  engine.compressor.connect(engine.masterGain);
  // Wet path: compressor → reverb → master
  engine.compressor.connect(engine.reverb);
  engine.reverb.connect(engine.masterGain);
  engine.masterGain.connect(ctx.destination);

  // No permanent oscillators — notes are triggered on demand

  engine.initialized = true;
}

function createReverb(ctx: AudioContext): ConvolverNode {
  const conv = ctx.createConvolver();
  const len = ctx.sampleRate * 2;
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
  }
  conv.buffer = impulse;
  return conv;
}

/** Trigger a single envelope-driven note */
function triggerNote(
  engine: SoundEngine,
  freq: number,
  waveform: OscillatorType,
  gain: number,
  decay: number,
  filterFreq: number,
  detuneCents = 0,
): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = waveform;
  osc.frequency.value = freq;
  osc.detune.value = detuneCents;

  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.5;

  // ADSR: 20ms attack, sustain at peak, then decay
  const attack = 0.02;
  const sustainTime = Math.min(0.05, decay * 0.15);
  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.linearRampToValueAtTime(gain, now + attack);
  gainNode.gain.setValueAtTime(gain, now + attack + sustainTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + attack + sustainTime + decay);

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(engine.compressor);
  osc.start(now);
  osc.stop(now + attack + sustainTime + decay + 0.05);
}

/** Phase-dependent parameters for note scheduling */
interface PhaseAudioParams {
  volume: number;       // master gain
  noteIntervalScale: number; // multiplier on note intervals (lower = more notes)
  decay: number;        // note decay time
  filterFreq: number;   // lowpass filter cutoff
  chirpRate: number;    // probability of mote chirp per update
}

const PHASE_AUDIO: PhaseAudioParams[] = [
  // genesis: sparse, long tails, quiet
  { volume: 0.08, noteIntervalScale: 3.0, decay: 1.2, filterFreq: 600, chirpRate: 0.02 },
  // exploration: more frequent, brighter
  { volume: 0.15, noteIntervalScale: 1.5, decay: 0.6, filterFreq: 1200, chirpRate: 0.06 },
  // organization: medium density, warm
  { volume: 0.20, noteIntervalScale: 1.0, decay: 0.4, filterFreq: 1600, chirpRate: 0.08 },
  // complexity: peak density, richest
  { volume: 0.25, noteIntervalScale: 0.6, decay: 0.3, filterFreq: 2400, chirpRate: 0.12 },
  // dissolution: slowing, longer decay, melancholy
  { volume: 0.14, noteIntervalScale: 2.0, decay: 0.8, filterFreq: 800, chirpRate: 0.04 },
  // silence: rare notes, huge reverb
  { volume: 0.04, noteIntervalScale: 8.0, decay: 2.0, filterFreq: 400, chirpRate: 0.01 },
];

export function updateSound(
  engine: SoundEngine,
  motes: Mote[],
  phaseIndex: number,
  phaseProgress: number,
): void {
  if (!engine.initialized) return;

  const now = engine.ctx.currentTime;
  const pa = PHASE_AUDIO[phaseIndex];
  const nextPa = PHASE_AUDIO[(phaseIndex + 1) % 6];

  // Interpolate phase volume
  const targetVol = pa.volume * (1 - phaseProgress) + nextPa.volume * phaseProgress;
  engine.masterGain.gain.linearRampToValueAtTime(targetVol, now + 0.5);

  const scale = PHASE_SCALES[phaseIndex];
  const decay = pa.decay * (1 - phaseProgress) + nextPa.decay * phaseProgress;
  const filterFreq = pa.filterFreq * (1 - phaseProgress) + nextPa.filterFreq * phaseProgress;

  // Clusters → triggered notes
  const clusters = findClusters(motes);
  clusters.sort((a, b) => b.length - a.length);
  const active = clusters.slice(0, MAX_VOICES);

  for (let i = 0; i < MAX_VOICES; i++) {
    const slot = voiceSlots[i];

    if (i < active.length) {
      const cluster = active[i];
      let cx = 0, cy = 0, totalEnergy = 0;
      for (const m of cluster) {
        cx += m.x; cy += m.y; totalEnergy += m.energy;
      }
      cx /= cluster.length;
      cy /= cluster.length;
      totalEnergy /= cluster.length;

      // Note interval based on cluster size and phase
      const baseInterval = cluster.length < 4 ? 2.0 : cluster.length < 7 ? 0.8 : 0.3;
      slot.noteInterval = baseInterval * pa.noteIntervalScale;

      // Time to trigger a note?
      if (now - slot.lastNoteTime >= slot.noteInterval) {
        slot.lastNoteTime = now;

        const yNorm = 1 - cy / H;
        const freq = mapToScale(yNorm, scale);
        const waveform: OscillatorType = cluster.length < 4 ? "sine" : cluster.length < 7 ? "triangle" : "sawtooth";
        const noteGain = Math.log2(cluster.length + 1) / Math.log2(MAX_VOICES + 1) * totalEnergy * 0.15;
        const detune = (cx / W - 0.5) * 20;

        triggerNote(engine, freq, waveform, noteGain, decay, filterFreq, detune);
      }
    } else {
      slot.lastNoteTime = 0; // reset so next cluster starts immediately
    }
  }

  // Individual mote chirps — temperament-varied
  const chirpRate = pa.chirpRate * (1 - phaseProgress) + nextPa.chirpRate * phaseProgress;
  if (now - lastChirpTime > 0.15 && motes.length > 0 && Math.random() < chirpRate) {
    const m = motes[Math.floor(Math.random() * motes.length)];
    playChirp(engine, m, scale);
    lastChirpTime = now;
  }

  // Bond formation sounds
  for (const m of motes) {
    if (m.bondFlash > 0.9) {
      playBondForm(engine, 1 - m.y / H, scale);
      break;
    }
  }
}

/** Individual mote chirp — varies by temperament */
function playChirp(engine: SoundEngine, m: Mote, scale: number[]): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const yNorm = 1 - m.y / H;
  const baseFreq = mapToScale(yNorm, scale) * 2;

  // Waveform from temperament
  const waveform: OscillatorType =
    m.temperament.wanderlust > 0.6 ? "triangle" :
    m.temperament.hardiness > 0.6 ? "square" : "sine";

  if (m.temperament.wanderlust > 0.5) {
    // Ascending two-note chirp (bird-like)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = waveform;
    osc1.frequency.value = baseFreq;
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(m.energy * 0.10, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(engine.compressor);
    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = waveform;
    osc2.frequency.value = baseFreq * 1.25;
    gain2.gain.setValueAtTime(0.001, now + 0.06);
    gain2.gain.linearRampToValueAtTime(m.energy * 0.10, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc2.connect(gain2);
    gain2.connect(engine.compressor);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.22);
  } else if (m.temperament.hardiness > 0.5) {
    // Short percussive click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = baseFreq * 0.5;
    gain.gain.setValueAtTime(m.energy * 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(engine.compressor);
    osc.start(now);
    osc.stop(now + 0.08);
  } else {
    // Warm mid-range blip
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = baseFreq;
    osc.detune.value = (m.x / W - 0.5) * 30;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(m.energy * 0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(engine.compressor);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

/** Two-note ascending chime on bond formation */
export function playBondForm(engine: SoundEngine, yNorm: number, scale: number[]): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const freq1 = mapToScale(yNorm, scale);
  const idx = Math.floor(yNorm * scale.length) % scale.length;
  const nextIdx = Math.min(idx + 1, scale.length - 1);
  const freq2 = semitonesToFreq(scale[nextIdx]);

  // First note — audible
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.value = freq1;
  gain1.gain.setValueAtTime(0.10, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc1.connect(gain1);
  gain1.connect(engine.compressor);
  osc1.start(now);
  osc1.stop(now + 0.6);

  // Second note, 60ms later
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.value = freq2;
  gain2.gain.setValueAtTime(0.001, now + 0.06);
  gain2.gain.linearRampToValueAtTime(0.10, now + 0.08);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc2.connect(gain2);
  gain2.connect(engine.compressor);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.6);
}

/** Audible mote death — melancholy descending tone */
export function playDeath(engine: SoundEngine, yNorm: number): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120 + yNorm * 60, now);
  osc.frequency.exponentialRampToValueAtTime(60 + yNorm * 20, now + 0.6);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(gain);
  gain.connect(engine.compressor);
  osc.start(now);
  osc.stop(now + 0.7);
}

/** Different sound per event type */
export function playEventSound(engine: SoundEngine, eventType: string): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  switch (eventType) {
    case "meteor": {
      const bufferSize = Math.floor(ctx.sampleRate * 0.6);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      src.start(now);
      src.stop(now + 0.6);
      break;
    }
    case "flood": {
      const bufferSize = Math.floor(ctx.sampleRate * 1.5);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2000, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + 1.5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      src.start(now);
      src.stop(now + 1.5);
      break;
    }
    case "bloom": {
      const root = BASE_FREQ * 2;
      const freqs = [root, root * Math.pow(2, 4 / 12), root * Math.pow(2, 7 / 12)];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.10, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(now);
        osc.stop(now + 1.6);
      }
      break;
    }
    case "earthquake": {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 50;
      filter.type = "lowpass";
      filter.frequency.value = 100;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      osc.start(now);
      osc.stop(now + 0.8);
      break;
    }
    case "plague": {
      const freqs = [200, 213, 227];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(now);
        osc.stop(now + 0.6);
      }
      break;
    }
    case "aurora": {
      const freqs = [BASE_FREQ, BASE_FREQ * Math.pow(2, 7 / 12), BASE_FREQ * 2];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.10, now + 1);
        gain.gain.linearRampToValueAtTime(0.10, now + 1.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4.5);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(now);
        osc.stop(now + 5);
      }
      break;
    }
    case "drought": {
      engine.masterGain.gain.linearRampToValueAtTime(
        engine.masterGain.gain.value * 0.4, now + 0.1,
      );
      engine.masterGain.gain.linearRampToValueAtTime(
        engine.masterGain.gain.value, now + 2,
      );
      break;
    }
    case "migration": {
      const scale = PHASE_SCALES[1];
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const idx = Math.min(2 + i * 2, scale.length - 1);
        osc.frequency.value = semitonesToFreq(scale[idx]);
        const t = now + i * 0.1;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(t);
        osc.stop(t + 0.4);
      }
      break;
    }
    case "eclipse": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = BASE_FREQ / 2;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.5);
      gain.gain.linearRampToValueAtTime(0.08, now + 2.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 4);
      osc.connect(gain);
      gain.connect(engine.compressor);
      osc.start(now);
      osc.stop(now + 4.5);
      break;
    }
  }
}

/** Create a looping noise buffer source */
function createNoiseSource(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const len = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = Math.random() * 2 - 1;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/** Update ambient weather sounds — audible rain, wind, thunder */
export function updateWeatherSound(engine: SoundEngine, weather: Weather): void {
  if (!engine.initialized) return;

  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const amb = engine.weatherAmbient;
  const needsRain = weather.type === "rain" || weather.type === "storm";
  const needsWind = weather.type === "storm" || weather.type === "snow" || weather.type === "overcast";

  if (amb.currentType !== weather.type) {
    if (amb.rainGain) amb.rainGain.gain.linearRampToValueAtTime(0, now + 1);
    if (amb.windGain) amb.windGain.gain.linearRampToValueAtTime(0, now + 1);
    if (amb.rainSource) { try { amb.rainSource.stop(now + 1.1); } catch (_) { /* ignore */ } }
    if (amb.windSource) { try { amb.windSource.stop(now + 1.1); } catch (_) { /* ignore */ } }
    amb.rainSource = null; amb.rainGain = null; amb.rainFilter = null;
    amb.windSource = null; amb.windGain = null; amb.windFilter = null;

    // Rain ambient — louder, textured
    if (needsRain) {
      const src = createNoiseSource(ctx, 2);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = weather.type === "storm" ? 1000 : 3000;
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      const targetVol = weather.type === "storm"
        ? 0.10 + weather.intensity * 0.12
        : 0.06 + weather.intensity * 0.08;
      gain.gain.linearRampToValueAtTime(targetVol, now + 2);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.masterGain);
      src.start(now);
      amb.rainSource = src;
      amb.rainGain = gain;
      amb.rainFilter = filter;
    }

    // Wind ambient — audible gusts
    if (needsWind) {
      const src = createNoiseSource(ctx, 3);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      const targetVol = weather.type === "storm"
        ? 0.08 + weather.intensity * 0.08
        : 0.04 + weather.intensity * 0.04;
      gain.gain.linearRampToValueAtTime(targetVol, now + 2);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.masterGain);
      src.start(now);
      amb.windSource = src;
      amb.windGain = gain;
      amb.windFilter = filter;
    }

    amb.currentType = weather.type;
  }

  // Rain filter sweep for texture
  if (amb.rainFilter && needsRain) {
    const sweep = Math.sin(now * 0.3) * 800 + (weather.type === "storm" ? 1500 : 3000);
    amb.rainFilter.frequency.linearRampToValueAtTime(sweep, now + 0.1);
  }

  // Wind gusts — deeper modulation
  if (amb.windGain && needsWind) {
    const gustBase = weather.type === "storm" ? 0.10 : 0.05;
    const gustSwing = weather.type === "storm" ? 0.06 : 0.03;
    const gust = gustBase + Math.sin(now * 0.6) * gustSwing + Math.sin(now * 1.7) * gustSwing * 0.5;
    amb.windGain.gain.linearRampToValueAtTime(Math.max(0, gust), now + 0.1);
  }

  // Thunder during storms — startling
  if (weather.type === "storm" && weather.lightning.active) {
    amb.thunderCooldown -= 0.067;
    if (amb.thunderCooldown <= 0) {
      playThunder(engine, weather.lightning.brightness);
      amb.thunderCooldown = 10 + Math.random() * 20;
    }
  }
}

/** Thunder — loud and startling */
function playThunder(engine: SoundEngine, intensity: number): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const len = Math.floor(ctx.sampleRate * 1.5);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 150;
  const gain = ctx.createGain();
  const vol = 0.15 + intensity * 0.10;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(engine.compressor);
  src.start(now);
  src.stop(now + 1.5);
}
