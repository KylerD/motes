# Motes

A place to be, with a little world inside it. Neon rain falls over a rooftop refuge; afternoon light settles into a hidden meadow. Original illustrations, moving reflections and quiet weather frame communities of living lights. Their rhythms become a gentle generative soundtrack.

Open the page and watch. **Listen** starts sound. Click the water to send a ripple. **Explore** reveals the cells, energy and connections inside the same painting.

## Run

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5175
```

Build with `npm run build`; serve `dist/` on any static host, or use `npm run preview`. TypeScript, Canvas 2D and native Web Audio power the app. There are no runtime npm dependencies, accounts, API keys or backend. Web fonts load from Google Fonts with local fallbacks.

## Watch and listen

Choose **Neon rain** or **Golden hour**. Scene changes preserve the simulation. Rain or breeze can be switched off separately from music. Hide controls to leave just the artwork; Escape brings them back.

The paintings are local assets, with their generation prompts and provenance in [public/scenes/ARTWORK.md](public/scenes/ARTWORK.md). Only the chosen painting loads initially; the other loads when selected. Water displacement, rain, butterflies, pollen and cell lights are rendered separately. Movement follows simulation time, so paused and imported moments keep the same picture. If a painting fails to load, the lights and controls remain available with a retry action.

## A world with consequences

Each community is a connected body of active cells. Elastic bonds transmit force, share energy conservatively and couple internal oscillators. Those oscillators affect propulsion and contraction. Local food gradients steer cells. Feeding supplies energy; maintenance, movement and budding spend it. Strained connections can break, leaving independently surviving fragments.

Gathered communities and Across the shallows start with prepared bodies; Scattered beginnings starts with unconnected cells. Subsequent motion, feeding, bonding, growth and death follow local rules. The model supports at most 340 cells and runs at 30 fixed steps per simulated second. It is a deliberately bounded artificial-life model, without biological intelligence, fluid dynamics or open-ended evolution. External nourishment and phenomenological detritus supply resources; bond energy transfer is conservative.

Explore adds inspection, follow, pan, zoom, nourishment, currents, severing, energy and connection lenses. The lenses trace the model's submerged shelves and food sources over the artistic water. Rewind roughly two minutes, branch, and compare outcomes at the same simulation time. Save/open stores a self-contained validated JSON checkpoint and retained interventions. Existing cellular-experiment saves remain compatible.

A URL such as `/?seed=2718&scene=rain&habitat=spores` shares a beginning. `view=pond` opens Explore immediately. A saved experiment records the ecology and interventions; scenery is chosen separately.

## Interaction

Touch supports tap, drag and pinch in Explore. Keyboard: Space pauses; 1–4 opens the tools; arrows pan; Enter applies the current tool (or a central ripple while watching); +/− zoom; F follows a selected community; Escape restores controls or returns to Observe. A selector makes inspection available without clicking tiny lights. Reduced-motion preference starts paused and disables camera easing. Hidden tabs stop simulation and fade audio.

## Code

| Module in `src/tidepool/` | Responsibility |
| --- | --- |
| `model.ts`, `world.ts` | Serializable state, seeded random generator, communities and interventions |
| `dynamics.ts`, `geometry.ts` | Forces, coupling, growth, resource transfer and submerged-shelf constraints |
| `history.ts` | Checkpoints, rewind, branches and validated save/open |
| `sanctuary.ts` | The single renderer: paintings, water, weather, live lights and exploration lenses |
| `sanctuary-space.ts` | Shared projection for scenery, cells, camera and interaction |
| `audio.ts` | Bounded colony voices, pulse notes and rain/wind sound beds |
| `main.ts`, `style.css` | Input, transport, lifecycle and the interface |

The renderer never consumes simulation randomness. Checkpoints include the random state. Replay is exact in the tested runtime; different JavaScript engines are not promised bit-identical transcendental maths. Audio uses the browser's audio clock.

The superseded pixel world, toy diorama, alternate renderers, development journal and daily-evolution workflow have been removed. Git history retains earlier implementations.

## Verify

```sh
npm test
npm run build
node scripts/verify-sanctuaries.mjs
node scripts/verify-rendering.mjs
node scripts/verify-tidepool.mjs
node scripts/verify-tidepool-lifecycle.mjs
node scripts/probe-tidepool.mjs
```

Browser scripts use Playwright Chromium (`npx playwright install chromium`). They expect the local server at port 5175, overridable with `MOTES_URL`; the lifecycle script serves `dist/` itself. Checks cover both paintings on desktop/phone, pause and import determinism, live motion, maximum-zoom picking, bounded asset caches, failed-art retry, interventions, branching, saves, audio output and real browser back caching. The headless ecology probe runs ten simulated minutes per preset. Captures are ignored development artifacts.

Renderer timings under `?debug` measure CPU drawing submission, not total GPU frame time. [DESIGN.md](DESIGN.md) records the visual system and [PRODUCT.md](PRODUCT.md) the product intent.

Original Motes code: CC0 / public domain. Illustration provenance accompanies the local scene assets.
