# Motes

A little world to unwind in. Soft pixel creatures wander a dusk-blue pond, share nourishment and find rhythms together. Their rhythms become a gentle, generative soundtrack. Everything in the pond is drawn and synthesised by code.

Open the page and watch. Press **Listen** for sound. **Explore** reveals the artificial-life experiment beneath the cosy surface.

## Run

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Production is a static Vite build: `npm run build`, then `npm run preview`. No account, API key, backend or runtime package is required. Web fonts load from Google Fonts, with local fallbacks.

## A world with consequences

Each creature is a connected body of active cells. Elastic bonds transmit force, share energy conservatively and couple internal oscillators. Those oscillators change propulsion and contraction, so a shared rhythm affects how the body moves. Local food gradients steer cells. Feeding supplies energy; maintenance, propulsion and budding spend it. Connections can break under strain, and fragments continue with whatever cells they retain.

The moonlit pond and little crossing start with prepared bodies. Scattered beginnings starts with unconnected cells. These are initial conditions, not animation paths. There is no timed ending, guaranteed survivor or scripted recovery.

The model is deliberately small and stylised: 340 cells maximum, 30 fixed steps per simulated second, simple active-particle physics and an externally nourished habitat. It does not simulate biological intelligence, true fluid dynamics or open-ended evolution. Detritus is a phenomenological resource source; only bond energy transfer is strictly conservative.

## Watch, listen, explore

- Meet and follow a creature; zoom and pan around the pond.
- Listen to up to five colony voices: mellow tones and electric-piano-like overtones respond to energy, position, pulse and coherence. Audio starts only after Listen; volume and mute remain available.
- Place nourishment, stir a local current or sever real connections.
- Reveal energy or bonds. Rewind roughly two minutes, branch, and compare the original future at the same simulation time.
- Save a self-contained JSON experiment and open it later. Saves contain a checkpoint plus retained interventions, rather than a recording of pixels or audio. A seed URL reproduces a beginning: `/?seed=2718&habitat=reef`.

Touch supports tap, drag and pinch. Keyboard: Space pauses, 1–4 selects tools, arrows move the view, Enter applies a tool at its centre, +/− zoom, F follows the selected creature, Escape returns to Observe. A selector makes inspection accessible without clicking a tiny cell. Reduced-motion preference starts paused and disables camera easing. Hidden tabs pause simulation and fade sound.

## Code map

| Module | Responsibility |
| --- | --- |
| `src/tidepool/model.ts` | Serializable state, constants, deterministic random generator |
| `world.ts` | Prepared habitats, connected components, normalised interventions |
| `geometry.ts` | Shared obstacle and habitat constraints |
| `dynamics.ts` | Forces, coupling, resource uptake, growth and death |
| `history.ts` | Checkpoints, rewind, independent branches, validated import/export |
| `render.ts` | Procedural pixels drawn from actual model state |
| `audio.ts` | Bounded Web Audio voices and pulse-triggered notes |
| `main.ts`, `style.css` | Input, frame loop and quiet interface |

The renderer never consumes simulation randomness. A saved checkpoint includes the random state. Replay is exact in the tested runtime; different JavaScript engines are not promised bit-identical transcendental maths. Audio uses the browser audio clock and is not part of deterministic replay.

## Verify

```sh
npm test
npm run build
node scripts/probe-tidepool.mjs
node scripts/verify-tidepool.mjs
node scripts/verify-tidepool-lifecycle.mjs
```

The browser smoke script expects a server at `http://127.0.0.1:5175`; override with `MOTES_URL`. It checks desktop and touch layouts, controls, branching, saves, audio and the original route. The lifecycle check serves `dist/` itself and exercises real browser back caching, pinch gestures and keyboard input. Playwright Chromium must be installed (`npx playwright install chromium`). Captures and probe results go into ignored `captures-cozy/`.

The original 256×144, five-minute pixel world is preserved at `/original.html`; its documentation is [here](docs/original-world.md). The new art direction is documented in [DESIGN.md](DESIGN.md), with product intent in [PRODUCT.md](PRODUCT.md).

CC0 / public domain.
