// sound-config.ts — Biome sound profiles, per-biome phase scales, and phase audio config.

import type { Biome } from "./types";

// ---- Biome Sound Profiles ----

export interface BiomeSoundProfile {
  rootFreq: number;          // Tonal center (Hz) — defines the biome's home note
  reverbSecs: number;        // Impulse length — larger = more spacious/distant
  filterBase: number;        // Lowpass base frequency (Hz)
  filterMod: number;         // Energy modulation range on filter
  filterQ: number;           // Filter resonance
  waveSmall: OscillatorType; // Cluster size < 4
  waveMed: OscillatorType;   // Cluster size 4-7
  waveLarge: OscillatorType; // Cluster size >= 8
  masterMult: number;        // Volume multiplier
  detuneRange: number;       // X-position detune spread (cents)
  panStrength: number;       // Stereo pan depth 0-1
}

export const BIOME_SOUND: Record<Biome, BiomeSoundProfile> = {
  temperate: {
    rootFreq: 130.81,   // C3 — warm, comfortable home
    reverbSecs: 1.8,
    filterBase: 700,
    filterMod: 1400,
    filterQ: 1.0,
    waveSmall: "sine",
    waveMed: "triangle",
    waveLarge: "triangle",
    masterMult: 1.0,
    detuneRange: 15,
    panStrength: 0.65,
  },
  desert: {
    rootFreq: 164.81,   // E3 — bright, warm, elevated
    reverbSecs: 3.5,    // Long: vast open sky, heat shimmer
    filterBase: 1400,
    filterMod: 600,
    filterQ: 0.6,       // Low Q = open, bell-like resonance
    waveSmall: "sine",
    waveMed: "sine",    // Bell-like throughout
    waveLarge: "sine",
    masterMult: 0.88,
    detuneRange: 6,     // Less detune = purer bell tones
    panStrength: 0.85,  // Wide stereo = sparse open landscape
  },
  tundra: {
    rootFreq: 110,      // A2 — cold, low, ancient
    reverbSecs: 4.5,    // Very long: frozen distances, ice
    filterBase: 320,
    filterMod: 500,
    filterQ: 2.0,       // Higher Q = crystalline resonance
    waveSmall: "sine",
    waveMed: "sine",    // Crystalline purity
    waveLarge: "triangle",
    masterMult: 0.78,
    detuneRange: 28,    // Wide detune = crystalline shimmer, chorus
    panStrength: 0.92,  // Maximum width = vast frozen expanse
  },
  volcanic: {
    rootFreq: 82.41,    // E2 — deep, threatening, subterranean
    reverbSecs: 0.7,    // Short: hard stone, no natural reverb
    filterBase: 160,
    filterMod: 350,
    filterQ: 1.5,
    waveSmall: "triangle",
    waveMed: "sawtooth",
    waveLarge: "sawtooth",
    masterMult: 1.12,
    detuneRange: 22,
    panStrength: 0.45,  // Narrow stereo = claustrophobic, enclosed
  },
  lush: {
    rootFreq: 98,       // G2 — rich, warm, verdant
    reverbSecs: 2.5,    // Dense canopy reverb
    filterBase: 900,
    filterMod: 1800,
    filterQ: 1.2,
    waveSmall: "sine",
    waveMed: "triangle",
    waveLarge: "triangle",
    masterMult: 1.05,
    detuneRange: 18,
    panStrength: 0.6,
  },
};

// ---- Per-biome, per-phase scales (semitones from root) ----

export const BIOME_PHASE_SCALES: Record<Biome, number[][]> = {
  temperate: [
    [0, 3, 7, 10, 14],                        // genesis: minor pentatonic
    [0, 2, 4, 7, 9, 12, 14],                  // exploration: major pentatonic
    [0, 2, 4, 5, 7, 9, 11, 12],               // organization: ionian
    [0, 2, 4, 5, 7, 9, 11, 12, 14, 16],       // complexity: major extended
    [0, 3, 5, 7, 10, 12],                     // dissolution: minor penta + octave
    [0, 7, 12],                               // silence: root + fifth + octave
  ],
  desert: [
    [0, 2, 4, 7, 9],                          // genesis: major penta — sparse, open
    [0, 2, 5, 7, 10, 12],                     // exploration: suspended — heat shimmer
    [0, 2, 4, 6, 7, 9, 11],                   // organization: lydian
    [0, 2, 4, 6, 7, 9, 11, 12, 14, 16],       // complexity: lydian extended
    [0, 2, 7, 9, 12],                         // dissolution: open fifths emptying
    [0, 7],                                   // silence: bare fifth
  ],
  tundra: [
    [0, 2, 3, 7, 10],                         // genesis: dorian penta — cold
    [0, 2, 3, 5, 7, 9, 10, 12],               // exploration: dorian
    [0, 2, 3, 5, 7, 8, 10, 12],               // organization: natural minor
    [0, 1, 3, 5, 7, 8, 10, 12, 13, 15],       // complexity: phrygian
    [0, 3, 7, 10],                            // dissolution: minor penta
    [0, 3, 7],                                // silence: minor triad
  ],
  volcanic: [
    [0, 1, 6, 7],                             // genesis: semitone + tritone
    [0, 1, 3, 6, 7, 10],                      // exploration: diminished 7th arpeggio
    [0, 1, 4, 5, 7, 8, 10],                   // organization: phrygian dominant
    [0, 1, 3, 4, 6, 7, 9, 10, 12],            // complexity: octatonic
    [0, 3, 6, 9, 12],                         // dissolution: diminished arp
    [0, 6],                                   // silence: tritone alone
  ],
  lush: [
    [0, 2, 4, 7, 9],                          // genesis: major penta
    [0, 2, 4, 7, 9, 12, 14],                  // exploration: major penta wide
    [0, 2, 4, 5, 7, 9, 11, 12],               // organization: ionian
    [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19], // complexity: two lush octaves
    [0, 2, 4, 7, 9, 12],                      // dissolution: warmth fading
    [0, 4, 7],                                // silence: major triad
  ],
};

// Phase multipliers for ambient bed gain — drives the sonic arc.
// Genesis at 8%: barely breathing, the world hasn't found its voice yet.
// Silence at 2%: the world has gone. Almost nothing remains.
export const PHASE_AMBIENT_MULT = [0.25, 0.80, 1.00, 1.00, 0.70, 0.15];

/** Phase-dependent parameters for note scheduling */
export interface PhaseAudioConfig {
  volume: number;
  noteIntervalScale: number;
  decay: number;
  filterFreq: number;
  chirpRate: number;
  maxVoices: number;   // how many cluster voices can speak at once this phase
}

export const PHASE_AUDIO: PhaseAudioConfig[] = [
  // Genesis: one fragile voice, very long decay, no chirps — the world barely breathing
  { volume: 0.12, noteIntervalScale: 9.0, decay: 2.8, filterFreq: 280,  chirpRate: 0,    maxVoices: 1 },
  // Exploration: starting to find its voice — 4 voices, playful chirps emerging
  { volume: 0.30, noteIntervalScale: 1.5, decay: 0.6, filterFreq: 1200, chirpRate: 0.06, maxVoices: 4 },
  // Organization: building, harmonics forming, community forming
  { volume: 0.40, noteIntervalScale: 1.0, decay: 0.4, filterFreq: 1600, chirpRate: 0.08, maxVoices: 6 },
  // Complexity: ALL 8 voices alive, peak richness, chirps flying
  { volume: 0.45, noteIntervalScale: 0.6, decay: 0.3, filterFreq: 2400, chirpRate: 0.12, maxVoices: 8 },
  // Dissolution: 5 voices, gaps forming, notes getting farther apart
  { volume: 0.28, noteIntervalScale: 2.0, decay: 0.8, filterFreq: 800,  chirpRate: 0.04, maxVoices: 5 },
  // Silence: NO cluster voices, NO chirps — empty. Only lonely drone if last motes remain.
  { volume: 0.06, noteIntervalScale: 99,  decay: 4.0, filterFreq: 180,  chirpRate: 0,    maxVoices: 0 },
];
