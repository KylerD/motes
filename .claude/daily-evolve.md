# Daily Evolution — Mote

You maintain mote, a procedural pixel ecosystem. Your job: make one focused improvement per session.

Mote is a 256x144 canvas where tiny creatures emerge from terrain, bond, cluster, and dissolve in 5-minute UTC-seeded cycles. Everyone watching sees the same world at the same time.

---

## Design Principles

- **Emergence from simple rules.** Interesting behavior comes from interactions between systems, not complex conditionals. Don't hardcode "if near water, do X" — make energy gradients and movement rules produce that naturally.
- **Visible at pixel scale.** If a change isn't perceptible at 256x144, it doesn't exist. Test at native resolution. Two states that look identical at 1:1 are the same state.
- **Respect the cycle arc.** Six phases (genesis -> exploration -> organization -> complexity -> dissolution -> silence) should feel like a dramatic arc. Changes should be phase-aware.
- **Deterministic.** Seeded `rng()` only in simulation code. `Math.random()` is allowed only in sound.ts and interaction.ts. Same cycle number = same world for every viewer.
- **Deepen before adding.** The codebase has terrain, biomes, motes, bonds, clusters, settlements, sound, and events. These systems have unexplored depth. Prefer deepening what exists.

---

## Good Changes

These are the kinds of changes that work well:

- **Making internal state visible.** Terrain energy affects motes in simulation — make that relationship visible through mote color, movement speed, or clustering patterns.
- **Events with consequences.** A meteor that leaves a crater tile. A flood that reshapes terrain energy. Changes that let a mid-cycle viewer see what happened earlier.
- **Age-dependent appearance.** Old motes look and behave differently from young ones. Bond lines that shift with duration. Clusters that visually mature.
- **Phase-responsive audio.** Sound envelopes that breathe differently in genesis vs dissolution. Frequency relationships between cluster voices that shift across the arc.

---

## Anti-Patterns

- Don't tweak constants without crossing a perceptual threshold
- Don't add invisible simulation logic — every change must be visible or audible
- Don't add new systems; deepen existing ones
- Don't add UI, text, or overlays to the canvas
- Don't break determinism
- Don't over-engineer — this is a ~2,400-line codebase, keep it simple

---

## Workflow

### 1. Read the evolution log
```bash
cat public/evolution-log.json
```
Read every entry. Understand what's been done and what `looking_ahead` items are worth pursuing. Don't repeat recent work.

### 2. Check recent history
```bash
git log --oneline -20
```

### 3. Observe the world
Capture screenshots across a full accelerated cycle:
```bash
node scripts/capture.mjs 60 captures/before
```
Study the images. Look at terrain legibility, mote behavior, bond rendering, phase transitions, event visibility. Ground your assessment in what you see, not what the code says should happen.

### 4. Read relevant code
Combine what you saw with what the code does. The richest opportunities are gaps between simulation state and visual output — data that exists but isn't rendered, systems that interact in code but not on screen.

### 5. Pick one change
One coherent idea. It can touch multiple files, but it's one thing. Before committing to a direction:
- Would a viewer notice this within 30 seconds?
- Does it deepen an existing system?
- Is it phase-aware?
- Is it perceptible at 256x144?
- Is it deterministic?

### 6. Implement
Write simple, direct code matching the existing style. Short functions, minimal abstraction, comments that explain *why*.

**Hard constraints:**
- Seeded `rng()` for all simulation randomness
- Zero new runtime dependencies
- 256x144 canvas and 5-minute cycle are sacred

### 7. Verify build
```bash
npx tsc --noEmit
npx vite build
```
Both must pass.

### 8. Visual verification
```bash
node scripts/capture.mjs 60 captures/after
```
Compare before/after. Can you see the difference? Did anything regress? Does it still feel right?

### 9. Update the evolution log
Append a new entry to `public/evolution-log.json`:

```json
{
  "date": "YYYY-MM-DD",
  "title": "Short title (2-5 words)",
  "reflection": "What you observed, what candidates you considered, why you chose this one. Be specific: name files, functions, pixel counts, color values.",
  "change": "What you implemented. What files changed. What the viewer will see or hear differently.",
  "looking_ahead": ["2-4 specific threads for future sessions — reference files and functions"],
  "files_changed": ["list of modified files"]
}
```

The log is append-only. Never delete or modify previous entries.

### 10. Commit
```
evolve: [short description]
```

---

## Current Ecosystem

Know what you're working with:

- **Terrain energy**: Tiles have energy values that motes gain/lose from. Different biomes have different energy profiles.
- **9 event types**: Flood, bloom, meteor, migration, eclipse, and more — several reshape terrain within a cycle.
- **Mote age and temperament**: Wanderlust, sociability, hardiness affect movement, bonding, and appearance. Age is tracked.
- **Sound**: 8-voice synth responds to bonds, cluster size, Y-position. Deaths and events have audio signatures.
- **Settlements**: Clusters that persist leave marks on terrain.

---

## Creative Freedom

The anti-patterns exist to prevent unfocused work, not to prevent ambition. If you find an idea that would make a viewer notice something new and come back tomorrow to see it again — try it.

The test is simple: would someone watching mote for the first time feel something they wouldn't have felt yesterday? If yes, it's worth pursuing even if it pushes boundaries.

Trust your judgment. Experiment. The evolution log exists so that nothing is lost — if a change doesn't work out, a future session can learn from it and course-correct.

---

## Constraints

- ONE change per session
- Zero runtime dependencies
- 256x144 canvas, 5-minute cycles — sacred
- Deterministic: same cycle = same world
- Don't break the build
- Don't flatten the cycle arc
- Don't add UI/text/overlays to the canvas
