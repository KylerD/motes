# Mote — Comprehensive Design Spec

**Date:** 2026-04-01

**Scope:** Five workstreams that collectively transform mote from a beautiful screensaver into a living world people come back to.

1. **Mote inner life** — drives, memory, compatibility, grief
2. **Bolder page design** — field-station aesthetic for terrarium + journal
3. **Magic number cleanup** — centralize scattered constants
4. **Sound.ts refactoring** — break up the 2,461-line monolith
5. **Infrastructure** — replace GitHub Action with cron.md for mac mini

---

# Part 1: Mote Inner Life

**Problem:** Mote behavior is shallow. Three random floats bias a random walk. No memory, no goals, no state. The emotional weight comes from rendering and audio, not the creatures themselves.

**Goal:** Give motes observable inner life so that a viewer watching for 2-3 minutes can point to a specific mote and say "that one has a personality."

**Design principle:** The behavior IS the feature. Personality must be legible purely through movement, spatial choices, and social decisions on a 256x144 canvas.

## 1.1 Drive System

Replace implicit random-walk biasing with three explicit **drives** that fluctuate over time.

| Drive | Meaning | Target when dominant |
|---|---|---|
| **Comfort** | Safety, familiarity, stillness | Favorite position. Reduce speed. |
| **Curiosity** | Novelty, exploration, space | Away from favorite position. Unvisited terrain. |
| **Togetherness** | Specific companionship | Preferred companion. If none, nearest compatible mote. |

### Baseline mapping from temperament

Existing temperament floats (wanderlust, sociability, hardiness) set the resting point for each drive:

- `comfortBaseline = 0.3 + hardiness * 0.4`
- `curiosityBaseline = 0.3 + wanderlust * 0.4`
- `togethernessBaseline = 0.3 + sociability * 0.4`

### Drive fluctuation rules

Drives shift based on state, clamped to [0, 1]:

| Condition | Effect |
|---|---|
| Energy < 0.4 | Comfort += 0.15 * dt (scales with energy deficit) |
| Alone >5s (no neighbor within 28px) | Togetherness += 0.08 * dt |
| Bonded and stable >8s | Curiosity += 0.06 * dt (restlessness) |
| Rare event nearby | Bold motes (hardiness > 0.5): curiosity += 0.3. Timid: comfort += 0.3. |
| Preferred companion dies | Comfort = 1.0, togetherness drops to 0.1 (grief, see 1.4) |

All drives decay toward their baseline at rate `0.04 * dt` when no condition is active.

### Target selection

Each frame, compute a target position as a **weighted blend** of the three drive targets:

```
targetX = (comfort * favX + curiosity * exploreX + togetherness * companionX) / (comfort + curiosity + togetherness)
```

Where:
- `favX/favY` = favorite position memory
- `exploreX` = `m.x + m.direction * 40` (a point 40px ahead in current facing direction; if near edge, flip). Curiosity means "keep going forward."
- `companionX` = preferred companion's position if set, otherwise nearest compatible unbonded mote's position, otherwise ignored (weight falls to other drives)

The mote drifts toward targetX with noise from seeded RNG (small random offset each frame). Movement toward target replaces the random direction-flip. Direction is set to face the target rather than flipping randomly.

## 1.2 Memory

Three memory slots per mote. Total per-mote cost: 7 floats + 1 reference.

### Favorite position (`favX`, `favY`)

- Exponential moving average, updated every ~2s
- `favX += 0.15 * (currentX - favX)` (only when energy > 0.4)
- Initialized to spawn position
- Used by comfort drive as movement target
- Persists entire cycle

### Preferred companion (`preferredMote: Mote | null`)

- Set to the mote with the longest continuous bond
- Updates when a new bond outlasts the current preferred's bond age
- When preferred companion dies: triggers grief state
- Cleared on companion's death
- Used by togetherness drive: seek THIS mote over nearer alternatives
- The design-defining moment: a mote crossing the canvas to reach its preferred companion during dissolution

### Avoidance position (`avoidX`, `avoidY`, `avoidTimer`)

- Set when energy drops sharply (>0.15 loss in <2s) or rare event strikes nearby
- Adds repulsion vector steering mote away from this point
- `avoidTimer` counts down from 75s, position ignored after expiry
- Overwritten by more recent bad experiences

## 1.3 Compatibility & Bond Gating

### Compatibility formula

```
compat = 1.0
       - abs(m1.wanderlust - m2.sociability) * 0.5
       - abs(m1.hardiness - m2.hardiness) * 0.3
```

Result is ~0.2 to 1.0. Complementary temperaments (explorers + social motes) bond easily.

### Bond formation changes

- Bond timer only advances when `compat > 0.35`
- Above 0.7: bond timer advances at 1.5x (fast friends)
- Below 0.35: no bond forms, even with prolonged proximity

### Rejection behavior

When togetherness drive < 0.3 and an unbonded mote approaches within BOND_DIST:
- Add repulsion vector (same magnitude as current social attraction, reversed)
- Mote visibly turns away

Negative choices are more legible than positive ones at this resolution.

## 1.4 Grief as Behavior

### Trigger

Preferred companion's energy reaches 0 (death).

### Behavioral changes (duration: 18 seconds)

- Movement speed multiplied by 0.5
- Comfort drive forced to 1.0 (mote returns to favorite position)
- Togetherness drive drops to 0.1
- Bond formation requires `compat > 0.8` (nearly impossible to bond while grieving)
- `grieving` timer counts down from 18s

### Recovery

After grief timer expires:
- Speed modifier returns to 1.0
- Comfort drive released (decays toward baseline)
- Togetherness drive recovers at 0.03/s toward baseline over ~30s
- Bond threshold returns to normal 0.35

### Interaction with existing systems

- Existing color flashes (inheritFlash, mourningFlash) stay as visual reinforcement
- Cluster mourning stays (the brief flash for cluster members)
- The behavioral grief is for the preferred companion relationship only

## 1.5 File Changes

### types.ts — Mote interface additions

```typescript
// Drives (fluctuating 0-1)
comfort: number;
curiosity: number;
togetherness: number;

// Memory: favorite position
favX: number;
favY: number;

// Memory: preferred companion
preferredMote: Mote | null;

// Memory: avoidance
avoidX: number;
avoidY: number;
avoidTimer: number;

// State
grieving: number;       // countdown timer, 0 = not grieving
lonelyTimer: number;    // seconds since last neighbor within 28px
stableTimer: number;    // seconds bonded without change
lastEnergy: number;     // for detecting sharp energy drops
lastEnergyTime: number; // timestamp of lastEnergy sample
```

### mote.ts — updateMote restructuring

1. **Drive update** (~30 lines): Apply fluctuation rules, decay toward baseline
2. **Memory update** (~25 lines): Favorite position EMA, preferred companion tracking, avoidance detection
3. **Target selection** (~15 lines): Weighted blend of drive targets
4. **Movement** (~10 lines changed): Replace random direction-flip with target-seeking drift
5. **Social forces** (~5 lines added): Rejection repulsion for low-togetherness motes
6. **Bond formation** (~10 lines changed): Add compatibility gate
7. **Grief modifiers** (~10 lines): Speed reduction, drive overrides during grief

**Net addition:** ~100-120 lines. Some existing random-walk code is replaced, not just added to.

### world.ts — death processing

- When a mote dies: find all motes whose `preferredMote` references the dead mote
- Set their `grieving = 18`, `preferredMote = null`
- Existing death handling (inheritFlash, mourningFlash, etc.) unchanged

### render-motes.ts — minimal

- Optional: grieving motes render at 85% brightness (subtle dimming)
- No new effects required

## 1.6 Constraints

- **No behavior trees or state machines.** Drives produce emergent states.
- **No group dynamics beyond pairs.** Two-body interactions are the legibility limit at this resolution.
- **No learning or adaptation.** Personality is fixed at spawn. Drives and memories change; temperament doesn't.
- **No UI for internal state.** No thought bubbles, no drive meters. `?debug` could show drives later.

## 1.7 Determinism

All drive updates are pure functions of (current state, dt, seeded rng). Memory updates are state-triggered, not wall-clock-triggered. Motes are processed in array order (stable from seeded spawning). The exponential moving average uses a fixed alpha. No randomness outside the seeded PRNG.

---

# Part 2: Bolder Page Design

**Problem:** The landing page and journal look like a competent developer portfolio from 2024. Dark-mode monospace, zinc neutrals, amber accent, thin borders. The terrarium frame is timid — 1px border, barely-there glass effect. The journal reads as a blog, not a research document about a living world.

**Goal:** Make the page feel like a **field station for studying digital life** — a remote research station where a lone researcher monitors a terrarium under lamplight. Edward Tufte meets the American Museum of Natural History's invertebrate hall.

**Key emotion:** You've stumbled into someone's research station, and they've left the specimen running.

## 2.1 Typography

**Split the type stack:** EB Garamond (serif) for all narrative and observation text. IBM Plex Mono stays ONLY for instrument readings — cycle info, technical labels, file lists.

Google Fonts load:
```
family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@300;400;500
```

### Specific values

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Wordmark "mote" | IBM Plex Mono | `clamp(0.75rem, 1.2vw, 0.9rem)` | 400 | `letter-spacing: 0.35em; text-transform: uppercase` — engraved plate on equipment |
| Headline | EB Garamond | `clamp(2rem, 5vw, 3.2rem)` | 400 italic | `letter-spacing: -0.02em; line-height: 1.2` — chapter heading from a research monograph |
| Body copy | EB Garamond | `clamp(1.05rem, 1.8vw, 1.2rem)` | 400 | `line-height: 1.85` |
| Narrative text | EB Garamond | 0.95rem | 400 italic | `letter-spacing: 0.02em` — the researcher's murmured observations |
| Cycle info | IBM Plex Mono | 0.7rem | 400 | `letter-spacing: 0.1em; text-transform: uppercase` — readouts |
| Interaction hint | EB Garamond | 1rem | 400 italic | No background, no border — typography alone sets it apart |
| Journal entry title | EB Garamond | 1.35rem | 500 italic | Species designation feel |
| Journal reflection | EB Garamond | 1.05rem | 400 | `line-height: 1.8` |
| Journal files list | IBM Plex Mono | 0.7rem | 300 | `opacity: 0.6` — footnote citation |

The serif/mono split creates a visual language: **EB Garamond says "this is being observed and described"** while **IBM Plex Mono says "this is a measurement."**

## 2.2 Terrarium Frame

The canvas must feel recessed into the page — a viewing port into something alive, not an embedded video.

### Frame (`#frame`)

Replace the current 1px border + subtle shadow with a deep, physically-grounded treatment:

```css
#frame {
  border: none;
  border-radius: 2px;
  box-shadow:
    inset 0 0 30px rgba(0, 0, 0, 0.5),       /* depth: canvas sits below surface */
    inset 0 0 80px rgba(0, 0, 0, 0.25),       /* deeper ambient shadow */
    0 0 0 1px rgba(255, 255, 255, 0.04),       /* inner bevel highlight */
    0 0 0 4px #0c0c0e,                         /* thick dark bezel (the frame itself) */
    0 0 0 5px rgba(255, 255, 255, 0.03),       /* outer bevel highlight */
    0 20px 60px rgba(0, 0, 0, 0.5),            /* physical grounding shadow */
    0 0 120px var(--frame-glow, rgba(220, 140, 80, 0.06)); /* biome-reactive ambient bleed */
}
```

### Glass vignette (`#glass`)

Add a vignette that darkens edges and focuses attention to center — how real specimen cases and viewfinders look:

```css
#glass {
  background:
    linear-gradient(170deg,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 30%,
      transparent 70%,
      rgba(0, 0, 0, 0.06) 100%);
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.35),
    inset 0 0 120px rgba(0, 0, 0, 0.15);
}
```

### Breathing animation

Only the ambient glow changes — structural shadows stay stable:

```css
@keyframes frame-breathe {
  0%, 100% { /* glow at 120px, opacity 0.05 */ }
  50%      { /* glow at 160px, opacity 0.12 */ }
}
```

## 2.3 Below-Fold Story Section

### Kill the 2x2 detail grid

Replace with a horizontal **specimen-label bar** — a single row of technical facts separated by vertical lines, like the placard below a museum exhibit:

```html
<div class="specimen-data">
  <span class="datum"><em>canvas</em> 256 x 144 px</span>
  <span class="datum"><em>dependencies</em> zero</span>
  <span class="datum"><em>cycle</em> 300 s</span>
  <span class="datum"><em>sound</em> generative</span>
</div>
```

Monospace, 0.72rem, uppercase, separated by `border-right: 1px solid var(--border)`. Wraps to 2-col on mobile.

### Headline treatment

Italic EB Garamond with a 3rem amber dash above it (`::before` pseudo-element, `left: 0`). The asymmetric accent mark is a specimen-label detail.

### Kill the centered divider

Remove `#story::before` (the thin centered line between hero and story). Generous whitespace alone handles the transition.

### Interaction hint

Remove the card styling (background, border, border-radius). Set in italic EB Garamond — typography alone distinguishes it.

## 2.4 Journal as Specimen Log

### Remove card styling from entries

No `border`, no `border-radius`, no `background`. Use ruled lines and whitespace like pages in a field notebook:

```css
.entry {
  border: none;
  border-radius: 0;
  background: none;
  padding: 0 0 clamp(1.5rem, 3vh, 2.5rem) 0;
  border-bottom: 1px solid var(--border-subtle);
}
```

### Entry date as margin annotation

`font-family: mono; font-size: 0.7rem; opacity: 0.7` — recedes like a date stamp.

### Entry title as species designation

`font-family: 'EB Garamond'; font-style: italic; font-size: 1.35rem` — the name of what was observed.

### Entry reflection as researcher's note

`font-family: 'EB Garamond'; font-size: 1.05rem; line-height: 1.8` — written by someone watching.

### Keep the amber left-border on change blocks

This is the one structural element that works — it reads as "what was done" vs. the reflection's "what was observed." Switch inner font to EB Garamond, reduce `border-left` to 2px.

### Journal header

Title in italic EB Garamond (`clamp(1.6rem, 3.5vw, 2.2rem)`). Subtitle ("development log") stays mono, 0.75rem, uppercase, `letter-spacing: 0.15em`. The contrast between serif title and mono subtitle creates the tension of a real document.

## 2.5 Color

**Keep amber accent `#dc8c50`.** It reads as lamplight, specimen labels, aged paper, old brass instruments. Perfect for the field-station metaphor.

Nudge background slightly warm: `--bg: #0a0a0c`. Add `--accent-trace: rgba(220, 140, 80, 0.12)` for the headline dash and subtle highlights.

**Do not add more colors.** The palette is `{ near-black, zinc grays, amber }`. The canvas provides all the color the page needs. The chrome is a dark frame for a living painting.

## 2.6 Files Changed

- **index.html** — Replace `<dl class="details">` grid with `<div class="specimen-data">` bar. Update font link. Remove interaction-hint card markup.
- **style.css** — Typography split (EB Garamond vars), frame depth treatment, specimen-data styles, headline treatment, kill story divider, kill detail grid styles.
- **journal.html** — Add EB Garamond font link. Update inline styles: remove entry card styling, serif for titles/reflections, reduce files opacity.

---

# Part 3: Magic Number Cleanup

**Problem:** Behavioral tuning constants are scattered across mote.ts, world.ts, sound.ts as inline literals. `GRAVITY=60`, `BOND_DIST=20`, `rng() < 0.02 * dt * 60`, phase durations as raw arrays, sound thresholds buried in conditionals.

**Goal:** Centralize all tuning constants into config.ts (or a new `src/constants.ts` if config.ts should stay minimal).

## 3.1 Scope

### mote.ts constants to extract

```typescript
GRAVITY = 60
WALK_SPEED = 14
MAX_FALL = 60
JUMP_OVER = 4
BOND_DIST = 20
BOND_TIME = 1.2
MAX_BONDS = 3
NEIGHBOR_RADIUS = 28
```

Plus inline magic numbers:
- `0.02 * dt * 60` direction-change probability (line 164)
- Social force magnitudes: `4` (attraction), `30` (repulsion), `12` (comfort distance)
- Energy transfer rate: `0.05 + sociability * 0.04`
- Death-seeking force: `dp * sociability * 20`
- Bond break distance: `BOND_DIST * BOND_DIST * 6`
- Ancient bond threshold: `70` seconds
- Elder age: `20`, mature age: `8`

### world.ts constants to extract

- Phase durations array `[0.10, 0.20, 0.25, 0.25, 0.12, 0.08]`
- Phase params table (spawnRate, maxMotes, energyDecay, bondStrength per phase)
- Death record prune time: `7.5`
- Settlement interval: `3`
- Inherit radius: `55 + Math.min(25, m.age * 1.5)`
- Mourning intensity: `1.0` (direct) vs `0.55` (cluster)

### sound.ts constants

Defer to Part 4 — these get extracted during the refactor.

## 3.2 Approach

Create `src/constants.ts` organized by domain:

```typescript
// --- Physics ---
export const GRAVITY = 60;
export const MAX_FALL = 60;
// ...

// --- Mote behavior ---
export const WALK_SPEED = 14;
export const BOND_DIST = 20;
// ...

// --- Lifecycle ---
export const AGE_MATURE = 8;
export const AGE_ELDER = 20;
// ...

// --- Phases ---
export const PHASE_DURATIONS = [0.10, 0.20, 0.25, 0.25, 0.12, 0.08] as const;
// ...
```

Import from constants.ts in mote.ts, world.ts, and any other consumers. The local `const` declarations at the top of those files get replaced with imports.

## 3.3 What stays inline

- One-off rendering constants (pixel offsets, color blending alphas) that are only used in one place and would clutter the config
- CSS-related values
- Array indices and loop bounds

---

# Part 4: Sound.ts Refactoring

**Problem:** sound.ts is 2,461 lines — the largest file in the project by far. It contains biome profiles, scale systems, ambient generation, note triggering, weather audio, event sounds, and 15 WeakMaps for per-engine state. It works, but it's the most likely place for bugs to hide and the hardest file to evolve.

**Goal:** Break sound.ts into focused modules following the same pattern used for terrain (terrain-gen.ts / terrain-query.ts / terrain-render.ts).

## 4.1 Proposed split

| File | Responsibility | Approximate lines |
|---|---|---|
| `sound.ts` | Re-export barrel (backward compat), createSoundEngine, initAudio | ~100 |
| `sound-config.ts` | Biome profiles, scale definitions, voice configs, all tuning constants | ~300 |
| `sound-voices.ts` | Note triggering, cluster-to-tone mapping, harmonic enrichment | ~600 |
| `sound-ambient.ts` | Drone/texture generation, weather ambient, biome atmosphere | ~500 |
| `sound-events.ts` | Event sound signatures (eclipse, meteor, bloom, etc.) | ~400 |
| `sound-state.ts` | The 15 WeakMaps consolidated into a single `Map<SoundEngine, SoundState>` with a typed state interface | ~150 |
| `sound-milestones.ts` | Milestone detection and triggering (first bond, peak population, last survivor, etc.) | ~350 |

## 4.2 State consolidation

Replace 15 WeakMaps with one typed state object:

```typescript
interface SoundState {
  spawnCooldown: number;
  bondBreakCooldown: number;
  lastShimmer: number;
  lastMilestoneTime: Record<string, number>;
  // ... all 15 current WeakMap values
}

const engineState = new Map<SoundEngine, SoundState>();

export function getState(engine: SoundEngine): SoundState {
  let s = engineState.get(engine);
  if (!s) { s = createDefaultState(); engineState.set(engine, s); }
  return s;
}
```

## 4.3 Approach

- sound.ts becomes a thin barrel that re-exports the public API (same exports, no breaking changes)
- Each new file gets its own focused concern
- Constants from sound move to sound-config.ts (and shared ones to constants.ts from Part 3)
- The `?? -999` sentinel patterns get replaced with proper `SoundState` defaults

## 4.4 No behavioral changes

This is a pure refactor. Same audio output, same API surface, same deterministic behavior. The only change is file organization and the WeakMap consolidation.

---

# Part 5: Infrastructure — GitHub Action to cron.md

**Problem:** Daily evolution currently runs via a GitHub Action (`.github/workflows/daily-evolve.yml`) on ubuntu-latest. This works but has limitations: no persistent state between runs, limited to what GitHub Actions can do, no visual verification on real hardware.

**Goal:** Replace with `cron.md` at the repo root, run on a mac mini via Claude Code's `/loop` command. The agent gets full local access — persistent browser for screenshots, mac mini GPU, and the ability to push directly.

## 5.1 Changes

- **Delete** `.github/workflows/daily-evolve.yml`
- **Create** `cron.md` at repo root (already written — contains the invocation, workflow reference, and rules)
- `cron.md` delegates to `.claude/daily-evolve.md` for the actual creative workflow — it's a trigger, not a replacement

## 5.2 What cron.md does

1. `git pull --rebase origin main && npm ci`
2. Reads and executes the full `.claude/daily-evolve.md` workflow (quality analysis, screenshots, visual verification, implementation, AFTER verification, evolution log update)
3. Commits with `evolve: [description]` prefix
4. `git push origin main`
5. Cleans up capture artifacts

## 5.3 What stays the same

- `.claude/daily-evolve.md` is unchanged — it's the source of truth for creative mandate and workflow
- `.claude/quality-standards.md` is unchanged
- Evolution log format is unchanged
- Commit message format is unchanged

---

# Part 6: Explicitly Out of Scope

- **No behavior trees or state machines.** Drives produce emergent states.
- **No group dynamics beyond pairs.** Two-body interactions are the legibility limit at this resolution.
- **No learning or adaptation.** Personality is fixed at spawn.
- **No UI for internal state.** No thought bubbles, no drive meters.
- **No new canvas rendering effects.** The behavior is the feature (page design changes are CSS only).
- **No new npm dependencies.** EB Garamond loads via Google Fonts CDN.

---

# Part 7: The Emotional Test

The design succeeds if these moments emerge naturally:

1. **"That one has a personality"** — A viewer can distinguish a comfort-seeking mote from a curious explorer within 60 seconds
2. **"It chose that one"** — A mote passes nearby unbonded motes to reach its preferred companion
3. **"It said no"** — A mote visibly turns away from an approaching stranger
4. **"It remembers"** — A mote returns to the same hillside after wandering
5. **"It's grieving"** — After its partner dies, a mote slows, withdraws, returns to their shared place
6. **"The long walk"** — During dissolution, a mote crosses the canvas to reach its dying partner
7. **"This feels like a real place"** — The page design makes the viewer lean in, not scroll past
8. **"I want to read this"** — The journal feels like field notes from someone who was genuinely watching
