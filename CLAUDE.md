# Motes development

The default experience is now the cosy cellular pond in `src/tidepool/`, entered through `index.html`. Read `README.md`, `PRODUCT.md` and `DESIGN.md` for its architecture and intended personality. It is a fixed artificial-life artwork to watch and listen to, with optional causal exploration. There is no required daily development workflow.

Keep the headless model deterministic, render from real state without consuming simulation randomness, validate imported experiments before replacing the current state, and keep audio opt-in. Preserve comfortable watching as the default; disclose detailed instruments through Explore. Run `npm test` and `npm run build`, then the appropriate browser scripts after interaction changes.

The following architecture describes the preserved original at `original.html`, not the new default. Its old constraints apply only to that route. CC0 / public domain.

## Architecture

- **Canvas**: 256×144 pixels, nearest-neighbor upscaled
- **Cycle**: 300 seconds, seeded from UTC time. 6 phases: genesis → exploration → organization → complexity → dissolution → silence
- **Motes**: Autonomous agents with temperament (wanderlust, sociability, hardiness), energy, up to 3 bonds each
- **Terrain**: Simplex noise heightmap, 12 tile types, 5 biomes
- **Sound**: 8-voice Web Audio synth — largest bonded clusters become voices, pitch from Y position, waveform from cluster size
- **Events**: ~2% of cycles trigger a rare event (flood, bloom, meteor, migration, eclipse)
- **Interaction**: Hover attracts motes, fast swipe scatters, click energizes

## Source Layout

```
src/
├── config.ts          # Universal constants: W, H, CYCLE_DURATION
├── types.ts           # All shared interfaces and the Tile const enum
│
├── main.ts            # Thin orchestrator: init + frame loop (~160 lines)
├── world.ts           # Cycle clock, phase management, mote spawning
├── narrative.ts       # Ambient story text system
│
├── constants.ts       # Centralized tuning constants
├── mote.ts            # Creature behavior, physics, bonding
├── physics.ts         # Spatial hash grid, cluster detection
├── events.ts          # Rare event triggering & effects
├── interaction.ts     # Cursor force, click pulse
│
├── terrain.ts         # Re-export barrel (backward compat)
├── terrain-gen.ts     # Procedural landscape generation, biomes
├── terrain-query.ts   # getSurfaceY, getTile, placeSettlement
├── terrain-render.ts  # Terrain + sky rendering
│
├── weather.ts         # Weather data/state + re-exports render fns
├── weather-render.ts  # Celestial, clouds, particles, lightning, fog
│
├── render.ts          # Canvas 2D pixel buffer, setPixel, drawLine
├── render-motes.ts    # Mote sprite drawing, color computation
├── render-effects.ts  # Eclipse, aurora, meteor, vignette, phase flash
├── render-bonds.ts    # Bond lines, cluster glow, death particles
├── render-ui.ts       # Cursor, ripples, event message, debug overlay
│
├── palette.ts         # 16-color palette, biome system, hsl2rgb
├── noise.ts           # Seeded Simplex noise
├── rng.ts             # Mulberry32 PRNG
├── names.ts           # Procedural cycle naming
├── font.ts            # Bitmap font rendering
├── sound.ts           # Core audio engine, init, main update loop, re-exports
├── sound-config.ts    # Biome profiles, scales, phase audio parameters
├── sound-state.ts     # Per-engine state management (typed SoundState)
├── sound-events.ts    # Event sounds, phase transitions, cascade, birds
├── sound-lifecycle.ts # Bond, death, mourning, cluster sounds
├── sound-weather.ts   # Weather ambient, dissolution rain, thunder
└── style.css          # Layout, glass frame, typography
```

## Build & Verify

```bash
npm ci
npx tsc --noEmit     # type-check
npx vite build       # production build
```

## Original archive

`public/evolution-log.json` and `journal.html` preserve the earlier project's development history. Existing entries remain intact.

`.claude/daily-evolve.md` records the previous workflow and is not required for the new pond.

## Original route constraints

- Zero npm runtime dependencies — browser APIs (WebGL, Web Audio, Canvas 2D) are encouraged
- 256×144 pixel canvas, 5-minute cycle structure — these are sacred
- Deterministic: same cycle number must produce the same world for everyone
- Emotionally compelling — the experience should make people stop, watch, and come back
- Ambitious evolution — push rendering, sound, and creature behavior toward what's mesmerizing, not merely functional
