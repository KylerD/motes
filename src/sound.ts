// sound.ts — Generative audio engine. The world's voice.
// Cluster positions → tones. Phase → harmony. Pure Web Audio synthesis.

import { Mote } from "./mote";
import { findClusters } from "./physics";
import { W, H } from "./render";

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

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  active: boolean;
  targetFreq: number;
  targetGain: number;
  targetFilterFreq: number;
}

const MAX_VOICES = 8;

export interface SoundEngine {
  ctx: AudioContext;
  voices: Voice[];
  masterGain: GainNode;
  reverb: ConvolverNode;
  compressor: DynamicsCompressorNode;
  initialized: boolean;
}

export function createSoundEngine(): SoundEngine {
  return {
    ctx: null!,
    voices: [],
    masterGain: null!,
    reverb: null!,
    compressor: null!,
    initialized: false,
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
