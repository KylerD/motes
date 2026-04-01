# Mote Comprehensive Evolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform mote from a beautiful screensaver into a living world with deep creature behavior, bold page design, clean constants, and modular audio — across 5 workstreams.

**Architecture:** Four independent workstreams that can be parallelized: (A) magic number cleanup, (B) sound.ts refactor, (C) mote inner life, (D) page design. Workstream A should land before C since both touch mote.ts/world.ts. B and D are fully independent.

**Tech Stack:** TypeScript, Canvas 2D, Web Audio API, vanilla CSS, EB Garamond via Google Fonts CDN. Zero npm runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-04-01-mote-inner-life-design.md`

**Verify after every task:**
```bash
npx tsc --noEmit && npx vite build
```

---

## Workstream A: Magic Number Cleanup

### Task 1: Create src/constants.ts with mote behavior constants

**Files:**
- Create: `src/constants.ts`
- Modify: `src/mote.ts`

- [ ] **Step 1: Create constants.ts with mote physics and behavior constants**

Extract all named constants from the top of mote.ts and add the inline magic numbers that affect behavior tuning. Group by domain:

```typescript
// constants.ts — Centralized tuning constants.
// Organized by domain so behavioral parameters are discoverable and tweakable.

// ---- Physics ----
export const GRAVITY = 60;
export const MAX_FALL = 60;
export const WALK_SPEED = 14;
export const JUMP_OVER = 4;

// ---- Spatial ----
export const CELL_SIZE = 20;
export const NEIGHBOR_RADIUS = 28;
export const LOOKAHEAD_DISTANCE = 3;

// ---- Bonding ----
export const BOND_DIST = 20;
export const BOND_TIME = 1.2;
export const MAX_BONDS = 3;
export const BOND_COMFORTABLE_DISTANCE = 0.5; // fraction of BOND_DIST
export const BOND_BREAK_DISTANCE_MULT = 6;    // squared distance multiplier for breaking
export const BOND_FORMATION_ENERGY_GAIN = 0.03;
export const BOND_TIMER_DECAY_RATE = 0.3;
export const ANCIENT_BOND_AGE = 70;           // seconds for "ancient" bond farewell

// ---- Lifecycle ----
export const AGE_MATURE = 8;
export const AGE_ELDER = 20;
export const MATURE_SPEED_MOD = 0.92;
export const ELDER_SPEED_MOD = 0.82;
export const ELDER_BOND_BREAK_MULT = 1.4;

// ---- Movement ----
export const WALK_SPEED_BASE = 0.5;
export const WALK_SPEED_WANDERLUST = 0.8;
export const SAND_SPEED = 0.7;
export const CANOPY_SPEED = 0.85;
export const CAVE_SPEED = 0.6;
export const SHALLOW_WATER_SPEED = 0.5;
export const DIRECTION_CHANGE_RATE = 0.02;

// ---- Social forces ----
export const SOCIAL_ATTRACT_DIST = 12;
export const SOCIAL_ATTRACT_STRENGTH = 4;
export const REPULSION_DIST = 12;
export const REPULSION_STRENGTH = 30;
export const SOCIAL_FORCE_CLAMP = 10;
export const ELDER_ATTRACT_STRENGTH = 2;
export const BONDED_ATTRACT_STRENGTH = 4;

// ---- Energy ----
export const ENERGY_TRANSFER_BASE = 0.05;
export const ENERGY_TRANSFER_SOCIAL = 0.04;
export const NUTRIENT_GAIN_RATE = 0.02;
export const HAZARD_DRAIN_RATE = 0.03;
export const HARDINESS_RESIST = 0.4;
export const ENERGY_DECAY_HARDINESS = 0.4;
export const ENERGY_DECAY_WANDERLUST = 0.3;

// ---- Wanderer frenzy ----
export const FRENZY_ENERGY_THRESHOLD = 0.3;
export const FRENZY_MAX_MULT = 4;

// ---- Dying behavior ----
export const DYING_ENERGY_THRESHOLD = 0.3;
export const DYING_BOND_SEEK_DIST = 5;
export const DYING_BOND_SEEK_FORCE = 20;
export const DYING_SOCIAL_BOOST = 2;

// ---- Flash decay rates ----
export const SPAWN_FLASH_DECAY = 3;
export const BOND_FLASH_DECAY = 3;
export const BOND_BREAK_FLASH_DECAY = 2.5;
export const INHERIT_FLASH_DECAY = 0.65;
export const MOURNING_FLASH_DECAY = 0.5;
export const CLUSTER_MERGE_FLASH_DECAY = 1.8;
export const ANCIENT_BOND_FLASH_DECAY = 0.7;
export const HARDINESS_FLASH_GAIN = 6;
export const HARDINESS_FLASH_DECAY = 4;

// ---- Trail ----
export const TRAIL_AGE_WINDOW = 30;
export const TRAIL_BASE_INTERVAL = 0.08;
export const TRAIL_INTERVAL_RANGE = 0.07;
export const TRAIL_MIN_LENGTH = 12;
export const TRAIL_LENGTH_FACTOR = 33;
export const TRAIL_MIN_LIFETIME = 1.5;
export const TRAIL_LIFETIME_BASE = 1.5;
export const TRAIL_LIFETIME_ELDER = 3.0;

// ---- Hardy flash thresholds ----
export const HARDY_FLASH_TILE_THRESHOLD = -0.1;
export const HARDY_FLASH_MIN_HARDINESS = 0.45;

// ---- Curiosity facing ----
export const CURIOSITY_FACING_MIN_TIMER = 0.1;
```

- [ ] **Step 2: Update mote.ts to import from constants.ts**

Replace all local `const` declarations (lines 14-21) and inline magic numbers with imports from constants.ts. The top of mote.ts becomes:

```typescript
import { Tile } from "./types";
import type { Terrain, Mote, SpatialGrid } from "./types";
import { getSurfaceY, getTile, getTileEnergy } from "./terrain-query";
import { W } from "./config";
import { getNeighbors } from "./physics";
import {
  GRAVITY, WALK_SPEED, MAX_FALL, JUMP_OVER,
  BOND_DIST, BOND_TIME, MAX_BONDS, NEIGHBOR_RADIUS,
  AGE_MATURE, AGE_ELDER, MATURE_SPEED_MOD, ELDER_SPEED_MOD,
  SPAWN_FLASH_DECAY, BOND_FLASH_DECAY, BOND_BREAK_FLASH_DECAY,
  INHERIT_FLASH_DECAY, MOURNING_FLASH_DECAY, CLUSTER_MERGE_FLASH_DECAY,
  ANCIENT_BOND_FLASH_DECAY, TRAIL_AGE_WINDOW, TRAIL_BASE_INTERVAL,
  TRAIL_INTERVAL_RANGE, TRAIL_MIN_LENGTH, TRAIL_LENGTH_FACTOR,
  TRAIL_MIN_LIFETIME, TRAIL_LIFETIME_BASE, TRAIL_LIFETIME_ELDER,
  ENERGY_DECAY_HARDINESS, ENERGY_DECAY_WANDERLUST,
  NUTRIENT_GAIN_RATE, HAZARD_DRAIN_RATE, HARDINESS_RESIST,
  HARDY_FLASH_TILE_THRESHOLD, HARDY_FLASH_MIN_HARDINESS,
  HARDINESS_FLASH_GAIN, HARDINESS_FLASH_DECAY,
  WALK_SPEED_BASE, WALK_SPEED_WANDERLUST,
  SAND_SPEED, CANOPY_SPEED, CAVE_SPEED, SHALLOW_WATER_SPEED,
  FRENZY_ENERGY_THRESHOLD, FRENZY_MAX_MULT, DIRECTION_CHANGE_RATE,
  SOCIAL_ATTRACT_DIST, SOCIAL_ATTRACT_STRENGTH,
  REPULSION_DIST, REPULSION_STRENGTH, SOCIAL_FORCE_CLAMP,
  ELDER_ATTRACT_STRENGTH, BONDED_ATTRACT_STRENGTH,
  BOND_COMFORTABLE_DISTANCE, ENERGY_TRANSFER_BASE, ENERGY_TRANSFER_SOCIAL,
  DYING_ENERGY_THRESHOLD, DYING_BOND_SEEK_DIST, DYING_BOND_SEEK_FORCE,
  DYING_SOCIAL_BOOST, ELDER_BOND_BREAK_MULT, BOND_BREAK_DISTANCE_MULT,
  ANCIENT_BOND_AGE, BOND_FORMATION_ENERGY_GAIN, BOND_TIMER_DECAY_RATE,
  CURIOSITY_FACING_MIN_TIMER, LOOKAHEAD_DISTANCE,
} from "./constants";
```

Then replace every usage throughout updateMote. For example, line 80 `m.age > 8` becomes `m.age > AGE_MATURE`. Line 164 `rng() < 0.02 * dt * 60 * wandererFrenzy` becomes `rng() < DIRECTION_CHANGE_RATE * dt * 60 * wandererFrenzy`. And so on for every inline number listed in the spec.

Delete the local const block at lines 14-21.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/constants.ts src/mote.ts
git commit -m "refactor: extract mote behavior constants to constants.ts"
```

---

### Task 2: Extract world.ts and events.ts constants

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/world.ts`
- Modify: `src/events.ts`
- Modify: `src/physics.ts`
- Modify: `src/interaction.ts`

- [ ] **Step 1: Add world/event/physics/interaction constants to constants.ts**

Append to constants.ts:

```typescript
// ---- World / Phases ----
export const PHASE_DURATIONS = [0.10, 0.20, 0.25, 0.25, 0.12, 0.08] as const;
export const RNG_SEED_OFFSET = 7777;
export const SPAWN_ATTEMPTS = 10;
export const SPAWN_ENERGY_MIN = 0.4;
export const SPAWN_ENERGY_RANGE = 0.4;
export const SETTLEMENT_INTERVAL = 3;
export const SETTLEMENT_MIN_CLUSTER = 3;
export const DEATH_RECORD_LIFETIME = 7.5;
export const INHERIT_RADIUS_BASE = 55;
export const INHERIT_RADIUS_AGE_MAX = 25;
export const INHERIT_RADIUS_AGE_MULT = 1.5;
export const CLUSTER_MOURNING_PERIPHERAL = 0.55;
export const WANDERER_TRAIL_THRESHOLD = 0.6;
export const DEATH_COLOR_ENERGY = 0.4;
export const AGE_GOLD_START = 8;
export const AGE_GOLD_WINDOW = 22;
export const AGE_GOLD_STRENGTH = 0.40;
export const MAX_SPEED_MULTIPLIER = 120;

// Phase params table (indexed by phase)
export const PHASE_PARAMS = [
  { spawnRate: 4,  maxMotes: 20, energyDecay: 0.008, bondStrength: 0.3 },
  { spawnRate: 3,  maxMotes: 45, energyDecay: 0.012, bondStrength: 0.5 },
  { spawnRate: 2,  maxMotes: 60, energyDecay: 0.015, bondStrength: 0.8 },
  { spawnRate: 2,  maxMotes: 70, energyDecay: 0.018, bondStrength: 0.9 },
  { spawnRate: 0,  maxMotes: 70, energyDecay: 0.04,  bondStrength: 0.3 },
  { spawnRate: 0,  maxMotes: 70, energyDecay: 0.07,  bondStrength: 0.1 },
] as const;

// ---- Events ----
export const EVENT_FREQUENCY = 12;  // ~1 in 12 cycles
export const EVENT_MESSAGE_DISPLAY = 3;
export const EVENT_MESSAGE_FADE = 2;

export const EVENT_DURATIONS: Record<string, number> = {
  flood: 28, bloom: 15, meteor: 8, migration: 22, eclipse: 28,
  earthquake: 12, plague: 32, aurora: 22, drought: 48,
};

export const EVENT_TRIGGER_POINTS: Record<string, number> = {
  flood: 0.40, bloom: 0.50, meteor: 0.60, migration: 0.55, eclipse: 0.65,
  earthquake: 0.45, plague: 0.50, aurora: 0.70, drought: 0.38,
};

// ---- Interaction (inline ones) ----
export const PULSE_INITIAL_RADIUS = 2;
export const RIPPLE_INITIAL_ALPHA = 1;
export const PULSE_FORCE_H = 8;
export const PULSE_FORCE_V = 5;
export const GRAVITY_VERTICAL_REDUCTION = 0.3;
```

- [ ] **Step 2: Update world.ts to import from constants.ts**

Replace the local `PHASE_DURATIONS` array, `PHASE_PARAMS` table, and all inline magic numbers with imports. Remove the local `PhaseParams` interface (it's already in types.ts). The local arrays and `interface PhaseParams` block (lines 31-78) get replaced with imports.

Key replacements:
- `PHASE_DURATIONS` array → import
- `PHASE_PARAMS` array → import
- `7777` → `RNG_SEED_OFFSET`
- `120` → `MAX_SPEED_MULTIPLIER`
- `10` attempts → `SPAWN_ATTEMPTS`
- `0.4 + world.rng() * 0.4` → `SPAWN_ENERGY_MIN + world.rng() * SPAWN_ENERGY_RANGE`
- `3` settlement timer → `SETTLEMENT_INTERVAL`
- `3` cluster size → `SETTLEMENT_MIN_CLUSTER`
- `7.5` death record lifetime → `DEATH_RECORD_LIFETIME`
- `55` inherit radius → `INHERIT_RADIUS_BASE`
- `0.55` mourning → `CLUSTER_MOURNING_PERIPHERAL`
- Death color constants → import all `AGE_GOLD_*`, `DEATH_COLOR_ENERGY`, `WANDERER_TRAIL_THRESHOLD`

- [ ] **Step 3: Update events.ts to import from constants.ts**

Replace inline event durations and trigger points with the imported `EVENT_DURATIONS` and `EVENT_TRIGGER_POINTS` records. Replace message timing with `EVENT_MESSAGE_DISPLAY` and `EVENT_MESSAGE_FADE`.

- [ ] **Step 4: Update physics.ts to import CELL_SIZE from constants.ts**

Replace local `const CELL_SIZE = 20` with `import { CELL_SIZE } from "./constants"`.

- [ ] **Step 5: Update interaction.ts inline numbers**

Replace `2` (pulse radius), `1` (ripple alpha), `8`/`5` (pulse forces), `0.3` (vertical reduction) with imports.

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 7: Commit**

```bash
git add src/constants.ts src/world.ts src/events.ts src/physics.ts src/interaction.ts
git commit -m "refactor: extract world, event, physics constants to constants.ts"
```

---

## Workstream B: Sound.ts Refactoring

### Task 3: Create sound-config.ts — biome profiles, scales, phase audio

**Files:**
- Create: `src/sound-config.ts`
- Modify: `src/sound.ts` (remove extracted sections)

- [ ] **Step 1: Create sound-config.ts**

Extract from sound.ts lines 11-138 (biome profiles, scales) and lines 402-425 (PHASE_AUDIO config) plus the PHASE_AMBIENT_MULT array (lines 272-275):

```typescript
// sound-config.ts — Biome sound profiles, scale definitions, phase audio parameters.

import type { Biome } from "./types";

export interface BiomeSoundProfile {
  rootFreq: number;
  reverbSecs: number;
  filterBase: number;
  filterMod: number;
  filterQ: number;
  waveSmall: OscillatorType;
  waveMed: OscillatorType;
  waveLarge: OscillatorType;
  masterMult: number;
  detuneRange: number;
  panStrength: number;
}

export const BIOME_SOUND: Record<Biome, BiomeSoundProfile> = {
  // ... paste exact content from sound.ts lines 18-93
};

export const BIOME_PHASE_SCALES: Record<Biome, number[][]> = {
  // ... paste exact content from sound.ts lines 95-138
};

export interface PhaseAudioConfig {
  volume: number;
  noteIntervalScale: number;
  decay: number;
  filterFreq: number;
  chirpRate: number;
  maxVoices: number;
}

export const PHASE_AUDIO: PhaseAudioConfig[] = [
  // ... paste exact content from sound.ts lines 403-425
];

export const PHASE_AMBIENT_MULT = [0.5, 0.7, 0.9, 1.0, 0.6, 0.2];
```

- [ ] **Step 2: Remove extracted sections from sound.ts, add imports**

Delete lines 11-138, 272-275, and 402-425 from sound.ts. Add:
```typescript
import {
  BIOME_SOUND, BIOME_PHASE_SCALES, PHASE_AUDIO, PHASE_AMBIENT_MULT,
  type BiomeSoundProfile, type PhaseAudioConfig,
} from "./sound-config";
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/sound-config.ts src/sound.ts
git commit -m "refactor: extract sound config to sound-config.ts"
```

---

### Task 4: Create sound-state.ts — consolidated state management

**Files:**
- Create: `src/sound-state.ts`
- Modify: `src/sound.ts`

- [ ] **Step 1: Create sound-state.ts with typed state interface**

Replace the 20 WeakMaps (sound.ts lines 247-270) with a single typed state object:

```typescript
// sound-state.ts — Per-engine sound state, replacing 20 separate WeakMaps.

import type { Biome, SoundEngine } from "./types";

/** Ambient bed oscillators and gain nodes */
export interface AmbientBed {
  droneOsc: OscillatorNode;
  droneGain: GainNode;
  noiseSource: AudioBufferSourceNode;
  noiseGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

export interface SoundState {
  currentBiome: Biome | null;
  ambientBed: AmbientBed | null;
  spawnCooldown: number;
  bondBreakCooldown: number;
  volcanicAccentTime: number;
  lonelyDroneTime: number;
  desertShimmerTime: number;
  milestone4Time: number;
  milestone8Time: number;
  tundraWindTime: number;
  volcanicRumbleTime: number;
  clusterMergeCooldown: number;
  mourningTime: number;
  prevMoteCount: number;
  lushBloomTime: number;
  ancientBondBreakTime: number;
  lushFireflyTime: number;
  tundraCrystalTime: number;
  cascadeArrivalTime: number;
  elderDeathTime: number;
}

const engineState = new Map<SoundEngine, SoundState>();

export function getState(engine: SoundEngine): SoundState {
  let s = engineState.get(engine);
  if (!s) {
    s = {
      currentBiome: null,
      ambientBed: null,
      spawnCooldown: 0,
      bondBreakCooldown: 0,
      volcanicAccentTime: -999,
      lonelyDroneTime: -999,
      desertShimmerTime: -999,
      milestone4Time: -999,
      milestone8Time: -999,
      tundraWindTime: -999,
      volcanicRumbleTime: -999,
      clusterMergeCooldown: 0,
      mourningTime: -999,
      prevMoteCount: 0,
      lushBloomTime: -999,
      ancientBondBreakTime: -999,
      lushFireflyTime: -999,
      tundraCrystalTime: -999,
      cascadeArrivalTime: -999,
      elderDeathTime: -999,
    };
    engineState.set(engine, s);
  }
  return s;
}
```

- [ ] **Step 2: Update sound.ts to use getState() instead of WeakMaps**

Delete all 20 WeakMap declarations (lines 247-270). Import `getState` from sound-state.ts. In every function that reads/writes a WeakMap, replace the pattern:

```typescript
// Before:
const lastTime = engineDesertShimmerTime.get(engine) ?? -999;
engineDesertShimmerTime.set(engine, now);

// After:
const st = getState(engine);
const lastTime = st.desertShimmerTime;
st.desertShimmerTime = now;
```

Also move the `AmbientBed` interface and `createAmbientBed`/`stopAmbientBed` helpers — they reference the ambient bed state. Move `createAmbientBed` (lines 194-236) and `stopAmbientBed` (lines 238-245) and the `BiomeAmbientConfig`/`AmbientBed` types (lines 142-192) into sound-state.ts since ambient bed lifecycle is state management.

Actually — keep createAmbientBed/stopAmbientBed in sound.ts for now (they're audio logic, not pure state). Just move the AmbientBed interface to sound-state.ts and export it.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/sound-state.ts src/sound.ts
git commit -m "refactor: consolidate sound WeakMaps into typed SoundState"
```

---

### Task 5: Create sound-events.ts — event sounds, phase transitions, cascade, birds, star ascension

**Files:**
- Create: `src/sound-events.ts`
- Modify: `src/sound.ts`

- [ ] **Step 1: Create sound-events.ts**

Extract these functions from sound.ts into a new module:

- `playEventSound()` (lines 1540-1758) — EXPORTED
- `playPhaseTransition()` (lines 2081-2180) — EXPORTED
- `playCascadeArrival()` (lines 2181-2251) — EXPORTED
- `playBirdChirp()` (lines 2258-2296) — EXPORTED
- `playStarAscension()` (lines 2398-2461) — EXPORTED

Each function needs access to the engine's AudioContext, masterGain, reverb, and compressor. Pass `SoundEngine` as the first argument (already the pattern). Import `BIOME_SOUND` and `BIOME_PHASE_SCALES` from sound-config.ts. Import `getState` from sound-state.ts for any cooldown tracking. Import `triggerNote` and `createReverb` from sound.ts (these stay in the core module as shared helpers — export them).

```typescript
// sound-events.ts — Event sounds, phase transitions, cascade arrivals, birds, star ascension.

import type { SoundEngine, Biome } from "./types";
import { BIOME_SOUND, BIOME_PHASE_SCALES } from "./sound-config";
import { getState } from "./sound-state";
import { triggerNote } from "./sound";

export function playEventSound(engine: SoundEngine, eventType: string, biome: Biome): void {
  // ... paste exact content from sound.ts lines 1540-1758
}

export function playPhaseTransition(engine: SoundEngine, phaseIndex: number, biome: Biome): void {
  // ... paste exact content from sound.ts lines 2081-2180
}

export function playCascadeArrival(engine: SoundEngine, biome: Biome): void {
  // ... paste exact content from sound.ts lines 2181-2251
}

export function playBirdChirp(engine: SoundEngine, biome: Biome): void {
  // ... paste exact content from sound.ts lines 2258-2296
}

export function playStarAscension(engine: SoundEngine, r: number, g: number, b: number, biome: Biome): void {
  // ... paste exact content from sound.ts lines 2404-2461
}
```

- [ ] **Step 2: Export triggerNote and createReverb from sound.ts**

Add `export` to `triggerNote` and `createReverb` function declarations in sound.ts (they're currently module-private). These are shared audio primitives needed by the extracted modules.

- [ ] **Step 3: Update sound.ts to re-export from sound-events.ts**

Delete the extracted function bodies from sound.ts. Add re-exports:
```typescript
export { playEventSound, playPhaseTransition, playCascadeArrival, playBirdChirp, playStarAscension } from "./sound-events";
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 5: Commit**

```bash
git add src/sound-events.ts src/sound.ts
git commit -m "refactor: extract event/transition/bird sounds to sound-events.ts"
```

---

### Task 6: Create sound-lifecycle.ts — bond, death, mourning, merge sounds

**Files:**
- Create: `src/sound-lifecycle.ts`
- Modify: `src/sound.ts`

- [ ] **Step 1: Create sound-lifecycle.ts**

Extract lifecycle-related sound functions:

- `playBondForm()` (lines 947-1029) — EXPORTED
- `playBondBreak()` (lines 1030-1201)
- `playAncientBondBreak()` (lines 1202-1324)
- `playDeath()` (lines 1327-1480) — EXPORTED
- `playClusterMilestone()` (lines 1817-1861)
- `playClusterMerge()` (lines 1863-1908)
- `playMourningChorus()` (lines 1910-1947)
- `playLushFinalBloom()` (lines 1949-1978)

```typescript
// sound-lifecycle.ts — Bond formation, breaking, death, mourning, and cluster sounds.

import type { SoundEngine, Biome } from "./types";
import { BIOME_SOUND, BIOME_PHASE_SCALES } from "./sound-config";
import { getState } from "./sound-state";
import { triggerNote, createNoiseSource } from "./sound";

// ... paste exact function bodies
```

- [ ] **Step 2: Export createNoiseSource from sound.ts**

Add `export` to `createNoiseSource` (line ~1979). It's used by lifecycle sounds.

- [ ] **Step 3: Update sound.ts re-exports**

Delete extracted functions, add:
```typescript
export {
  playBondForm, playBondBreak, playAncientBondBreak, playDeath,
  playClusterMilestone, playClusterMerge, playMourningChorus, playLushFinalBloom,
} from "./sound-lifecycle";
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 5: Commit**

```bash
git add src/sound-lifecycle.ts src/sound.ts
git commit -m "refactor: extract lifecycle sounds to sound-lifecycle.ts"
```

---

### Task 7: Create sound-weather.ts — weather ambient, dissolution, thunder

**Files:**
- Create: `src/sound-weather.ts`
- Modify: `src/sound.ts`

- [ ] **Step 1: Create sound-weather.ts**

Extract weather-related functions:

- `updateWeatherSound()` (lines 1995-2076) — EXPORTED
- `playThunder()` (lines 2299-2324)
- `updateDissolutionSound()` (lines 2326-2396) — EXPORTED
- Module-level dissolution state (`_drSource`, `_drGain`, `_drActive` — lines 2326-2330)

```typescript
// sound-weather.ts — Weather ambient sounds, dissolution rain, thunder.

import type { SoundEngine, Weather, Biome } from "./types";
import { BIOME_SOUND } from "./sound-config";
import { createNoiseSource } from "./sound";

// Dissolution rain state (module-level)
let _drSource: AudioBufferSourceNode | null = null;
let _drGain: GainNode | null = null;
let _drActive = false;

export function updateWeatherSound(engine: SoundEngine, weather: Weather, biome: Biome): void {
  // ... paste exact content
}

function playThunder(engine: SoundEngine): void {
  // ... paste exact content
}

export function updateDissolutionSound(
  engine: SoundEngine, phaseIndex: number, cycleProgress: number, biome: Biome
): void {
  // ... paste exact content
}
```

- [ ] **Step 2: Update sound.ts re-exports**

Delete extracted functions and module state. Add:
```typescript
export { updateWeatherSound, updateDissolutionSound } from "./sound-weather";
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/sound-weather.ts src/sound.ts
git commit -m "refactor: extract weather sounds to sound-weather.ts"
```

---

### Task 8: Verify sound.ts is now a thin barrel

**Files:**
- Modify: `src/sound.ts` (final cleanup)

- [ ] **Step 1: Audit remaining sound.ts**

After Tasks 3-7, sound.ts should contain only:
- Imports from sound-config, sound-state, and sub-modules
- `createSoundEngine()` (~15 lines)
- `initAudio()` (~36 lines)
- `createReverb()` (~12 lines)
- `triggerNote()` (~44 lines) — exported for sub-modules
- `createNoiseSource()` (~14 lines) — exported for sub-modules
- `createAmbientBed()` / `stopAmbientBed()` (~104 lines)
- `updateSound()` (~420 lines) — the main orchestrator
- `playChirp()` / `playSpawnPing()` / `ping()` (~135 lines) — individual mote sounds
- VoiceSlot management (~20 lines)
- Biome-specific accent logic within updateSound (volcanic pops, tundra wind, lush fireflies, desert shimmer)
- Re-exports from all sub-modules

This should be ~800-900 lines — down from 2,461. The biome-specific accent logic within updateSound is tightly coupled to the main loop and doesn't benefit from extraction.

- [ ] **Step 2: Clean up any dead code, unused imports**

Scan for WeakMap references that were missed, unused import statements, or functions that were partially extracted.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/sound.ts
git commit -m "refactor: sound.ts cleanup — barrel with core loop, 2461→~850 lines"
```

---

### Task 9: Update CLAUDE.md source layout

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Source Layout section**

Add the new files to the source layout in CLAUDE.md:

```
├── constants.ts       # Centralized tuning constants
```

And update the sound section:
```
├── sound.ts           # Core audio engine, init, main update loop, re-exports
├── sound-config.ts    # Biome profiles, scales, phase audio parameters
├── sound-state.ts     # Per-engine state management (typed SoundState)
├── sound-events.ts    # Event sounds, phase transitions, cascade, birds
├── sound-lifecycle.ts # Bond, death, mourning, cluster sounds
├── sound-weather.ts   # Weather ambient, dissolution rain, thunder
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update source layout for new modules"
```

---

## Workstream C: Mote Inner Life

### Task 10: Add drive and memory fields to types.ts and createMote

**Files:**
- Modify: `src/types.ts`
- Modify: `src/mote.ts`

- [ ] **Step 1: Add new fields to the Mote interface in types.ts**

After the existing `ancientBondBreakFlash: number;` field (line 110), add:

```typescript
  // Drives (fluctuating 0-1, biased by temperament)
  comfort: number;
  curiosity: number;
  togetherness: number;

  // Memory: favorite position (EMA of high-satisfaction locations)
  favX: number;
  favY: number;
  favTimer: number;            // accumulator for 2s update interval

  // Memory: preferred companion
  preferredMote: Mote | null;

  // Memory: avoidance
  avoidX: number;
  avoidY: number;
  avoidTimer: number;          // countdown, 0 = no avoidance

  // Behavioral state
  grieving: number;            // countdown timer, 0 = not grieving
  lonelyTimer: number;         // seconds since last neighbor
  stableTimer: number;         // seconds bonded without bond-count change
  lastEnergy: number;          // for sharp energy drop detection
  lastEnergyTime: number;      // timestamp of lastEnergy sample
```

- [ ] **Step 2: Update createMote to initialize new fields**

In mote.ts, update `createMote` to initialize all new fields:

```typescript
export function createMote(
  x: number,
  y: number,
  energy: number,
  rng: () => number,
): Mote {
  const wanderlust = rng();
  const sociability = rng();
  const hardiness = rng();
  return {
    x, y, vx: 0, vy: 0, energy, age: 0,
    temperament: { wanderlust, sociability, hardiness },
    bonds: [], bondAges: new Map(), bondTimer: 0,
    bondFlash: 0, bondBreakFlash: 0, hardinessFlash: 0,
    inheritFlash: 0, inheritR: 0, inheritG: 0, inheritB: 0,
    mourningFlash: 0, mourningR: 0, mourningG: 0, mourningB: 0,
    clusterMergeFlash: 0, ancientBondBreakFlash: 0,
    grounded: false,
    direction: rng() < 0.5 ? -1 : 1,
    spawnFlash: 1.0,
    trail: [], trailTimer: 0,
    forceX: 0, forceY: 0,
    // Drives (baseline from temperament)
    comfort: 0.3 + hardiness * 0.4,
    curiosity: 0.3 + wanderlust * 0.4,
    togetherness: 0.3 + sociability * 0.4,
    // Memory: favorite position (starts at spawn)
    favX: x, favY: y, favTimer: 0,
    // Memory: preferred companion
    preferredMote: null,
    // Memory: avoidance
    avoidX: 0, avoidY: 0, avoidTimer: 0,
    // State
    grieving: 0,
    lonelyTimer: 0,
    stableTimer: 0,
    lastEnergy: energy,
    lastEnergyTime: 0,
  };
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/mote.ts
git commit -m "feat: add drive and memory fields to Mote interface"
```

---

### Task 11: Implement drive update logic

**Files:**
- Modify: `src/mote.ts`
- Modify: `src/constants.ts`

- [ ] **Step 1: Add drive constants to constants.ts**

```typescript
// ---- Drives ----
export const COMFORT_BASELINE_BASE = 0.3;
export const COMFORT_BASELINE_SCALE = 0.4;
export const CURIOSITY_BASELINE_BASE = 0.3;
export const CURIOSITY_BASELINE_SCALE = 0.4;
export const TOGETHERNESS_BASELINE_BASE = 0.3;
export const TOGETHERNESS_BASELINE_SCALE = 0.4;
export const DRIVE_DECAY_RATE = 0.04;
export const COMFORT_LOW_ENERGY_RATE = 0.15;
export const COMFORT_LOW_ENERGY_THRESHOLD = 0.4;
export const TOGETHERNESS_LONELY_RATE = 0.08;
export const LONELY_THRESHOLD_TIME = 5;
export const CURIOSITY_RESTLESS_RATE = 0.06;
export const RESTLESS_THRESHOLD_TIME = 8;
export const EVENT_BOLD_CURIOSITY_SPIKE = 0.3;
export const EVENT_TIMID_COMFORT_SPIKE = 0.3;
export const BOLD_HARDINESS_THRESHOLD = 0.5;

// ---- Memory ----
export const FAV_POSITION_ALPHA = 0.15;
export const FAV_POSITION_INTERVAL = 2;
export const FAV_POSITION_ENERGY_THRESHOLD = 0.4;
export const AVOIDANCE_DURATION = 75;
export const AVOIDANCE_ENERGY_DROP = 0.15;
export const AVOIDANCE_ENERGY_WINDOW = 2;

// ---- Grief ----
export const GRIEF_DURATION = 18;
export const GRIEF_SPEED_MULT = 0.5;
export const GRIEF_COMFORT_OVERRIDE = 1.0;
export const GRIEF_TOGETHERNESS_FLOOR = 0.1;
export const GRIEF_BOND_THRESHOLD = 0.8;
export const GRIEF_TOGETHERNESS_RECOVERY = 0.03;

// ---- Compatibility ----
export const COMPAT_WANDERLUST_SOCIAL_WEIGHT = 0.5;
export const COMPAT_HARDINESS_WEIGHT = 0.3;
export const COMPAT_BOND_THRESHOLD = 0.35;
export const COMPAT_FAST_FRIEND_THRESHOLD = 0.7;
export const COMPAT_FAST_FRIEND_MULT = 1.5;

// ---- Rejection ----
export const REJECTION_TOGETHERNESS_THRESHOLD = 0.3;

// ---- Target selection ----
export const EXPLORE_DISTANCE = 40;
```

- [ ] **Step 2: Add updateDrives function to mote.ts**

Add a new function before `updateMote`. This runs once per frame per mote:

```typescript
function updateDrives(m: Mote, dt: number, hasNeighbor: boolean): void {
  const { wanderlust, sociability, hardiness } = m.temperament;
  const comfortBase = COMFORT_BASELINE_BASE + hardiness * COMFORT_BASELINE_SCALE;
  const curiosityBase = CURIOSITY_BASELINE_BASE + wanderlust * CURIOSITY_BASELINE_SCALE;
  const togethernessBase = TOGETHERNESS_BASELINE_BASE + sociability * TOGETHERNESS_BASELINE_SCALE;

  // Decay toward baseline
  m.comfort += (comfortBase - m.comfort) * DRIVE_DECAY_RATE * dt * 60;
  m.curiosity += (curiosityBase - m.curiosity) * DRIVE_DECAY_RATE * dt * 60;
  m.togetherness += (togethernessBase - m.togetherness) * DRIVE_DECAY_RATE * dt * 60;

  // Low energy → comfort rises
  if (m.energy < COMFORT_LOW_ENERGY_THRESHOLD) {
    const deficit = 1 - m.energy / COMFORT_LOW_ENERGY_THRESHOLD;
    m.comfort += COMFORT_LOW_ENERGY_RATE * deficit * dt;
  }

  // Lonely → togetherness rises
  if (!hasNeighbor) {
    m.lonelyTimer += dt;
  } else {
    m.lonelyTimer = Math.max(0, m.lonelyTimer - dt * 2);
  }
  if (m.lonelyTimer > LONELY_THRESHOLD_TIME) {
    m.togetherness += TOGETHERNESS_LONELY_RATE * dt;
  }

  // Bonded and stable → curiosity rises (restlessness)
  if (m.bonds.length > 0) {
    m.stableTimer += dt;
  } else {
    m.stableTimer = 0;
  }
  if (m.stableTimer > RESTLESS_THRESHOLD_TIME) {
    m.curiosity += CURIOSITY_RESTLESS_RATE * dt;
  }

  // Grief overrides
  if (m.grieving > 0) {
    m.grieving -= dt;
    m.comfort = GRIEF_COMFORT_OVERRIDE;
    m.togetherness = Math.min(m.togetherness, GRIEF_TOGETHERNESS_FLOOR);
    if (m.grieving <= 0) {
      m.grieving = 0;
      // Recovery: togetherness slowly rebuilds (handled by baseline decay above)
    }
  }

  // Clamp
  m.comfort = Math.max(0, Math.min(1, m.comfort));
  m.curiosity = Math.max(0, Math.min(1, m.curiosity));
  m.togetherness = Math.max(0, Math.min(1, m.togetherness));
}
```

- [ ] **Step 3: Call updateDrives from updateMote**

Early in `updateMote`, after age/flash updates and before movement logic, add:

```typescript
  // Drives
  const neighbors = getNeighbors(grid, m.x, m.y, NEIGHBOR_RADIUS, m);
  const hasNeighbor = neighbors.length > 0;
  updateDrives(m, dt, hasNeighbor);
```

Move the existing `getNeighbors` call earlier (it's currently at line 174) so drives can use the neighbor info.

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 5: Commit**

```bash
git add src/mote.ts src/constants.ts
git commit -m "feat: implement mote drive system (comfort/curiosity/togetherness)"
```

---

### Task 12: Implement memory system

**Files:**
- Modify: `src/mote.ts`

- [ ] **Step 1: Add updateMemory function**

```typescript
function updateMemory(m: Mote, dt: number): void {
  // Favorite position: EMA updated every ~2s when energy is decent
  m.favTimer += dt;
  if (m.favTimer >= FAV_POSITION_INTERVAL && m.energy > FAV_POSITION_ENERGY_THRESHOLD) {
    m.favTimer = 0;
    m.favX += FAV_POSITION_ALPHA * (m.x - m.favX);
    m.favY += FAV_POSITION_ALPHA * (m.y - m.favY);
  }

  // Preferred companion: track longest-bonded mote
  if (m.bonds.length > 0) {
    let longestAge = 0;
    let longest: Mote | null = null;
    for (const b of m.bonds) {
      const age = m.bondAges.get(b) ?? 0;
      if (age > longestAge) {
        longestAge = age;
        longest = b;
      }
    }
    // Only update if this bond is older than current preferred's bond
    if (longest && m.preferredMote) {
      const currentAge = m.bondAges.get(m.preferredMote) ?? 0;
      if (longestAge > currentAge) {
        m.preferredMote = longest;
      }
    } else if (longest && !m.preferredMote) {
      m.preferredMote = longest;
    }
  }

  // Avoidance: detect sharp energy drops
  const energyDelta = m.lastEnergy - m.energy;
  const timeDelta = m.age - m.lastEnergyTime;
  if (timeDelta >= AVOIDANCE_ENERGY_WINDOW) {
    if (energyDelta > AVOIDANCE_ENERGY_DROP) {
      m.avoidX = m.x;
      m.avoidY = m.y;
      m.avoidTimer = AVOIDANCE_DURATION;
    }
    m.lastEnergy = m.energy;
    m.lastEnergyTime = m.age;
  }

  // Avoidance decay
  if (m.avoidTimer > 0) {
    m.avoidTimer -= dt;
    if (m.avoidTimer < 0) m.avoidTimer = 0;
  }
}
```

- [ ] **Step 2: Call updateMemory from updateMote**

Add after the `updateDrives` call:
```typescript
  updateMemory(m, dt);
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/mote.ts
git commit -m "feat: implement mote memory (favorite position, companion, avoidance)"
```

---

### Task 13: Implement drive-based target selection and movement

**Files:**
- Modify: `src/mote.ts`

- [ ] **Step 1: Replace random direction-flip with drive-based targeting**

Replace the direction-change logic (current `rng() < DIRECTION_CHANGE_RATE * dt * 60 * wandererFrenzy`) with drive-based target selection:

```typescript
  // Target selection: weighted blend of drive targets
  const totalDrive = m.comfort + m.curiosity + m.togetherness;
  let targetX = m.x; // default: stay put

  if (totalDrive > 0.01) {
    // Comfort target: favorite position
    const comfortX = m.favX;

    // Curiosity target: point ahead in current direction
    let exploreX = m.x + m.direction * EXPLORE_DISTANCE;
    if (exploreX < 4 || exploreX > W - 4) exploreX = m.x - m.direction * EXPLORE_DISTANCE;

    // Togetherness target: preferred companion, or nearest compatible mote
    let companionX = m.x;
    let hasCompanionTarget = false;
    if (m.preferredMote && m.preferredMote.energy > 0) {
      companionX = m.preferredMote.x;
      hasCompanionTarget = true;
    } else if (closestUnbonded) {
      companionX = closestUnbonded.x;
      hasCompanionTarget = true;
    }

    const cWeight = m.comfort;
    const qWeight = m.curiosity;
    const tWeight = hasCompanionTarget ? m.togetherness : 0;
    const wSum = cWeight + qWeight + tWeight;

    if (wSum > 0.01) {
      targetX = (cWeight * comfortX + qWeight * exploreX + tWeight * companionX) / wSum;
    }
  }

  // Avoidance repulsion
  if (m.avoidTimer > 0) {
    const avoidDx = m.x - m.avoidX;
    const avoidDist = Math.abs(avoidDx);
    if (avoidDist < 40 && avoidDist > 0.5) {
      targetX += (avoidDx / avoidDist) * 15; // push away from bad spot
    }
  }

  // Set direction to face target
  if (Math.abs(targetX - m.x) > 1) {
    m.direction = targetX > m.x ? 1 : -1;
  }

  // Small random perturbation (keeps movement organic, uses seeded rng)
  if (rng() < 0.03 * dt * 60) {
    m.direction *= -1;
  }
```

This replaces the existing direction-change block. The `closestUnbonded` variable is already computed in the social force section — make sure this target selection runs AFTER the neighbor scan.

- [ ] **Step 2: Apply grief speed modifier**

In the walkSpeed calculation, add the grief modifier:

```typescript
  const griefMod = m.grieving > 0 ? GRIEF_SPEED_MULT : 1.0;
  const walkSpeed = WALK_SPEED * (WALK_SPEED_BASE + m.temperament.wanderlust * WALK_SPEED_WANDERLUST) * ageMod * griefMod;
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/mote.ts
git commit -m "feat: drive-based target selection replaces random direction change"
```

---

### Task 14: Implement compatibility, rejection, and grief trigger

**Files:**
- Modify: `src/mote.ts`
- Modify: `src/world.ts`

- [ ] **Step 1: Add compatibility function**

Add to mote.ts:

```typescript
function compatibility(a: Mote, b: Mote): number {
  return 1.0
    - Math.abs(a.temperament.wanderlust - b.temperament.sociability) * COMPAT_WANDERLUST_SOCIAL_WEIGHT
    - Math.abs(a.temperament.hardiness - b.temperament.hardiness) * COMPAT_HARDINESS_WEIGHT;
}
```

- [ ] **Step 2: Gate bond formation with compatibility**

In the bond formation section, add a compatibility check. Replace:

```typescript
  if (closestUnbonded && closestDist < BOND_DIST) {
    m.bondTimer += dt;
    if (m.bondTimer > BOND_TIME / bondStrength) {
```

With:

```typescript
  if (closestUnbonded && closestDist < BOND_DIST) {
    const compat = compatibility(m, closestUnbonded);
    const griefThreshold = m.grieving > 0 ? GRIEF_BOND_THRESHOLD : COMPAT_BOND_THRESHOLD;
    if (compat > griefThreshold) {
      const compatMult = compat > COMPAT_FAST_FRIEND_THRESHOLD ? COMPAT_FAST_FRIEND_MULT : 1;
      m.bondTimer += dt * compatMult;
      if (m.bondTimer > BOND_TIME / bondStrength) {
```

If `compat <= griefThreshold`, the bond timer doesn't advance (visible failed bonding).

- [ ] **Step 3: Add rejection behavior**

In the social forces section, before the `closestUnbonded` tracking, add rejection logic:

```typescript
    // Rejection: low-togetherness motes repel approaching strangers
    if (!isBonded && dist < BOND_DIST && m.togetherness < REJECTION_TOGETHERNESS_THRESHOLD) {
      socialFx -= (dx / dist) * SOCIAL_ATTRACT_STRENGTH;
    }
```

- [ ] **Step 4: Add grief trigger to world.ts death processing**

In world.ts, inside the death processing loop (where `inheritFlash` is set), add after the inheritance block:

```typescript
      // Grief trigger: motes whose preferred companion just died
      for (const other of world.motes) {
        if (other.preferredMote === m && other.energy > 0) {
          other.grieving = GRIEF_DURATION;
          other.preferredMote = null;
        }
      }
```

Import `GRIEF_DURATION` from constants.ts in world.ts.

- [ ] **Step 5: Add event-driven drive spikes**

In world.ts, where `applyEvent` is called, add drive spikes for nearby motes when an event triggers:

```typescript
  // Event-driven drive spikes
  if (world.event && world.eventTriggered && world.time - world.event.startTime < 1) {
    for (const m of world.motes) {
      if (m.temperament.hardiness > BOLD_HARDINESS_THRESHOLD) {
        m.curiosity = Math.min(1, m.curiosity + EVENT_BOLD_CURIOSITY_SPIKE);
      } else {
        m.comfort = Math.min(1, m.comfort + EVENT_TIMID_COMFORT_SPIKE);
      }
    }
  }
```

Import the needed constants from constants.ts.

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 7: Commit**

```bash
git add src/mote.ts src/world.ts
git commit -m "feat: compatibility gating, rejection behavior, grief triggers"
```

---

## Workstream D: Bolder Page Design

### Task 15: Typography split — EB Garamond for narrative, mono for instruments

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `journal.html`

- [ ] **Step 1: Add EB Garamond to font imports in index.html**

Replace the existing Google Fonts `<link>` with:

```html
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Add serif CSS variable to style.css**

In the `:root` block, add:

```css
--serif: "EB Garamond", Georgia, "Times New Roman", serif;
```

- [ ] **Step 3: Update wordmark to be smaller, wider-spaced**

```css
#wordmark {
  font-family: var(--mono);
  font-weight: 400;
  font-size: clamp(0.75rem, 1.2vw, 0.9rem);
  letter-spacing: 0.35em;
  text-transform: uppercase;
}
```

- [ ] **Step 4: Switch headline to italic serif**

```css
.headline {
  font-family: var(--serif);
  font-weight: 400;
  font-style: italic;
  font-size: clamp(2rem, 5vw, 3.2rem);
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: clamp(1.5rem, 4vh, 2.5rem);
  position: relative;
  padding-top: 2rem;
}

.headline::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3rem;
  height: 1px;
  background: var(--accent);
}
```

- [ ] **Step 5: Switch body copy to serif**

```css
.body-copy p {
  font-family: var(--serif);
  font-weight: 400;
  font-size: clamp(1.05rem, 1.8vw, 1.2rem);
  line-height: 1.85;
  letter-spacing: 0.005em;
  color: var(--text-secondary);
  margin-bottom: 1.25em;
}
```

- [ ] **Step 6: Switch narrative text to italic serif**

```css
#narrative {
  font-family: var(--serif);
  font-style: italic;
  font-weight: 400;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 7: Strip interaction hint card styling**

```css
.body-copy .interaction-hint {
  font-family: var(--serif);
  font-style: italic;
  font-size: 1rem;
  color: var(--text-muted);
  background: none;
  border: none;
  border-radius: 0;
  padding: 0;
  display: block;
}
```

- [ ] **Step 8: Add EB Garamond to journal.html**

In journal.html's `<head>`, replace the Google Fonts link with the same one used in index.html. Add `--serif` variable to the inline `:root` block.

- [ ] **Step 9: Switch journal titles and reflections to serif**

Update journal.html inline styles:

```css
.entry-title {
  font-family: var(--serif);
  font-weight: 500;
  font-style: italic;
  font-size: 1.35rem;
  letter-spacing: 0;
  line-height: 1.3;
}

.entry-reflection {
  font-family: var(--serif);
  font-weight: 400;
  font-size: 1.05rem;
  line-height: 1.8;
}

.journal-header h1 {
  font-family: var(--serif);
  font-weight: 400;
  font-style: italic;
  font-size: clamp(1.6rem, 3.5vw, 2.2rem);
  letter-spacing: 0;
  text-transform: none;
}

.journal-header .subtitle {
  font-family: var(--mono);
  font-weight: 300;
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
```

- [ ] **Step 10: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 11: Commit**

```bash
git add index.html src/style.css journal.html
git commit -m "design: EB Garamond for narrative, mono for instruments"
```

---

### Task 16: Deep terrarium frame and glass vignette

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Replace frame styling with deep inset treatment**

Replace the existing `#frame` box-shadow and border:

```css
#frame {
  position: relative;
  width: min(94vw, calc((100dvh - 7rem) * 16 / 9));
  max-width: 2000px;
  aspect-ratio: 16 / 9;
  border: none;
  border-radius: 2px;
  box-shadow:
    inset 0 0 30px rgba(0, 0, 0, 0.5),
    inset 0 0 80px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 0 0 4px #0c0c0e,
    0 0 0 5px rgba(255, 255, 255, 0.03),
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 120px var(--frame-glow, rgba(220, 140, 80, 0.06));
  overflow: hidden;
  opacity: 0;
  animation:
    world-emerge 1.5s ease-out 0.1s forwards,
    frame-breathe 9s ease-in-out 2s infinite;
}
```

- [ ] **Step 2: Update glass vignette**

```css
#glass {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(
      170deg,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 30%,
      transparent 70%,
      rgba(0, 0, 0, 0.06) 100%
    );
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.35),
    inset 0 0 120px rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}
```

- [ ] **Step 3: Update frame-breathe animation**

Only animate the ambient glow, not the structural shadows:

```css
@keyframes frame-breathe {
  0%, 100% {
    box-shadow:
      inset 0 0 30px rgba(0, 0, 0, 0.5),
      inset 0 0 80px rgba(0, 0, 0, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.04),
      0 0 0 4px #0c0c0e,
      0 0 0 5px rgba(255, 255, 255, 0.03),
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 120px var(--frame-glow, rgba(220, 140, 80, 0.05));
  }
  50% {
    box-shadow:
      inset 0 0 30px rgba(0, 0, 0, 0.5),
      inset 0 0 80px rgba(0, 0, 0, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.04),
      0 0 0 4px #0c0c0e,
      0 0 0 5px rgba(255, 255, 255, 0.03),
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 160px var(--frame-glow, rgba(220, 140, 80, 0.12));
  }
}
```

- [ ] **Step 4: Nudge background warm and add accent-trace variable**

```css
:root {
  --bg: #0a0a0c;
  --accent-trace: rgba(220, 140, 80, 0.12);
  /* ... rest unchanged */
}
```

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 6: Commit**

```bash
git add src/style.css
git commit -m "design: deep terrarium frame with inset shadows and glass vignette"
```

---

### Task 17: Below-fold specimen data bar and journal specimen log

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `journal.html`

- [ ] **Step 1: Replace detail grid with specimen-data bar in index.html**

Replace the `<dl class="details reveal">` block with:

```html
<div class="specimen-data reveal">
  <span class="datum"><em>canvas</em> 256 &times; 144 px</span>
  <span class="datum"><em>dependencies</em> zero</span>
  <span class="datum"><em>cycle</em> 300 s</span>
  <span class="datum"><em>sound</em> generative</span>
</div>
```

- [ ] **Step 2: Remove the story divider**

Remove `#story::before` from style.css (delete the entire rule block).

- [ ] **Step 3: Add specimen-data styles, remove detail grid styles**

Remove the `.details`, `.detail`, `.detail dt`, `.detail dd` rules. Add:

```css
.specimen-data {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: clamp(2.5rem, 5vh, 4rem);
  padding: 1rem 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.datum {
  font-family: var(--mono);
  font-weight: 400;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 0.2rem 1.25rem;
  white-space: nowrap;
}

.datum:not(:last-child) {
  border-right: 1px solid var(--border);
}

.datum em {
  font-style: normal;
  color: var(--text-muted);
  margin-right: 0.6em;
}
```

- [ ] **Step 4: Update mobile breakpoint for specimen-data**

In the `@media (max-width: 700px)` block, replace the `.details` mobile rules with:

```css
.specimen-data {
  flex-wrap: wrap;
}
.datum {
  flex: 1 1 45%;
  border-right: none !important;
  padding: 0.4rem 0;
}
```

- [ ] **Step 5: Remove card styling from journal entries**

In journal.html, update `.entry`:

```css
.entry {
  border: none;
  border-radius: 0;
  background: none;
  padding: 0 0 clamp(1.5rem, 3vh, 2.5rem) 0;
  border-bottom: 1px solid var(--border-subtle);
  opacity: 0;
  animation: fade-up 0.6s ease-out forwards;
}

.entry:last-child {
  border-bottom: none;
}
```

- [ ] **Step 6: Update journal entry-files to subordinate footnote**

```css
.entry-files {
  font-family: var(--mono);
  font-weight: 300;
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.8em;
  padding-top: 0;
  border-top: none;
  letter-spacing: 0.02em;
  opacity: 0.6;
}
```

- [ ] **Step 7: Update journal entry-change to 2px border, serif font**

```css
.entry-change {
  font-family: var(--serif);
  font-weight: 400;
  font-size: 1rem;
  line-height: 1.75;
  color: var(--text-primary);
  padding: 0.6rem 1.2rem;
  border-left: 2px solid var(--accent);
  background: rgba(220, 140, 80, 0.03);
  border-radius: 0;
  margin-bottom: 1em;
}
```

- [ ] **Step 8: Tighten journal entries gap**

```css
.entries {
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 3vh, 2rem);
}
```

- [ ] **Step 9: Update journal entry-date opacity**

```css
.entry-date {
  opacity: 0.7;
}
```

- [ ] **Step 10: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

- [ ] **Step 11: Commit**

```bash
git add index.html src/style.css journal.html
git commit -m "design: specimen data bar, journal as field notes, remove cards"
```

---

## Final Verification

### Task 18: Full build verification and CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full clean build**

```bash
rm -rf dist node_modules
npm ci
npx tsc --noEmit
npx vite build
```

- [ ] **Step 2: Verify all new files exist and are importable**

```bash
ls src/constants.ts src/sound-config.ts src/sound-state.ts src/sound-events.ts src/sound-lifecycle.ts src/sound-weather.ts
```

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git status
# If clean, done. If not, stage and commit cleanup.
```
