// sound.ts — Generative audio engine. The world's voice.
// Cluster positions → tones. Phase → harmony. Pure Web Audio synthesis.

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
  engine.compressor.threshold.value = -18;
  engine.compressor.knee.value = 8;
  engine.compressor.ratio.value = 4;

  engine.masterGain = ctx.createGain();
  engine.masterGain.gain.value = 0.12;

  engine.reverb = createReverb(ctx);

  engine.compressor.connect(engine.masterGain);
  engine.compressor.connect(engine.reverb);
  engine.reverb.connect(engine.masterGain);
  engine.masterGain.connect(ctx.destination);

  for (let i = 0; i < MAX_VOICES; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.value = 220;
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.Q.value = 1;
    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(engine.compressor);
    osc.start();

    engine.voices.push({
      osc, gain, filter,
      active: false, targetFreq: 220, targetGain: 0, targetFilterFreq: 800,
    });
  }

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

export function updateSound(
  engine: SoundEngine,
  motes: Mote[],
  phaseIndex: number,
  phaseProgress: number,
): void {
  if (!engine.initialized) return;

  const scale = PHASE_SCALES[phaseIndex];
  const now = engine.ctx.currentTime;

  // Phase volume
  const phaseVols = [0.06, 0.10, 0.14, 0.16, 0.08, 0.02];
  const next = (phaseIndex + 1) % 6;
  const targetVol = phaseVols[phaseIndex] * (1 - phaseProgress) + phaseVols[next] * phaseProgress;
  engine.masterGain.gain.linearRampToValueAtTime(targetVol, now + 0.5);

  // Clusters → voices
  const clusters = findClusters(motes);
  clusters.sort((a, b) => b.length - a.length);
  const active = clusters.slice(0, MAX_VOICES);

  for (let i = 0; i < MAX_VOICES; i++) {
    const voice = engine.voices[i];

    if (i < active.length) {
      const cluster = active[i];
      let cx = 0, cy = 0, totalEnergy = 0;
      for (const m of cluster) {
        cx += m.x; cy += m.y; totalEnergy += m.energy;
      }
      cx /= cluster.length;
      cy /= cluster.length;
      totalEnergy /= cluster.length;

      const yNorm = 1 - cy / H;
      voice.targetFreq = mapToScale(yNorm, scale);
      voice.targetGain = Math.log2(cluster.length + 1) / Math.log2(MAX_VOICES + 1) * totalEnergy * 0.35;
      voice.targetFilterFreq = 200 + totalEnergy * 1800;

      voice.osc.type = cluster.length < 4 ? "sine" : cluster.length < 7 ? "triangle" : "sawtooth";
      voice.osc.detune.linearRampToValueAtTime((cx / W - 0.5) * 20, now + 0.1);
      voice.active = true;
    } else {
      voice.targetGain = 0;
      voice.active = false;
    }

    voice.osc.frequency.linearRampToValueAtTime(voice.targetFreq, now + 0.3);
    voice.gain.gain.linearRampToValueAtTime(voice.targetGain, now + (voice.active ? 0.3 : 1.5));
    voice.filter.frequency.linearRampToValueAtTime(voice.targetFilterFreq, now + 0.2);
  }

  // Lone mote pings
  const loners = motes.filter((m) => m.bonds.length === 0);
  if (loners.length > 0 && Math.random() < 0.04) {
    const m = loners[Math.floor(Math.random() * loners.length)];
    ping(engine, m.x / W, 1 - m.y / H, m.energy, scale);
  }

  // Bond formation sounds
  for (const m of motes) {
    if (m.bondFlash > 0.9) { // just formed
      playBondForm(engine, 1 - m.y / H, scale);
      break; // max 1 bond sound per update
    }
  }
}

/** Two-note ascending chime on bond formation */
export function playBondForm(engine: SoundEngine, yNorm: number, scale: number[]): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const freq1 = mapToScale(yNorm, scale);
  // Next scale step up
  const idx = Math.floor(yNorm * scale.length) % scale.length;
  const nextIdx = Math.min(idx + 1, scale.length - 1);
  const freq2 = semitonesToFreq(scale[nextIdx]);

  // First note
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.value = freq1;
  gain1.gain.setValueAtTime(0.03, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc1.connect(gain1);
  gain1.connect(engine.compressor);
  osc1.start(now);
  osc1.stop(now + 0.5);

  // Second note, 50ms later
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.value = freq2;
  gain2.gain.setValueAtTime(0.001, now + 0.05);
  gain2.gain.linearRampToValueAtTime(0.03, now + 0.06);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc2.connect(gain2);
  gain2.connect(engine.compressor);
  osc2.start(now + 0.05);
  osc2.stop(now + 0.5);
}

/** Low sine tone on mote death */
export function playDeath(engine: SoundEngine, yNorm: number): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 80 + yNorm * 40; // 80-120Hz
  gain.gain.setValueAtTime(0.02, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain);
  gain.connect(engine.compressor);
  osc.start(now);
  osc.stop(now + 0.4);
}

/** Different sound per event type */
export function playEventSound(engine: SoundEngine, eventType: string): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  switch (eventType) {
    case "meteor": {
      // Noise burst through lowpass filter
      const bufferSize = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 150;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      src.start(now);
      src.stop(now + 0.5);
      break;
    }
    case "flood": {
      // White noise with bandpass sweep
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
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      src.start(now);
      src.stop(now + 1.5);
      break;
    }
    case "bloom": {
      // Bright chord: root, major third, fifth
      const root = BASE_FREQ * 2;
      const freqs = [root, root * Math.pow(2, 4 / 12), root * Math.pow(2, 7 / 12)];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(now);
        osc.stop(now + 1.4);
      }
      break;
    }
    case "earthquake": {
      // Low sawtooth through lowpass
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 50;
      filter.type = "lowpass";
      filter.frequency.value = 100;
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      osc.start(now);
      osc.stop(now + 0.7);
      break;
    }
    case "plague": {
      // 3 detuned sines (dissonant cluster)
      const freqs = [200, 213, 227];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(now);
        osc.stop(now + 0.5);
      }
      break;
    }
    case "aurora": {
      // Ethereal chord: root, fifth, octave
      const freqs = [BASE_FREQ, BASE_FREQ * Math.pow(2, 7 / 12), BASE_FREQ * 2];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 1);
        gain.gain.linearRampToValueAtTime(0.05, now + 1.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4.5);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(now);
        osc.stop(now + 5);
      }
      break;
    }
    case "drought": {
      // Duck master gain to 50% then restore over 2s
      engine.masterGain.gain.linearRampToValueAtTime(
        engine.masterGain.gain.value * 0.5, now + 0.1,
      );
      engine.masterGain.gain.linearRampToValueAtTime(
        engine.masterGain.gain.value, now + 2,
      );
      break;
    }
    case "migration": {
      // Quick ascending arpeggio — 3 notes 100ms apart
      const scale = PHASE_SCALES[1]; // use exploration scale
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const idx = Math.min(2 + i * 2, scale.length - 1);
        osc.frequency.value = semitonesToFreq(scale[idx]);
        const t = now + i * 0.1;
        gain.gain.setValueAtTime(0.03, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(t);
        osc.stop(t + 0.4);
      }
      break;
    }
    case "eclipse": {
      // Low drone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = BASE_FREQ / 2;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.5);
      gain.gain.linearRampToValueAtTime(0.04, now + 2.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 4);
      osc.connect(gain);
      gain.connect(engine.compressor);
      osc.start(now);
      osc.stop(now + 4.5);
      break;
    }
  }
}

function ping(
  engine: SoundEngine,
  xNorm: number, yNorm: number,
  energy: number, scale: number[],
): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = mapToScale(yNorm, scale) * 2;
  osc.detune.value = (xNorm - 0.5) * 15;

  gain.gain.setValueAtTime(energy * 0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(gain);
  gain.connect(engine.compressor);
  osc.start(now);
  osc.stop(now + 0.7);
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

/** Update ambient weather sounds — continuous rain, wind, thunder */
export function updateWeatherSound(engine: SoundEngine, weather: Weather): void {
  if (!engine.initialized) return;

  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const amb = engine.weatherAmbient;
  const needsRain = weather.type === "rain" || weather.type === "storm";
  const needsWind = weather.type === "storm" || weather.type === "snow" || weather.type === "overcast";

  // If weather type changed, rebuild ambient nodes
  if (amb.currentType !== weather.type) {
    // Fade out and stop old sources
    if (amb.rainGain) amb.rainGain.gain.linearRampToValueAtTime(0, now + 1);
    if (amb.windGain) amb.windGain.gain.linearRampToValueAtTime(0, now + 1);
    // Schedule stops after fade
    if (amb.rainSource) { try { amb.rainSource.stop(now + 1.1); } catch (_) { /* ignore */ } }
    if (amb.windSource) { try { amb.windSource.stop(now + 1.1); } catch (_) { /* ignore */ } }
    amb.rainSource = null; amb.rainGain = null; amb.rainFilter = null;
    amb.windSource = null; amb.windGain = null; amb.windFilter = null;

    // Start rain ambient
    if (needsRain) {
      const src = createNoiseSource(ctx, 2);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = weather.type === "storm" ? 800 : 2500;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      const targetVol = weather.type === "storm"
        ? 0.04 + weather.intensity * 0.06
        : 0.02 + weather.intensity * 0.04;
      gain.gain.linearRampToValueAtTime(targetVol, now + 2);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.masterGain);
      src.start(now);
      amb.rainSource = src;
      amb.rainGain = gain;
      amb.rainFilter = filter;
    }

    // Start wind ambient
    if (needsWind) {
      const src = createNoiseSource(ctx, 3);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 300;
      filter.Q.value = 0.3;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      const targetVol = weather.type === "storm"
        ? 0.03 + weather.intensity * 0.04
        : 0.01 + weather.intensity * 0.02;
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

  // Modulate rain filter for variety
  if (amb.rainFilter && needsRain) {
    const sweep = Math.sin(now * 0.2) * 500 + (weather.type === "storm" ? 1200 : 2500);
    amb.rainFilter.frequency.linearRampToValueAtTime(sweep, now + 0.1);
  }

  // Modulate wind for gusts
  if (amb.windGain && needsWind) {
    const gust = Math.sin(now * 0.4) * 0.01 + (weather.type === "storm" ? 0.05 : 0.02);
    amb.windGain.gain.linearRampToValueAtTime(Math.max(0, gust), now + 0.1);
  }

  // Thunder during storms (tied to lightning)
  if (weather.type === "storm" && weather.lightning.active) {
    amb.thunderCooldown -= 0.067; // ~15fps sound update interval
    if (amb.thunderCooldown <= 0) {
      playThunder(engine, weather.lightning.brightness);
      amb.thunderCooldown = 15 + Math.random() * 25; // rare rumbles
    }
  }
}

/** Low rumbling thunder */
function playThunder(engine: SoundEngine, intensity: number): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  // Noise burst through very low pass
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
  filter.frequency.value = 120;
  const gain = ctx.createGain();
  const vol = 0.06 + intensity * 0.06;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(engine.compressor);
  src.start(now);
  src.stop(now + 1.5);
}
