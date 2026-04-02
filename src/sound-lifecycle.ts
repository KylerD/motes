// sound-lifecycle.ts — Bond formation, breaking, death, mourning, and cluster sounds.

import type { SoundEngine, Biome } from "./types";
import { BIOME_SOUND } from "./sound-config";
import type { BiomeSoundProfile } from "./sound-config";
import { getState } from "./sound-state";

/** Two-note ascending chime on bond formation — voiced per biome */
export function playBondForm(
  engine: SoundEngine,
  yNorm: number,
  scale: number[],
  profile?: BiomeSoundProfile,
): void {
  const p = profile ?? BIOME_SOUND.temperate;
  const biome = getState(engine).currentBiome ?? "temperate";
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const idx = Math.floor(yNorm * scale.length) % scale.length;
  const freq1 = p.rootFreq * Math.pow(2, scale[idx] / 12) * 2;
  const freq2 = freq1 * Math.pow(2, 7 / 12); // perfect fifth above

  // Per-biome bond voice: wave type, decay length, and gain
  interface BondVoice { wave: OscillatorType; decay1: number; decay2: number; g1: number; g2: number; }
  const bondVoice: Record<string, BondVoice> = {
    temperate: { wave: "sine",     decay1: 0.55, decay2: 0.65, g1: 0.032, g2: 0.025 },
    desert:    { wave: "sine",     decay1: 2.60, decay2: 2.80, g1: 0.028, g2: 0.018 }, // long bell toll
    tundra:    { wave: "sine",     decay1: 1.10, decay2: 1.70, g1: 0.030, g2: 0.022 }, // glassy, sustaining
    volcanic:  { wave: "triangle", decay1: 0.22, decay2: 0.18, g1: 0.020, g2: 0.014 }, // short, dull thud
    lush:      { wave: "sine",     decay1: 0.75, decay2: 0.95, g1: 0.034, g2: 0.027 }, // warm & full
  };
  const bv = bondVoice[biome] ?? bondVoice.temperate;

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = bv.wave;
  osc1.frequency.value = freq1;
  gain1.gain.setValueAtTime(0.001, now);
  gain1.gain.linearRampToValueAtTime(bv.g1, now + 0.02);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.02 + bv.decay1);
  osc1.connect(gain1);
  gain1.connect(engine.reverb);
  osc1.start(now);
  osc1.stop(now + 0.02 + bv.decay1 + 0.05);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = bv.wave;
  osc2.frequency.value = freq2;
  gain2.gain.setValueAtTime(0.001, now + 0.065);
  gain2.gain.linearRampToValueAtTime(bv.g2, now + 0.085);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.065 + bv.decay2);
  osc2.connect(gain2);
  gain2.connect(engine.reverb);
  osc2.start(now + 0.065);
  osc2.stop(now + 0.065 + bv.decay2 + 0.05);

  // Tundra: crystalline high partial — ice chime shimmer
  if (biome === "tundra") {
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.value = freq1 * 3.0; // 3rd harmonic
    gain3.gain.setValueAtTime(0.001, now);
    gain3.gain.linearRampToValueAtTime(0.010, now + 0.01);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc3.connect(gain3);
    gain3.connect(engine.reverb);
    osc3.start(now);
    osc3.stop(now + 0.92);
  }

  // Lush: add the major third so the bond lands as a full warm triad
  if (biome === "lush") {
    const freq3 = freq1 * Math.pow(2, 4 / 12);
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.value = freq3;
    gain3.gain.setValueAtTime(0.001, now + 0.12);
    gain3.gain.linearRampToValueAtTime(0.019, now + 0.14);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.14 + 0.70);
    osc3.connect(gain3);
    gain3.connect(engine.reverb);
    osc3.start(now + 0.12);
    osc3.stop(now + 0.12 + 0.76);
  }
}

/** Two tones falling apart on bond break — voiced per biome, mirror of playBondForm */
export function playBondBreak(
  engine: SoundEngine,
  yNorm: number,
  scale: number[],
  profile: BiomeSoundProfile,
): void {
  const biome = getState(engine).currentBiome ?? "temperate";
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const idx = Math.floor(yNorm * scale.length) % scale.length;
  const freq = profile.rootFreq * Math.pow(2, scale[idx] / 12) * 2;

  switch (biome) {
    case "desert": {
      // Single long descending bell toll — a note that rang, then faded alone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, -4 / 12), now + 3.5);
      gain.gain.setValueAtTime(0.018, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);
      osc.connect(gain);
      gain.connect(engine.reverb);
      osc.start(now);
      osc.stop(now + 4.0);
      // Faint 3rd harmonic shimmer fades quickly
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = freq * 3.0;
      gain2.gain.setValueAtTime(0.006, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(engine.reverb);
      osc2.start(now);
      osc2.stop(now + 1.0);
      // 5th harmonic: the overtone ringing alone in vast emptiness long after the bell is gone
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.value = freq * 5.0;
      gain3.gain.setValueAtTime(0.001, now + 0.35);
      gain3.gain.linearRampToValueAtTime(0.003, now + 0.60);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 5.8);
      osc3.connect(gain3);
      gain3.connect(engine.reverb);
      osc3.start(now + 0.35);
      osc3.stop(now + 6.0);
      break;
    }

    case "tundra": {
      // Two crystalline tones slide apart in opposite directions — cracking ice
      const high = freq * 2.0;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(high, now);
      osc1.frequency.exponentialRampToValueAtTime(high * Math.pow(2, 5 / 12), now + 0.8); // slides up
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.018, now + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      osc1.connect(gain1);
      gain1.connect(engine.reverb);
      osc1.start(now);
      osc1.stop(now + 1.7);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(high * Math.pow(2, 7 / 12), now);
      osc2.frequency.exponentialRampToValueAtTime(high * Math.pow(2, -2 / 12), now + 0.9); // slides down
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.linearRampToValueAtTime(0.014, now + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(engine.reverb);
      osc2.start(now);
      osc2.stop(now + 1.3);
      break;
    }

    case "volcanic": {
      // Sharp noise crack followed by a fast sub-bass drop — a bond shattering like cooling rock
      const bufLen = Math.floor(ctx.sampleRate * 0.08);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.15));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 900;
      filt.Q.value = 2.0;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.025, now);
      gn.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
      src.connect(filt);
      filt.connect(gn);
      gn.connect(engine.compressor);
      src.start(now);
      // Sub drop: a pitch falling off a cliff
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(80, now + 0.02);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.38);
      subGain.gain.setValueAtTime(0.030, now + 0.02);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      sub.connect(subGain);
      subGain.connect(engine.compressor);
      sub.start(now + 0.02);
      sub.stop(now + 0.45);
      break;
    }

    case "lush": {
      // Three voices that were in harmony drift apart — warm dissolution
      for (const [semi, delay, dur] of [[0, 0.0, 1.3], [4, 0.04, 1.0], [7, 0.02, 0.8]] as [number, number, number][]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * Math.pow(2, semi / 12), now + delay);
        osc.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, (semi - 2) / 12), now + delay + dur);
        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.linearRampToValueAtTime(0.016 - semi * 0.001, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        osc.connect(gain);
        gain.connect(engine.reverb);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.05);
      }
      break;
    }

    default: { // temperate — minor third downward glide, fifth drops below root
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, now);
      osc1.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, -3 / 12), now + 0.30);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.020, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(engine.reverb);
      osc1.start(now);
      osc1.stop(now + 0.40);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * Math.pow(2, 7 / 12), now + 0.03);
      osc2.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, -2 / 12), now + 0.26);
      gain2.gain.setValueAtTime(0.001, now + 0.03);
      gain2.gain.linearRampToValueAtTime(0.014, now + 0.055);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
      osc2.connect(gain2);
      gain2.connect(engine.reverb);
      osc2.start(now + 0.03);
      osc2.stop(now + 0.35);
      break;
    }
  }
}

/**
 * Ancient bond break — played when a bond older than 70s severs.
 * Much slower and deeper than the regular bond break. Two voices that shared
 * a long journey, now separating into silence. Biome-voiced, long decay.
 */
export function playAncientBondBreak(
  engine: SoundEngine,
  yNorm: number,
  profile: BiomeSoundProfile,
  biome: Biome,
): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  // Use a low octave — ancient bonds lived deep
  const baseFreq = profile.rootFreq * (1.0 + yNorm * 0.5);

  switch (biome) {
    case "desert": {
      // Two bell tones that were ringing in unison slowly drift a semitone apart,
      // then fall together into silence — a long parting in the vast open.
      const freq1 = baseFreq * 2;
      const freq2 = baseFreq * 2 * Math.pow(2, -1 / 12); // minor second below
      for (const [f, pan, vol] of [[freq1, -0.3, 0.022], [freq2, 0.3, 0.018]] as [number, number, number][]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * Math.pow(2, -5 / 12), now + 5.0);
        panner.pan.value = pan;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.setValueAtTime(vol * 0.9, now + 1.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 5.5);
        osc.connect(gain); gain.connect(panner); panner.connect(engine.reverb);
        osc.start(now); osc.stop(now + 6.0);
      }
      break;
    }

    case "tundra": {
      // Two crystalline tones that drifted together now slowly pull apart —
      // one rises, one falls, both fade into the frozen dark.
      const freq1 = baseFreq * 4;
      const osc1 = ctx.createOscillator(), gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(freq1, now);
      osc1.frequency.exponentialRampToValueAtTime(freq1 * Math.pow(2, 4 / 12), now + 4.5);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.018, now + 0.3);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 5.0);
      osc1.connect(gain1); gain1.connect(engine.reverb);
      osc1.start(now); osc1.stop(now + 5.5);

      const osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq1 * Math.pow(2, 7 / 12), now + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(freq1 * Math.pow(2, -3 / 12), now + 4.5);
      gain2.gain.setValueAtTime(0.001, now + 0.1);
      gain2.gain.linearRampToValueAtTime(0.016, now + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 4.8);
      osc2.connect(gain2); gain2.connect(engine.reverb);
      osc2.start(now + 0.1); osc2.stop(now + 5.0);
      break;
    }

    case "volcanic": {
      // A slow deep sine pulse — the earth groans once, long and low, as two forces part.
      // Subterranean, ominous, final.
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * Math.pow(2, -4 / 12), now + 4.5);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.030 * profile.masterMult, now + 0.8);
      gain.gain.setValueAtTime(0.030 * profile.masterMult, now + 2.0);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 5.0);
      osc.connect(gain); gain.connect(engine.reverb);
      osc.start(now); osc.stop(now + 5.5);
      // A faint second harmonic trails off faster
      const osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.value = baseFreq * 2;
      gain2.gain.setValueAtTime(0.010, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      osc2.connect(gain2); gain2.connect(engine.reverb);
      osc2.start(now); osc2.stop(now + 3.0);
      break;
    }

    case "lush": {
      // A warm minor-seventh chord (root + m3 + m7) swells and slowly dissolves —
      // abundance fading into stillness, like sunlight leaving a clearing.
      for (const [semi, vol, pan] of [[0, 0.018, 0], [3, 0.014, -0.35], [10, 0.012, 0.35]] as [number, number, number][]) {
        const osc = ctx.createOscillator(), gain = ctx.createGain(), panner = ctx.createStereoPanner();
        osc.type = "sine";
        osc.frequency.value = baseFreq * 2 * Math.pow(2, semi / 12);
        panner.pan.value = pan;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.5);
        gain.gain.setValueAtTime(vol, now + 2.0);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 5.5);
        osc.connect(gain); gain.connect(panner); panner.connect(engine.reverb);
        osc.start(now); osc.stop(now + 6.0);
      }
      break;
    }

    default: { // temperate — two sine waves a perfect fifth apart slowly fall together,
      // like two voices that shared a melody, now going quiet
      const freq1 = baseFreq * 2;
      const freq2 = freq1 * Math.pow(2, 7 / 12); // fifth above
      for (const [f, vol, pan] of [[freq1, 0.020, -0.25], [freq2, 0.016, 0.25]] as [number, number, number][]) {
        const osc = ctx.createOscillator(), gain = ctx.createGain(), panner = ctx.createStereoPanner();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * Math.pow(2, -3 / 12), now + 4.0);
        panner.pan.value = pan;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.4);
        gain.gain.setValueAtTime(vol, now + 1.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4.5);
        osc.connect(gain); gain.connect(panner); panner.connect(engine.reverb);
        osc.start(now); osc.stop(now + 5.0);
      }
      break;
    }
  }
}

/** Death sound — distinct per biome, loss made audible in each world's own voice */
export function playDeath(engine: SoundEngine, yNorm: number): void {
  if (!engine.initialized) return;
  const biome = getState(engine).currentBiome ?? "temperate";
  const p = BIOME_SOUND[biome];
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  switch (biome) {
    case "volcanic": {
      // Crack + low thud: a mote shatters like cooling lava
      const bufLen = Math.floor(ctx.sampleRate * 0.14);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.18));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 280;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.040, now);
      gn.gain.exponentialRampToValueAtTime(0.001, now + 0.50);
      src.connect(filt);
      filt.connect(gn);
      gn.connect(engine.compressor);
      src.start(now);
      // Sub-bass thud follows crack
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = "sine";
      thud.frequency.setValueAtTime(70, now + 0.02);
      thud.frequency.exponentialRampToValueAtTime(26, now + 0.38);
      thudGain.gain.setValueAtTime(0.038, now + 0.02);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      thud.connect(thudGain);
      thudGain.connect(engine.compressor);
      thud.start(now + 0.02);
      thud.stop(now + 0.45);
      break;
    }

    case "desert": {
      // Bell toll: long, reverberant, no glide — a note struck once in vast silence
      const freq = p.rootFreq * (2.0 + yNorm * 0.5);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.030, now);
      gain.gain.setValueAtTime(0.030, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
      osc.connect(gain);
      gain.connect(engine.reverb);
      osc.start(now);
      osc.stop(now + 3.4);
      // Faint 3rd harmonic — bell shimmer
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = freq * 3.0;
      gain2.gain.setValueAtTime(0.008, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc2.connect(gain2);
      gain2.connect(engine.reverb);
      osc2.start(now);
      osc2.stop(now + 1.6);
      break;
    }

    case "tundra": {
      // Ice crystal: brief high ping + crystalline reverb tail — cold and precise
      const freq = p.rootFreq * 4.0 * (1 + yNorm * 0.25);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.028, now);
      gain.gain.exponentialRampToValueAtTime(0.003, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.003, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
      osc.connect(gain);
      gain.connect(engine.reverb);
      osc.start(now);
      osc.stop(now + 2.4);
      // Second crystalline partial — very faint upper tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = freq * Math.pow(2, 5 / 12);
      gain2.gain.setValueAtTime(0.010, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc2.connect(gain2);
      gain2.connect(engine.reverb);
      osc2.start(now);
      osc2.stop(now + 1.7);
      break;
    }

    case "lush": {
      // Warm chord dissolve: root + 5th + octave softly collapsing — organic, bittersweet
      const baseFreq = p.rootFreq * (1.0 + yNorm * 0.55);
      for (const [semitones, vol, dur] of [[0, 0.022, 1.9], [7, 0.016, 1.6], [12, 0.011, 1.3]] as [number, number, number][]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = baseFreq * Math.pow(2, semitones / 12);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(engine.reverb);
        osc.start(now);
        osc.stop(now + dur + 0.1);
      }
      break;
    }

    default: { // temperate — descending sigh: two voices falling together, then gone
      const startFreq = p.rootFreq * (1 + yNorm * 0.6);
      const endFreq = startFreq * 0.63;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.9);
      gain.gain.setValueAtTime(0.022, now);
      gain.gain.setValueAtTime(0.022, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.connect(gain);
      gain.connect(engine.reverb);
      osc.start(now);
      osc.stop(now + 1.1);
      // Soft 5th following the descent — two voices parting
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(startFreq * Math.pow(2, 7 / 12), now);
      osc2.frequency.exponentialRampToValueAtTime(endFreq * Math.pow(2, 7 / 12), now + 0.7);
      gain2.gain.setValueAtTime(0.009, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc2.connect(gain2);
      gain2.connect(engine.reverb);
      osc2.start(now);
      osc2.stop(now + 0.80);
      break;
    }
  }
}

/** Cluster milestone — special sound when a cluster first reaches size 4 (harmony) or 8 (chorus) */
export function playClusterMilestone(engine: SoundEngine, scale: number[], profile: BiomeSoundProfile, size: number): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  if (size >= 8) {
    // Full chorus awakening — staggered maj7 chord spread wide across stereo
    const semitones = [0, 4, 7, 11, 14];
    semitones.forEach((semi, i) => {
      const freq = profile.rootFreq * Math.pow(2, semi / 12) * 2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      osc.type = profile.waveLarge;
      osc.frequency.value = freq;
      panner.pan.value = (i / (semitones.length - 1) * 2 - 1) * 0.88;
      const t = now + i * 0.058;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.024, t + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(engine.reverb);
      osc.start(t);
      osc.stop(t + 2.9);
    });
  } else {
    // Small cluster finding first harmony — two voices, a gentle major third arriving together
    const freq1 = profile.rootFreq * Math.pow(2, scale[0] / 12) * 2;
    const freq2 = freq1 * Math.pow(2, 4 / 12); // major third
    for (const [freq, delay] of [[freq1, 0.0], [freq2, 0.07]] as [number, number][]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = profile.waveSmall;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.016, now + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.25);
      osc.connect(gain);
      gain.connect(engine.reverb);
      osc.start(now + delay);
      osc.stop(now + delay + 1.35);
    }
  }
}

/** Cluster merge sound — two communities finding each other's resonance */
export function playClusterMerge(
  engine: SoundEngine,
  profile: BiomeSoundProfile,
  biome: Biome,
): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const rootFreq = profile.rootFreq * 2; // upper register — bright, spatial

  // Per-biome intervals and character: the emotional flavour of two groups becoming one
  interface MergeVoice {
    semitones: number[];
    wave: OscillatorType;
    spacing: number;
    decay: number;
    vol: number;
  }
  const mergeVoice: Record<Biome, MergeVoice> = {
    temperate: { semitones: [0, 4, 7],     wave: "sine",     spacing: 0.055, decay: 1.8, vol: 0.020 },
    desert:    { semitones: [0, 5, 9],     wave: "sine",     spacing: 0.090, decay: 3.2, vol: 0.015 }, // suspended — cautious union
    tundra:    { semitones: [0, 3, 7],     wave: "sine",     spacing: 0.075, decay: 2.4, vol: 0.013 }, // minor — cold solidarity
    volcanic:  { semitones: [0, 3, 6],     wave: "triangle", spacing: 0.038, decay: 0.9, vol: 0.017 }, // diminished — tense merger
    lush:      { semitones: [0, 4, 7, 11], wave: "sine",     spacing: 0.045, decay: 2.2, vol: 0.021 }, // maj7 — rich, full
  };
  const mv = mergeVoice[biome];

  for (let i = 0; i < mv.semitones.length; i++) {
    const freq = rootFreq * Math.pow(2, mv.semitones[i] / 12);
    const t = now + i * mv.spacing;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = mv.wave;
    osc.frequency.value = freq;
    panner.pan.value = ((i / Math.max(mv.semitones.length - 1, 1)) * 2 - 1) * profile.panStrength * 0.65;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(mv.vol, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + mv.decay);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(engine.reverb);
    osc.start(t);
    osc.stop(t + mv.decay + 0.1);
  }
}

/** Communal mourning chord — when motes grieve together, a shared low tone */
export function playMourningChorus(
  engine: SoundEngine,
  profile: BiomeSoundProfile,
  biome: Biome,
): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const baseFreq = profile.rootFreq; // low register — weight and gravity of collective loss

  // Minor triad (or biome variant) — collective sorrow voiced differently by each world
  const semitoneSets: Record<Biome, number[]> = {
    temperate: [0, 3, 7],      // natural minor triad
    desert:    [0, 3, 7],      // minor triad — hollowed-out grief
    tundra:    [0, 2, 7],      // open fifth + 2nd — suspended, unresolved cold
    volcanic:  [0, 3, 6],      // diminished — raw anguish
    lush:      [0, 3, 7, 10],  // minor 7th — warm, bittersweet
  };
  const semitones = semitoneSets[biome];

  for (let i = 0; i < semitones.length; i++) {
    const freq = baseFreq * Math.pow(2, semitones[i] / 12);
    const t = now + i * 0.05;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    // Very quiet, very long — grief that lingers, doesn't announce itself
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.007, t + 0.15);
    gain.gain.setValueAtTime(0.007, t + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 3.8);
    osc.connect(gain);
    gain.connect(engine.reverb);
    osc.start(t);
    osc.stop(t + 4.0);
  }
}

/** Lush final silence bloom — a warm major-7th chord burst as the last mote disappears */
export function playLushFinalBloom(engine: SoundEngine, profile: BiomeSoundProfile): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const rootFreq = profile.rootFreq;
  // Full spread: root through two octaves — the world's last exhalation of warmth
  const semitones = [0, 4, 7, 12, 16, 19]; // root, M3, P5, octave, M3', P5'

  for (let i = 0; i < semitones.length; i++) {
    const freq = rootFreq * Math.pow(2, semitones[i] / 12);
    const t = now + i * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = "sine";
    osc.frequency.value = freq;
    panner.pan.value = ((i / (semitones.length - 1)) * 2 - 1) * 0.75;
    const vol = Math.max(0.006, 0.028 - i * 0.003);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.10);
    gain.gain.setValueAtTime(vol, t + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 5.5);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(engine.reverb);
    osc.start(t);
    osc.stop(t + 5.7);
  }
}
