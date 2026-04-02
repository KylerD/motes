// sound-events.ts — Event sounds, phase transitions, cascade arrivals, birds, star ascension.

import type { SoundEngine, Biome } from "./types";
import { BIOME_SOUND, BIOME_PHASE_SCALES } from "./sound-config";
import { getState } from "./sound-state";
import { createNoiseSource } from "./sound";

/** Different sound per event type */
export function playEventSound(engine: SoundEngine, eventType: string): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  switch (eventType) {
    case "meteor": {
      // High noise burst sweeping down to bass impact
      const bufLen = Math.floor(ctx.sampleRate * 0.9);
      const buf = ctx.createBuffer(2, bufLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(4000, now);
      filter.frequency.exponentialRampToValueAtTime(70, now + 0.7);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      src.start(now);
      src.stop(now + 0.9);
      break;
    }

    case "flood": {
      // Thunder crack: sharp percussive bass that breaks the silence before the flood
      const thunderNoise = createNoiseSource(ctx, 0.7);
      const thunderFilter = ctx.createBiquadFilter();
      thunderFilter.type = "lowpass";
      thunderFilter.frequency.setValueAtTime(300, now);
      thunderFilter.frequency.exponentialRampToValueAtTime(60, now + 0.5);
      thunderFilter.Q.value = 0.8;
      const thunderGain = ctx.createGain();
      thunderGain.gain.setValueAtTime(0.0, now);
      thunderGain.gain.linearRampToValueAtTime(0.38, now + 0.04);
      thunderGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      thunderNoise.connect(thunderFilter);
      thunderFilter.connect(thunderGain);
      thunderGain.connect(engine.compressor);
      thunderNoise.start(now);
      thunderNoise.stop(now + 0.7);

      // Rising wash of filtered noise — water sweeping in after the crack
      const src = createNoiseSource(ctx, 2.5);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2800, now + 0.35);
      filter.frequency.exponentialRampToValueAtTime(180, now + 2.5);
      filter.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, now + 0.35);
      gain.gain.linearRampToValueAtTime(0.085, now + 0.75);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      src.start(now + 0.35);
      src.stop(now + 2.6);
      break;
    }

    case "bloom": {
      // Bright major chord burst — 4 notes in quick succession
      const root = 261.63; // C4
      const bloomFreqs = [root, root * Math.pow(2, 4 / 12), root * Math.pow(2, 7 / 12), root * 2];
      bloomFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = now + i * 0.09;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.052, t + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        osc.connect(gain);
        gain.connect(engine.reverb);
        osc.start(t);
        osc.stop(t + 1.7);
      });
      break;
    }

    case "earthquake": {
      // Sub-bass descending sawtooth with falling pitch
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(40, now);
      osc.frequency.linearRampToValueAtTime(28, now + 1.0);
      filter.type = "lowpass";
      filter.frequency.value = 95;
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(engine.compressor);
      osc.start(now);
      osc.stop(now + 1.2);
      break;
    }

    case "plague": {
      // 3 detuned sines — unsettling cluster of dissonance
      const freqs = [194, 200, 215];
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.024, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(gain);
        gain.connect(engine.compressor);
        osc.start(now);
        osc.stop(now + 0.75);
      }
      break;
    }

    case "aurora": {
      // Harmonic series spread across stereo — shimmering overtone cloud
      const auroraRoot = 130.81;
      const ratios = [1, 1.5, 2, 2.5, 3, 4];
      ratios.forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner();
        osc.type = "sine";
        osc.frequency.value = auroraRoot * ratio;
        osc.detune.value = (i - 2.5) * 6;
        panner.pan.value = (i / (ratios.length - 1)) * 2 - 1;
        const vol = 0.038 / (i * 0.6 + 1);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 1.8);
        gain.gain.setValueAtTime(vol, now + 3.0);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 6.0);
        osc.connect(panner);
        panner.connect(gain);
        gain.connect(engine.reverb);
        osc.start(now);
        osc.stop(now + 6.2);
      });
      break;
    }

    case "drought": {
      // Sudden hush — the world goes dry
      const currentVol = engine.masterGain.gain.value;
      engine.masterGain.gain.setValueAtTime(currentVol, now);
      engine.masterGain.gain.linearRampToValueAtTime(currentVol * 0.4, now + 0.25);
      engine.masterGain.gain.linearRampToValueAtTime(currentVol, now + 2.8);
      break;
    }

    case "migration": {
      // Ascending arpeggio — hopeful, departing
      const migScale = BIOME_PHASE_SCALES.temperate[1];
      const steps = [0, 2, 4, 6];
      for (let i = 0; i < steps.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const idx = Math.min(steps[i], migScale.length - 1);
        osc.frequency.value = 130.81 * Math.pow(2, migScale[idx] / 12);
        const t = now + i * 0.13;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.042, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        gain.connect(engine.reverb);
        osc.start(t);
        osc.stop(t + 0.5);
      }
      break;
    }

    case "eclipse": {
      // Two-layer drone: deep bass + eerie 7th harmonic partial
      const eclipseRoot = 65.41; // C2

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.value = eclipseRoot;
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.055, now + 1.8);
      gain1.gain.setValueAtTime(0.055, now + 4.0);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 6.0);
      osc1.connect(gain1);
      gain1.connect(engine.compressor);
      osc1.start(now);
      osc1.stop(now + 6.2);

      // 7th harmonic — eerie overtone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = eclipseRoot * 7;
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.linearRampToValueAtTime(0.014, now + 2.5);
      gain2.gain.setValueAtTime(0.014, now + 4.0);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 6.0);
      osc2.connect(gain2);
      gain2.connect(engine.reverb);
      osc2.start(now);
      osc2.stop(now + 6.2);
      break;
    }
  }
}

/**
 * Phase transition musical moment — a distinct chord or melodic figure at each boundary.
 */
export function playPhaseTransition(engine: SoundEngine, phaseIndex: number, biome: Biome = "temperate"): void {
  if (!engine.initialized) return;
  const p = BIOME_SOUND[biome];
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  // Per-biome waveform selection for phase transitions:
  // volcanic gets harsh sawtooth at dissolution/silence; tundra/desert stay pure sine;
  // lush gets triangle at complexity/organization for warmth; temperate always sine.
  const transitionWave = (phase: number): OscillatorType => {
    if (biome === "volcanic") return phase >= 4 ? "sawtooth" : "triangle";
    if (biome === "lush")     return phase >= 2 ? "triangle" : "sine";
    return "sine";
  };

  const note = (semitones: number, octaveMult: number, delay: number, duration: number, maxGain: number, wave?: OscillatorType) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave ?? transitionWave(phaseIndex);
    osc.frequency.value = p.rootFreq * Math.pow(2, semitones / 12) * octaveMult;
    gain.gain.setValueAtTime(0.001, now + delay);
    gain.gain.linearRampToValueAtTime(maxGain, now + delay + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
    osc.connect(gain);
    gain.connect(engine.reverb);
    osc.start(now + delay);
    osc.stop(now + delay + duration + 0.05);
  };

  switch (phaseIndex) {
    case 0: // genesis — a slow-dawning fifth
      note(0,  1, 0.0, 4.2, 0.016);
      note(7,  1, 0.4, 3.8, 0.012);
      break;

    case 1: // exploration — ascending major arpeggio (tundra: slow detuned ice sweep)
      if (biome === "tundra") {
        // Two sines spread across stereo, detuned ±14 cents apart, slowly converging —
        // cold air finding a harmonic center, colder and less resolved than a crisp arpeggio
        for (const [detune, pan] of [[-14, -0.78], [14, 0.78]] as [number, number][]) {
          const sweepOsc = ctx.createOscillator();
          const sweepGain = ctx.createGain();
          const sweepPan = ctx.createStereoPanner();
          sweepOsc.type = "sine";
          sweepOsc.frequency.value = p.rootFreq * 2;
          sweepOsc.detune.value = detune;
          // Slowly converge toward zero — two voices seeking unison but never quite arriving
          sweepOsc.detune.linearRampToValueAtTime(detune * 0.15, now + 6.0);
          sweepPan.pan.value = pan;
          sweepGain.gain.setValueAtTime(0.001, now);
          sweepGain.gain.linearRampToValueAtTime(0.014, now + 2.2);
          sweepGain.gain.setValueAtTime(0.014, now + 3.8);
          sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 6.5);
          sweepOsc.connect(sweepGain);
          sweepGain.connect(sweepPan);
          sweepPan.connect(engine.reverb);
          sweepOsc.start(now);
          sweepOsc.stop(now + 6.7);
        }
      } else {
        note(0,  2, 0.00, 1.1, 0.019);
        note(4,  2, 0.09, 1.0, 0.017);
        note(7,  2, 0.18, 1.0, 0.016);
        note(12, 2, 0.27, 1.3, 0.021);
      }
      break;

    case 2: // organization — warm major triad landing
      note(0, 1, 0.00, 2.8, 0.023);
      note(4, 1, 0.05, 2.7, 0.021);
      note(7, 1, 0.10, 2.7, 0.020);
      break;

    case 3: // complexity — full major 7th chord, peak of life
      note(0,  1, 0.00, 3.0, 0.025);
      note(4,  1, 0.00, 3.0, 0.023);
      note(7,  1, 0.00, 3.0, 0.023);
      note(11, 1, 0.06, 2.6, 0.019);
      note(0,  2, 0.12, 2.3, 0.017);
      break;

    case 4: // dissolution — minor triad then a drop
      note(0,  2, 0.00, 1.3, 0.019);
      note(3,  2, 0.00, 1.3, 0.017);
      note(7,  2, 0.00, 1.3, 0.017);
      note(0,  1, 0.35, 3.8, 0.021);
      break;

    case 5: // silence — single root tone fading into nothing
      note(-12, 1, 0.0, 6.0, 0.018);
      break;
  }
}

/**
 * Cascade arrival — rising arpeggio when a cluster first reaches 8+ members.
 * The visual triple ring expands outward; the audio ascends in parallel —
 * 6 notes climbing the biome scale at 160ms intervals, then a full chord sustains.
 * Biome-voiced timbre. Cooldown prevents rapid-fire on simultaneous cascades.
 */
export function playCascadeArrival(engine: SoundEngine, biome: Biome): void {
  if (!engine.initialized) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  // Per-engine cooldown — at most one cascade sound every 4 seconds
  const st = getState(engine);
  if (now - st.cascadeArrivalTime < 4.0) return;
  st.cascadeArrivalTime = now;

  const profile = BIOME_SOUND[biome];
  // Use the complexity-phase scale — richest voicing, peak of life
  const scale = BIOME_PHASE_SCALES[biome][3];

  const spacing = 0.155; // seconds between ascending notes
  const noteCount = 6;

  // Ascending arpeggio: picks evenly-spaced scale degrees, low to high, mid register
  for (let i = 0; i < noteCount; i++) {
    const scaleIdx = Math.floor((i / noteCount) * scale.length);
    const semi = scale[Math.min(scaleIdx, scale.length - 1)];
    const freq = profile.rootFreq * Math.pow(2, semi / 12) * 2; // one octave up
    const t = now + i * spacing;

    // Each note slightly louder/brighter — crescendo toward the chord
    const vol = (0.016 + i * 0.003) * profile.masterMult;
    const decay = i < noteCount - 1 ? 0.50 : 2.4;
    const wave: OscillatorType = i < noteCount - 1 ? profile.waveSmall : profile.waveLarge;
    // Pan spreads left to right as the arpeggio rises
    const pan = ((i / (noteCount - 1)) * 2 - 1) * profile.panStrength * 0.65;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = wave;
    osc.frequency.value = freq;
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.linearRampToValueAtTime(vol, t + 0.022);
    gainNode.gain.setValueAtTime(vol, t + 0.022 + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.022 + decay);
    osc.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(engine.reverb);
    osc.start(t);
    osc.stop(t + 0.022 + decay + 0.1);
  }

  // Final chord: root + perfect fifth + octave, arrives as last arpeggio note sounds
  const chordStart = now + (noteCount - 1) * spacing + 0.08;
  const chordSemitones = [0, 7, 12];
  for (let j = 0; j < chordSemitones.length; j++) {
    const freq = profile.rootFreq * Math.pow(2, chordSemitones[j] / 12) * 2;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = profile.waveLarge;
    osc.frequency.value = freq;
    panner.pan.value = (j - 1) * profile.panStrength * 0.45;
    const chordVol = (0.020 - j * 0.003) * profile.masterMult;
    gainNode.gain.setValueAtTime(0.001, chordStart);
    gainNode.gain.linearRampToValueAtTime(chordVol, chordStart + 0.10);
    gainNode.gain.setValueAtTime(chordVol, chordStart + 1.0);
    gainNode.gain.exponentialRampToValueAtTime(0.001, chordStart + 2.6);
    osc.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(engine.reverb);
    osc.start(chordStart);
    osc.stop(chordStart + 2.8);
  }
}

/**
 * Bird chirp — short melodic tweet played when flocks are actively flying.
 * Biome-specific: tropical trill, tundra whistle, desert hawk cry, temperate songbird.
 * Routed directly to masterGain (no reverb) — birds are in open air.
 */
export function playBirdChirp(engine: SoundEngine, biome: Biome, pan = 0): void {
  if (!engine.initialized) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  type ChirpCfg = { f1: number; f2: number; f3: number; gain: number; dur: number };
  const CHIRPS: Record<Biome, ChirpCfg> = {
    temperate: { f1: 1760, f2: 2640, f3: 1980, gain: 0.075, dur: 0.12 }, // ascending songbird trill
    lush:      { f1: 2200, f2: 3300, f3: 2500, gain: 0.080, dur: 0.09 }, // bright tropical tweet
    tundra:    { f1: 1320, f2: 1760, f3: 1200, gain: 0.060, dur: 0.18 }, // slow clear whistle
    desert:    { f1: 1100, f2:  660, f3:  880, gain: 0.065, dur: 0.22 }, // descending hawk cry
    volcanic:  { f1: 1540, f2: 1100, f3: 1320, gain: 0.050, dur: 0.14 }, // rare — muted
  };
  const cfg = CHIRPS[biome] ?? CHIRPS.temperate;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const panner = ctx.createStereoPanner();

  osc.type = "sine";
  // Chirp shape: rise to peak then fall slightly — like a natural bird call
  osc.frequency.setValueAtTime(cfg.f1, now);
  osc.frequency.exponentialRampToValueAtTime(cfg.f2, now + cfg.dur * 0.55);
  osc.frequency.exponentialRampToValueAtTime(cfg.f3, now + cfg.dur);

  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.linearRampToValueAtTime(cfg.gain, now + 0.010);
  gainNode.gain.setValueAtTime(cfg.gain, now + cfg.dur * 0.35);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur);

  panner.pan.value = Math.max(-1, Math.min(1, pan));

  osc.connect(gainNode);
  gainNode.connect(panner);
  panner.connect(engine.masterGain); // open air — no reverb

  osc.start(now);
  osc.stop(now + cfg.dur + 0.02);
}

// Cooldown: star chimes can saturate if many deaths happen at once
let _lastStarChimeTime = -999;

/** Soft crystalline chime when a mote's spirit ascends to the sky.
 *  High, brief, gentle — like a tiny bell ring far away.
 *  Biome-tinted: tundra=ice bell, lush=glass harp, volcanic=muted gong, etc. */
export function playStarAscension(engine: SoundEngine, _yNorm: number, colorR: number, _colorG: number, colorB: number): void {
  if (!engine.initialized) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  // Cooldown: at most one star chime every 0.4s to avoid saturation
  if (now - _lastStarChimeTime < 0.40) return;
  _lastStarChimeTime = now;

  const biome = getState(engine).currentBiome ?? "temperate";
  const p = BIOME_SOUND[biome];

  // Pitch from mote's color (subtle variation, stays in upper register)
  // Brighter (more blue) → higher pitch; warmer (more red) → slightly lower
  const colorBias = (colorB - colorR) / 255;  // -1 (warm) to +1 (cool)
  const baseFreq = p.rootFreq * 4.0 * Math.pow(2, (4 + colorBias * 3) / 12);

  // Main chime tone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = baseFreq;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.018 * p.masterMult, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  osc.connect(gain);
  gain.connect(engine.reverb);
  osc.start(now);
  osc.stop(now + 1.3);

  // Soft harmonic an octave + fifth above — makes it shimmer like a glass harp
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.value = baseFreq * 3.0;
  gain2.gain.setValueAtTime(0.001, now + 0.008);
  gain2.gain.linearRampToValueAtTime(0.007 * p.masterMult, now + 0.025);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc2.connect(gain2);
  gain2.connect(engine.reverb);
  osc2.start(now + 0.008);
  osc2.stop(now + 0.7);

  // Tundra gets an extra icy high partial
  if (biome === "tundra") {
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.value = baseFreq * 5.0;
    gain3.gain.setValueAtTime(0.001, now + 0.012);
    gain3.gain.linearRampToValueAtTime(0.004 * p.masterMult, now + 0.025);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc3.connect(gain3);
    gain3.connect(engine.reverb);
    osc3.start(now + 0.012);
    osc3.stop(now + 0.5);
  }
}
