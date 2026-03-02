# Mote

A procedurally-generated living pixel world. Tiny creatures emerge, form bonds, build settlements, and dissolve in synchronized 5-minute UTC cycles. Everyone watching sees the same world at the same time. CC0 / public domain.

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
├── main.ts          # Frame loop, rendering orchestration
├── world.ts         # Cycle clock, phase management, spawning
├── mote.ts          # Creature behavior, physics, bonding
├── terrain.ts       # Procedural landscape, tile map, biomes
├── physics.ts       # Spatial hash grid, cluster detection
├── sound.ts         # Web Audio synthesis, cluster-to-tone mapping
├── events.ts        # Rare event triggering & effects
├── interaction.ts   # Cursor force, click pulse
├── render.ts        # Canvas 2D pixel buffer
├── palette.ts       # 16-color palette, biome system
├── noise.ts         # Seeded Simplex noise
├── names.ts         # Procedural cycle naming
├── font.ts          # Bitmap font rendering
└── style.css        # Layout, glass frame, typography
```

## Build & Verify

```bash
npm ci
npx tsc --noEmit     # type-check
npx vite build       # production build
```

## Evolution Log

`public/evolution-log.json` is the project's persistent thinking journal. Each daily session reads it first to understand what's been done, what was considered, and what's worth exploring next. New entries are appended — never modified or deleted. The log also surfaces in the app at `journal.html` for humans to read.

The daily evolution prompt lives at `.claude/daily-evolve.md`. Read it for the full workflow.

## Design Constraints

- Zero runtime dependencies — everything is procedural code
- 256×144 pixel canvas, 5-minute cycle structure — these are sacred
- Deterministic: same cycle number must produce the same world for everyone
- Meditative, ambient, minimal UI — observation over interaction
- Changes should deepen existing systems, not bolt on new frameworks
- One focused change at a time — depth over breadth
