# Goal

**Become the place people leave open instead of a lofi YouTube stream, and keep them coming back.**

Motes wins when someone who arrived from a friend's clip is still listening a month later. Virality brings them; the ritual, new places and the music keep them. Everything below exists to make that measurable, so each change can be kept or reverted on evidence.

Written 2 October 2026 from two rounds of research (listening habits, who captures the demand, comparable products, virality case studies, asset pipelines, rendering stacks, open source and modding, metrics). Key sources are listed at the end.

## The number

**Weekly Engaged Listeners (WEL):** distinct browsers that build up at least 20 minutes of audible Motes listening in a local Monday–Sunday week. Audible means a running AudioContext with music gain above zero.

- The browser keeps only the current week key and minute count locally. When the count crosses 20 minutes it sends one anonymous `engaged_week` event. No identifier leaves the browser.
- It counts people, not hours, so a tab left open overnight can't inflate it. Viral arrivals raise it only if they settle; staying power keeps it up.
- Revisit the 20-minute threshold after four weeks of data, at the point where four-week retention bends.

### Targets

| By | WEL (commit / stretch) | Engaged W4 retention | Also |
| --- | --- | --- | --- |
| Weeks 0–4 | Measure the baseline | Measure | Analytics live, gates below passing |
| 31 Jan 2027 | 2,000 / 10,000 | ≥ 10% | Listen-start ≥ 50% of arrivals |
| 30 Apr 2027 | 7,000 / 30,000 | ≥ 15% | Share loop K ≥ 0.2 |
| 31 Oct 2027 | 25,000 / 100,000 | ≥ 20% | Returning listeners ≥ 50% of listening hours |

The commit tiers match comparables that survived. lofi.co closed at about 26k monthly users. lofi.cafe gets about 70k visits a month and lofi.town and studywithme.io about 240–270k. Flocus gets about 530k, which is where the stretch tier points. Amplitude's top media products keep 13.4% of users at three months.

- **Viral** means a week with 10× baseline arrivals, at least 40% of them attributed to shares or our ref links, or a measured K of 0.5 or more for two weeks.
- **Staying power** means engaged cohorts flatten (W4 ≈ W8) at 15% or more for three consecutive cohorts, and WEL holds 30% of a spike's peak eight weeks later.

### Inputs we pull

1. **Arrivals by source.** Every URL we hand out carries `ref`; share links use `ref=share`.
2. **Listen-start rate:** listen starts per arrival.
3. **Settling:** the share of first sessions that reach 20 minutes, and the share that reach the settled evening (about 50 minutes).
4. **Return:** W1→W4 retention of engaged cohorts. The browser sends a `weeks_since_first` bucket (0, 1, 2, 3, 4+), so there are still no IDs.
5. **Share loop:** shares and clip exports per 100 WEL × arrivals per share × listen-start rate.

### Guardrails

These must not get worse while we climb:

- **Reliability:** audio or sample failures in under 1% of sessions; JavaScript errors per session.
- **Early quits:** pause or close within two minutes of Listen.
- **Speed:** phone p75 LCP under 2.5 s.
- **Accessibility:** zero serious accessibility violations.
- **No pressure:** no autoplay, nags, streaks or scores.
- **Event volume:** inside the analytics free tier. Send milestone events only (start, 5, 20 and 60 minutes, share), never per-minute heartbeats.

**Analytics:** PostHog in cookieless mode, or self-hosted Umami. Plausible and Vercel can't see background-tab listening or cross-day return. Cloudflare has no custom events. WEL keeps a week counter in localStorage, which ePrivacy Art. 5(3) covers. Checked on 7 Oct 2026: it isn't strictly necessary, so Motes relies on the audience-measurement exemptions (France, the Netherlands, UK PECR Sch A1 since 5 Feb 2026): clear notice on How Motes is made, a simple opt-out there, and a thirteen-month record that is never extended. Germany has no such exemption; only a consent gate would cover it, which the no-nags guardrail rules out. Revisit if the Digital Omnibus adds an EU-wide exemption.

## The offline score Claude climbs between releases

Online numbers move slowly and need traffic. Between releases, every change is scored on a branch against `main`:

- `npm run score` runs the build, unit tests and gates G2 (in both music styles), G3, G5 and G6.
- `npm run score -- --full` adds the browser and audio verify suite (G1, G4).
- `--detail` splits CPU between the picture and the music.
- `--strict` exits non-zero when a gate fails.

Results go to `captures/score.json`. The YouTube reference is cached per machine for 14 days, and only ad-free ten-second windows count, because ads cost more and would flatter Motes.

### Gates

A change can ship only if every gate passes.

| Gate | Pass when | Before (`main`, 2 Oct 2026) | Now (`feat/hillclimb-phase-0`) |
| --- | --- | --- | --- |
| G1 Correctness | `npm test`, `npm run build` and the verify scripts in README.md pass | Passing | **Pass** |
| G2 Lightness | CPU while listening ≤ a YouTube lofi live tab on the same machine (ratio ≤ 1.0) | 94% of a core at 240 fps vs YouTube 33%, **ratio ≈2.8** | Lofi 21.6% at 35 fps, **ratio 0.65**; synthwave 24.6%, **ratio 0.75: pass** (`perf/synthwave-cpu`, 5 Oct). The same day, `main` measured 0.75 lofi and 1.82 synthwave. With the finish (9 Oct): lofi 0.78, synthwave 0.91, and in a 2560×1440 window on the full painting tier 0.78–0.99 across four runs on a busy machine: **pass, with the full tier close to the line**. |
| G3 First load | First painting ≤ 350 KB, on screen within 2.5 s on a phone with slow 4G and a 4× slower CPU | 2.4–2.8 MB PNG per painting | 153–169 KB AVIF (the finished base tier, 9 Oct), on screen at 1.86–1.99 s: **pass** |
| G4 Audio health | Existing mix and synthwave checks pass, true peak ≤ −1 dBTP, no dropouts, voices bounded | Passing | **Pass** (5/5) |
| G5 Accessibility | Zero serious or critical axe violations on desktop and phone, with every panel open | Not automated | **Pass** |
| G6 Shareable | Every page has a preview card; a working share action; clip export makes a valid 15 s vertical video | 0 of 3 | Preview cards 5/5 pages, a share action, and clip export (15 s vertical H.264/AAC, checked for every place): **pass** |

Measured on a Ryzen 9 9950X with Chrome 154 and a 240 Hz display, at a 1280×720 window (G2 also at 2560×1440) with sound muted; last run 9 Oct 2026. G3 uses its own marker (`motes:painting`) because LCP can't see a canvas.

### Judged dimensions

These count only when all gates pass. Each is pairwise against `main`.

- **S1 Picture.** Screenshots at listening minutes 0, 20, 40 and 60 for every place, on desktop and phone.
  - Judges are vision-language models from two different model families, each shown the pair in both orders; only a consistent win counts.
  - Each dimension gets its own judge: cosiness, believable evening, a human touch in the art, and legible controls.
- **S2 Clip.** The 15 s arrival-to-evening timelapse for every place, judged the same way: "would you stop scrolling?". It is also compared with a frozen reference set of competitor frames.
- **S3 Music.** Fixed seeds × style × timbre, rendered to audio, including the quietest passages.
  - Meta's Audiobox Aesthetics scores for content enjoyment and production quality, as the mean and the worst decile.
  - Drift against a frozen set of approved Motes renders: CLAP-embedding Fréchet Audio Distance, sample-size-corrected (FAD∞).
  - A diversity floor, so songs can't collapse onto one loop.

### Keeping the score honest

- A model judge counts only after it agrees with Kyle on at least 75% of 30–50 hand-labelled pairs.
- Each week Kyle blind-compares five pairs, and that result overrides the judges.
- Held-out seeds and a held-out judge are used only at phase exits.
- Retire any eval that saturates.
- The offline score decides whether a change may ship. WEL and early quits decide whether it stays.

## How we climb

1. Pick the input or gate with the largest gap.
2. State the hypothesis in the PR description: the change, the metric it should move, and by how much.
3. Build on a branch and run `npm run score`. Ship only if every gate passes and no judged dimension regresses.
4. After at least seven days, read the online metric, then keep or revert. Record the outcome in the PR rather than a journal file.
5. When a phase exit is reached, update the baselines in this file.

Run the loop in deliberate weekly sessions. CLAUDE.md rules out daily repository automation.

## Decisions this goal rests on

### Rendering: a GPU painting compositor, not a game engine

The instinct is right: GPU rendering opens up dynamic light, weather, camera movement, many places and mods. A full game engine is the wrong way to get it.

- **Size and support.** Unity and Godot web builds weigh several megabytes, and Godot's web export has no WebGPU.
- **Testing.** Both render into opaque wasm canvases, which breaks our Playwright verification.
- **The competitor.** Lofi Cities, the most direct competitor, uses plain Canvas 2D. Engines don't win this category.
- **The choice: three.js with the WebGL renderer and plain GLSL.** It adds about 194 KB gzipped and reaches the most browsers. It is also the stack coding agents know best: 22M weekly downloads and an `llms.txt`.
- **What it does.** One full-screen shader pass composes the arrival and evening paintings, masks, water that samples the composite, colour grade, and the coastal sun with its reflection. Rain, snow and fireflies become GPU particles. Canvas 2D stays as the fallback.
- **What it unlocks, using depth, normal and layer maps per place:**
  - parallax camera drift;
  - rain at the right depth;
  - pools of lamp light;
  - a procedural sky inside the sky mask;
  - optional glTF props such as the train and boat.

  The authored evening paintings stay as keyframes. Painted-in sun direction can't be moved convincingly with procedural light.
- **Engine places are the art plan** (see Assets). Prove them with one place before committing. Move to WebGPU only when we need GPU compute.
- **Lightness comes first, before any migration.**
  - Done in Phase 0:
    - the 30 fps frame budget (`src/scenes/frame-budget.ts`), with Still and unchanged pictures left undrawn;
    - AVIF/WebP paintings.

    Together these took CPU from about 94% to about 37% of a core.
  - Profiling on 3 Oct showed the "music" share wasn't the audio graph. The hour's 2 px progress strip had a 650 ms CSS transition and was updated every 700 ms, so the compositor ran at the display rate (240 Hz here) for as long as music played. Removing the transition took listening from about 36% to 20% of a core, and listening with Still from 25% to 5%.
  - Synthwave was brought inside the gate on 5 Oct (ratio 1.82 → 0.75 on the same day's measurements; listening CPU 60% → 25% of a core), and `npm run score` now measures both styles. Offline renders under-counted the live cost, so each step was checked in a live tab:
    - Each pluck had its own 16-node echo chain and stayed alive for three beats of repeats. Notes at one tempo now share one echo, which sums identically (−111 dB difference), and voices end with their dry release.
    - Every scheduled voice costs CPU from scheduling until it ends. A visible tab now schedules 2.5 s ahead instead of 6; a hidden tab still keeps 6, extended the moment it is hidden. Voices at one level share a mix and centred bass and kick skip their panner, again sample-identical.
    - Live, the browser convolves in short blocks, so the 5.2 s hall was most of what remained: about 15% of a core for the radio alone, against 6% without it. It now keeps the first two seconds, level-compensated; the rest of the decay was 0.55% of its energy. Octave bands of rendered songs match `main` within 0.03 dB.
    - Blending each triangle into its detuned sawtooth (two oscillators instead of four) saved a quarter of offline render time but nothing measurable live, and deepened momentary dips at pad chord changes, so it was not kept.
  - Next: the GPU compositor.

### Assets: made by the engine, not commissioned

The art is the product, and this audience attacks AI art first. Lofi Cities' top criticism was "no human touch", and its creator says "I use AI for the images and video loops". All eight current paintings came from an image-generation tool. Under the US Copyright Office's 2025 guidance, prompt-only images are unlikely to be copyrightable, so they're both a risk and weak IP.

Kyle's direction (3 Oct 2026): **new places must not depend on commissioning artists or any one individual.** The pipeline has to be something Kyle and Claude can run themselves, and that is what the engine is for.

- **An engine place** is a three.js scene authored as code and data:
  - stylised geometry, built procedurally or blocked out and modelled through Claude + Blender MCP;
  - procedural and generated textures;
  - a painterly, non-photorealistic look: toon light ramps, painted-texture shading, soft outlines, a brush (Kuwahara-style) post-filter and paper grain.

  Evening, weather, lamps and water become live light rather than two keyframe paintings, and parallax drift, depth-correct rain and moving props come with it.
- **Why it answers the criticism.** The final pixels come from Motes' own renderer, not an image model. The look stays consistent across places, and the work is protectable as code and data. AI still helps with textures and blockouts; the "How Motes is made" page says so plainly.
- **The risk is the look.** The September three.js storybook pond was dropped for looking toy-like, and PRODUCT.md rules out "toy-like procedural geometry". So an engine place has to earn its way in:
  1. Build one, starting with the rooftop rain garden, whose water, rain, neon and lamp-lit shelter exercise the shaders most.
  2. Judge it pairwise against the current painting, with the S1 judges and Kyle's blind comparison at listening minutes 0, 20, 40 and 60.
  3. Adopt it only if it wins on cosiness and believable evening without losing on human touch. Otherwise iterate the look before building more places.
- **After adoption:** about one new place a month as a place pack, directed by Kyle and built by Claude, with no commissions.
- **Until then** the current paintings stay, with their prompts kept as provenance in `art/scenes/ARTWORK.md`.
- **Seasonal editions use authored paintings** (Kyle, 7 Oct 2026). The first Halloween build drew pumpkins over the paintings in code and was rejected as stickers. Each place now has a composition-matched Halloween pair, made with the same image tool as the current paintings and recorded in `ARTWORK.md`. Never draw recognisable objects over the art in code; light, weather and small distant silhouettes stay in code.
- **Check every model and tool licence** used for textures, depth or masks. Depth Anything V2 Base, Large and Giant, and Depth Anything 3 Large and Giant, are non-commercial; Marigold code and Qwen-Image-Layered are Apache-2.0.

Don't use AI video on the core art (it's heavy, drifts and can't follow the music) or pixel art (the look Lofi Cities was attacked for).

### Source: open code, reserved identity

Adopted on 3 Oct 2026: `LICENSE` (AGPL-3.0), `src/music/LICENSE` (MIT), `TRADEMARKS.md`, `CONTRIBUTING.md` and the README's licence section. Still to do: file the trademark and set up the CLA. A licence barely moves consumer virality: Wordle, Townscaper and Wallpaper Engine all won while closed. So openness is for distribution and credibility, and identity is the moat.

- **Music engine (`src/music/`), and later the place-pack format and validator: MIT, released as an embeddable package.** This is the Hacker News hook ("the music is composed live — here's the engine"). It also gives Excalidraw-style reach: streams, games and sites embed Motes radio with a credit line.
- **App, renderer and session planner: AGPL-3.0.** Code published up to `abf0a44` stays CC0 as already declared. Outside contributions need a CLA so a paid desktop build stays possible. Move to FSL only if a paid build becomes core revenue and someone clones the code.
- **Reserved:**
  - the Motes name and logo (file the trademark; `TRADEMARKS.md` asks forks to rename);
  - the flagship places, their masks, evening arcs and authored themes;
  - Steam-only extras;
  - any hosted place-building service.

### Modding: yes, in stages, data only

Mods are how Motes gets staying power without a big team. In a GameDiscoverCo study of about 1,000 successful Steam games, those with user-generated content kept 64% more concurrent players at two years. That data is correlational. Each creator also shares their own place. But quality is our edge, so mods open gradually.

1. **Dogfood.** Rebuild the official places in the public pack format: a JSON manifest plus either paintings with masks, depth and normal maps, or an engine scene's geometry, materials and light rig; colour grades, weather presets and optional glTF props.
2. **Local mods.** "Open a place" from a file or URL, once about six official places have shipped without changing the format. Packs carry data only: no JavaScript, no custom shaders (curated effects with parameters instead), a strict Content Security Policy and size caps. Creators host their own packs, so we host nothing.
3. **Curated guest places,** once about 20 community packs exist. Each comes with a statement that the work is original and its licence. Register a DMCA agent first.
4. **Steam build with Workshop.** Valve hosts and moderates. This is where the modding retention data applies, and where the money is: Wallpaper Engine, and Rusty's Retirement at $7.
5. **AI place builder, last.** "Describe a place" produces an editable pack through the same asset pipeline. It is rate-limited and paid or bring-your-own-key, blocks prompts that name existing IP, and sends output to the curated queue. Never an endless AI feed.

## Roadmap

| Phase | When | Build | Exit |
| --- | --- | --- | --- |
| **0 Measure** | Oct 2026 | Done: <ul><li>`npm run score` (gates G1–G6)</li><li>30 fps budget and idle stop</li><li>AVIF/WebP</li><li>A preview page and card per place</li><li>Web manifest</li><li>A still progress strip (G2 passing for lofi)</li><li>Licence files</li><li>Share action</li><li>Cookieless milestone analytics in `src/measure/`, live on motes.sh since 5 Oct (PostHog EU, production builds only)</li><li>"How Motes is made" page at `/made/` (7 Oct)</li><li>Analytics through the `/ingest` proxy on motes.sh, HTTPS only, with notice and an opt-out for the week counter (7 Oct)</li></ul> | <ul><li>WEL baseline measured</li><li>G3 and G6 preview cards passing ✓</li><li>CPU ratio ≤ 1.5 ✓ (0.61)</li></ul> |
| **1 Spread** | Oct–Nov 2026 | <ul><li>Arrival-to-evening clip export ✓</li><li>Numbered edition postcard</li><li>Stream/OBS mode with a free-with-credit licence</li><li>Picture-in-picture</li><li>Halloween edition ✓</li><li>Launch on TikTok/Reels/Shorts (one clip per daily edition), Reddit, Show HN and Product Hunt</li></ul> | <ul><li>K measured</li><li>`ref=share` arrivals measured</li><li>G6 fully passing</li></ul> |
| **2 Craft** | Nov 2026–Jan 2027 | <ul><li>three.js compositor behind a flag</li><li>First engine place (the rooftop rain garden), judged against its painting</li><li>Place-pack v1</li><li>Synthwave inside the CPU gate ✓</li><li>A winter place for exams and the holidays</li><li>Music engine package released under MIT</li></ul> | <ul><li>CPU ratio ≤ 1.0 in both styles (G2) ✓ (0.65 / 0.75)</li><li>Engine place adopted or the look iterated</li><li>New place shipped through the pack format</li></ul> |
| **3 Cadence** | Q1 2027 | <ul><li>Monthly new place</li><li>Local mods</li><li>Motes 24/7 YouTube stream for discovery</li><li>Decide on a Steam wishlist page from retention data</li></ul> | W4 ≥ 15% |
| **4 Platform** | Q2 2027 onwards | <ul><li>Curated guest places</li><li>Steam build with Workshop</li><li>AI place builder</li></ul> | 12-month targets |

## Decisions

Made on 3 Oct 2026:

1. **The art.** Engine-made places; no commissioned artists (see Assets). The disclosure of the current AI paintings was worded on 7 Oct 2026: a plain statement, naming the tool (OpenAI's image generation, through Codex), on the "How Motes is made" page.
2. **Analytics and privacy.** PostHog in cookieless mode, proxied through motes.sh. Built and off by default (see README); live on motes.sh since 5 Oct 2026, sending to PostHog's EU host from production builds only. Since 7 Oct 2026 events go through `/ingest` on motes.sh (`vercel.json`), only from HTTPS pages, so local runs no longer reach the project. The week counter relies on audience-measurement exemptions: notice and a Stop counting switch on How Motes is made, and a thirteen-month record. Events from local builds before 7 Oct carry a `127.0.0.1` `$host`; exclude them from baselines.
3. **Licences and trademark.** Adopted as planned (see Source). Still open: filing the Motes trademark and setting up the CLA.
4. **Product rules.** Sharing and clip export are allowed; PRODUCT.md, DESIGN.md and CLAUDE.md change as each one ships. The Canvas 2D compositing rules change only when an engine place is adopted.

## Evidence

**Market**
- Lofi Girl: 15.8M subscribers, about 40k concurrent listeners, revenue mostly from its label, brand deals and merch (Wikipedia; Water & Music, 2020).
- YouTube blocked free background play in mobile browsers in Jan 2026 (NokiaMob, 29 Jan 2026).
- AI music is over 50% of Deezer's daily uploads (Deezer, Jul 2026).

**Lofi Cities**
- Show HN, 27 Sep 2026: 317 points, 137 comments (news.ycombinator.com/item?id=49869574). Main criticisms: AI art, dithering and "basic midi".
- Plain JS + Canvas 2D; the creator uses AI for images and video loops (bundle inspected 2 Oct 2026).

**Comparables** (Similarweb, Jun–Aug 2026; directional)
- Flocus 1.6M visits, lofi.town 718K, studywithme.io 820K, lofi.cafe 209K.
- Noisli −23%, Poolsuite −24% month on month.
- lofi.co closed in May 2024 at about 26k monthly users.

**Virality and money**
- Wordle: from 90 to 2M+ players in about two months, driven by the share grid (Wikipedia).
- Rusty's Retirement: 330k copies at $7, 11% supporter-pack attach (GameDiscoverCo, Aug 2024).
- Bongo Cat: peaked at 194k concurrent players, about $12.7k in four months (WN Hub, Jun 2025).

**Engines and CPU** (measured 2 Oct 2026, Chrome, Ryzen 9 9950X, 1280×720, muted)

| Page | % of one CPU core |
| --- | --- |
| Motes listening, uncapped | 105 |
| Motes listening at 60 fps | 54 |
| Motes listening at 30 fps | 48 |
| YouTube lofi live tab | 28–33 |
| Lofi Cities | 39–92 |
| Motes listening, no progress transition (3 Oct) | 20 |
| Motes audio alone, lofi / synthwave (3 Oct) | 4 / 22 |
| Motes listening, lofi / synthwave, `main` (5 Oct) | 25 / 60 |
| Motes listening, lofi / synthwave, after `perf/synthwave-cpu` (5 Oct) | 22 / 25 |
| Synthwave radio alone with a 5.2 s / 2 s / no hall (5 Oct, dev build) | 17 / 11 / 8 |
| three.js sky + water example at 30 fps | 20 |

- three.js r186 is 194 KB gzipped (WebGL); Godot 4.7's web export has no WebGPU (Godot docs).

**Assets**
- GPT Image 2 (`gpt-image-2`).
- Nano Banana Pro: $0.134 per 1K/2K image (Google pricing).
- Blender MCP: 29.9k stars, prototyping-grade (MindStudio, May 2026).
- Qwen-Image-Layered (Dec 2025), Marigold, SAM 3.
- US Copyright Office, Part 2 report on copyrightability (29 Jan 2025).

**Source and mods**
- GameDiscoverCo / mod.io study of user-generated content (Oct 2024 and 2025 update).
- Obsidian moved to automated plugin review as agent-written plugins grew (May 2026).
- 2048's clone economics (Game Developer).

**Metrics**
- Amplitude's 7% rule and media benchmarks (2025).
- Audiobox Aesthetics (Meta, arXiv 2502.05139).
- Corrected FAD and its biases (arXiv 2311.01616).
- Karpathy's autoresearch keep-or-discard loop.
- Anthropic's guide to evals for AI agents (Jan 2026).
