# Places and synthwave

Status: design (2026-09-28). Branch `feat/places-and-synthwave`; nothing merges to `main` until Kyle has reviewed it. Scope: a place registry and a music-style interface (no behaviour change), a synthwave style, and a fifth place, **Top deck**, that plays it.

## Problem

Motes has four places and one music style, and both are hard-wired. About 60 dense lines in nine source files name a specific place (`renderer.ts` 14, `session-effects.ts` 12, `session.ts` 9, `edition.ts` 9, `scene-light.ts` 8, the lofi composer 6, `sound.ts` 2), plus copy in `index.html` and scene lists in four scripts and five tests. Adding a place means finding every one of them, and nothing reports a missed one. Music is planned, composed and voiced by one lofi engine with no seam for another style.

## Intent

User direction (2026-09-28):

- A fifth place: the top deck of a multi-storey car park above a city, with matched sunset and night paintings.
- Its music is **synthwave**, moving from melodic sunset outrun to darksynth as night falls, driving and energetic rather than chill.
- It is reached only by choosing it. The daily rotation and every existing daily link stay exactly as they are.
- The work leaves Motes easy for others to extend with their own places and styles.
- Lean: no ridiculous line counts or test sprawl. Reuse the current patterns wherever they fit.

Success means:

1. The garage hour is unmistakably synthwave from its first bar and unmistakably darker by its last chapter, with hooks that repeat and the opening hook returning at the end.
2. Walking between the garage and any lofi place never jumps in loudness, and the four lofi places sound and look exactly as they do today (proved by score hashes and screenshots).
3. Adding a sixth place is one folder plus one registry line, and the existing tests then check it.
4. `npm test`, `npm run build`, the browser scripts on desktop and phone, rendered PCM previews and lifecycle checks pass.

Non-goals: loading places at runtime, user-supplied places, vocals or vocoder, guitar, sampled dialogue, key changes inside a song (the late major lift is the one exception), new audio sample files, any change to the lofi sound or the four paintings, new interface colours, a sixth place.

## Principles

- **Reuse before adding.** Per-note voices, the shared compressor and reverb, the single water outline, lamp glows, the rain effect, the windows event, `sessionAt`, `EnvironmentClock` and the look-ahead scheduler all carry over. Anything new is named as new below.
- **Refactor, then extend.** The registry and style interface land first with no audible or visible change. The garage is the first place built on them, which is the test that the seams work.
- **A place is data plus a few drawings. A style plans an hour, composes songs and brings a sound bank.**
- **Deterministic and bounded.** Scores come from seeds alone; scenery randomness never touches the audio clock; events per bar, pending voices and decoded assets have declared caps.
- **Lean.** No new test files. Existing tests loop over the registry, and each style declares the limits it is tested against.

## Architecture

```
src/places/
  types.ts        Place: copy, paintings, crop, water, lamps, light arc, regions,
                  environment (events, captions, weather), effects, drawings, scene sound, music
  index.ts        PLACES (panel order) and DAILY_PLACES (rain, meadow, snow, coast)
  rain/ meadow/ snow/ coast/    today's per-place tables and branches, moved as they are
  deck/           Top deck, with its own headlights and lightning drawings
src/music/
  shared/         random, perform, chordAt and the theme contour helper, moved as they are
  styles/types.ts MusicStyle
  styles/index.ts STYLES
  styles/lofi/    today's composer, hour planner and sound bank, moved as they are
  styles/synthwave/  library, planner, parts and sound bank
```

### Place

```ts
interface Place {
  id: string; name: string; title: string; subtitle: string; weather: string; lights: readonly string[];
  image: string; eveningImage: string; anchor: number; color: string;
  water: readonly Point[]; lamps: readonly Point[]; effects: readonly Effect[]; // 'rain' | 'snow' | 'pollen' | 'birds' | 'steam'
  light: LightArc | ((seconds: number) => LightState);   // timings, captions, subtitles; the meadow keeps its function
  regions(u: number, v: number): Regions;                 // sky, distance, foreground weights outside the water
  environment: { events: EventPlan[]; captions: readonly string[]; weather(p: EnvironmentInput): number };
  draw?: Record<string, EventDrawer>;                      // place-only drawings: train, boat, headlights, lightning
  ambience: { trim: number; texture: AmbienceTexture };
  music: { style: StyleId; seed: number; titles: readonly string[] };
}
```

The exact field list is settled in the plan; the rule is that every per-place table or branch in today's code becomes a field, and shared code reads the field. The place id type derives from `PLACES`. `edition()` rotates through `DAILY_PLACES` with today's formula, so every date keeps its place and seed. `music.seed` carries today's per-mood salt (rain 1, meadow 2, snow 3, coast 4) so lofi scores are unchanged; the garage takes 5. Shared drawing code (water shimmer and ripples, lamps, rain, snow, pollen, birds, steam, windows, the procedural evening fallback) stays shared and is selected by the place; drawings unique to one place live in its folder.

### Music style

```ts
interface MusicStyle {
  id: StyleId; chapters: readonly string[]; lookahead: number;       // seconds of scheduling ahead
  planHour(random: () => number, place: Place): Slot[];              // eighteen slots, exactly 3,600 s
  compose(seed: number, place: Place, slot: Slot, index: number, cycle: number): Track;
  label(track: Track): string; drumsLabel: string;                   // player line and Sound & motion option
  load?(context: BaseAudioContext, signal?: AbortSignal): Promise<unknown>;
  bank(graph: SoundGraph, assets: unknown): SoundBank;               // schedule, setMode, stop
}
```

- **Session.** `createSession(seed, placeId)` owns the random stream as today: the style's `planHour` draws from it first, then the place's events, so existing plans are identical. `composeSessionTrack` hands after-hours cycles to the style. `sessionAt`, the environment clock and the Pause, Next, Still, visit and after-hours rules do not change.
- **Sound.** `sound.ts` keeps what is shared: output, compressor, ceiling, music and ambience channels, the convolver reverb, voice tracking, `stopVoices`, ambience playback and disposal. Each style's bank owns its instruments and connects into those channels. Today's piano, melody, bass and drum code moves into the lofi bank unchanged.
- **Loading.** Listen loads every registered style's assets (today only the piano), so moving between places never waits on a download and failure/retry is unchanged.
- **Scheduling.** The radio's horizon is the playing track's style `lookahead`: lofi 6 s as today, synthwave 3 s (below).
- **Types.** `Track`, `ScoreEvent` and `Instrument` keep their shape; fields that were lofi-only (`voice`, `form`, chord quality) widen to the union of the styles' values. The lofi composer's own types are unchanged.

## The synthwave style

Style targets come from published tempo and key data, chord transcriptions and producer interviews, summarised here as rules. The engine writes original music; it quotes no melody, title or recording.

### Hour

Eighteen songs in six chapters. A **darkness** value per song rises from 0 to 1 and chooses loops, groove, tempo band, bass drive, pumping depth, voicing and colour.

| Chapter | Songs | BPM | Character |
| --- | --- | --- | --- |
| Sunset | 0–2 | 105–115 | melodic outrun: clean octave bass, arpeggio hooks, bright lead |
| The drive | 3–5 | 118–128 | sixteenth pedal bass, gated snare, the brightest point |
| Night falls | 6–8 | 124–130, one slow burner at about 91 | bass starts to clip; the slow burner has no hats |
| Neon | 9–11 | 126–134 | darksynth: obvious pumping, root-and-fifth chords, drumless passages |
| The storm | 12–14 | 130–140 | heaviest drive, organ-like stabs, a 3+3+2 groove or half-time break |
| Midnight | 15–17 | 130–145 | the chase peaks; song 17 restates song 0's hook note for note, played by the midnight band, and ends on the heroic major lift |

- Authored form sequences (like lofi's `FORM_SEQUENCES`) keep the planned hour within 5% of 3,600 s; one common tempo scale then lands it exactly, as lofi does.
- Neighbouring songs never share a loop, arpeggio, groove or form.
- The hour has one tonic with related key steps between chapters, as lofi does.
- After hours: darkness stays at least 0.8, energy eases by about 15%, and each song writes a fresh hook. It never returns to sunset.

### Songs

- **Grid.** Straight sixteenths. `performer` gains an optional `tight` flag (no pocket, a couple of milliseconds on hats only); its default keeps lofi timing byte-identical.
- **Forms.** Built from 8-bar phrases, each section repeating its loop three to five times; the loop changes between sections, not within them. Four forms: `cruise` 96 bars (arpeggio or pad intro, verse, build, chorus, drumless break, chorus, keys-only coda), `drive` 112, `descent` 128 (a held-tonic drone intro, a 16-bar filter build, then distorted bass and full drums land together), and `slowburn` 64. Average length is about 3:25.
- **Harmony.** Minor tonic. About twelve four-chord loops, each tagged with a darkness range and harmonic rhythm: i–♭VI–♭VII–i, i–♭VI–♭VII–v, ♭VI–♭VII–i–III, i–♭VII–♭VI–iv, ♭VI–IV–i, ♭III–IV–i and IV–♭III–i–V among them. One chord per bar at sunset, one or two bars per chord later. Some sections hold the tonic in the bass under moving chords. Pads play voice-led triads (sus2 and add9 allowed); after dark, root and fifth. Songs with the lift move their last chorus from i to I with a major V.
- **Parts.**
  - Bass: sixteenth tonic pedal, eighth-note octaves, or a gallop; the slow burner pulses. Every kick lands on a bass onset, as in lofi.
  - Drums: kick on 1 and 3 with a last-sixteenth pickup, moving to four on the floor after dark; gated snare or clap on 2 and 4; accented sixteenth hats with one open hat per bar; a tom fill closing every 8th bar; a crash on chorus downbeats.
  - Pad: held chords.
  - Arpeggio: about five authored cells, including the eight-note eighth figure and sixteenths up, up-down and in octaves.
  - Lead: a two-bar hook from authored straight rhythm cells and the shared contour helper, strong beats on chord tones and weak beats resolving by step. Stated low and filtered in verses, higher and brighter in choruses, answered and brought home.
  - Stab: an organ-like chord hit at section downbeats in the storm and midnight chapters.
- **Budget.** The style declares at most 72 events in a bar and 52 on average; lofi keeps 34 and 19.

### Sound bank

All synthesized in `styles/synthwave/sound.ts`, seeded like today's drum buffers, with no new files.

- **Bass:** two saws an octave apart, a filter envelope, then one of three shared WaveShaper stages (clean and soft clip with no oversampling, heavy at `'2x'`) chosen by darkness.
- **Pad:** two detuned saws per chord note, one filter and envelope per chord, into a shared stereo chorus.
- **Arpeggio:** one saw pluck per note with a filter envelope, into a tempo-synced dotted-eighth echo with bounded feedback.
- **Lead:** saw plus square, a short glide on notes the composer marks legato, shared vibrato, echo and the shared reverb.
- **Drums:** kick as a pitch-swept sine with a click (a harder variant after dark); snare, clap, hats, open hat and crash as seeded noise buffers built once, the snare with its gated reverb baked in; toms as short swept sines. **Stab:** additive organ-like partials.
- **Pumping** is written into each pad, bass and arpeggio note's own gain envelope from the kick times the composer already knows. Long automation lists on one parameter slow some engines; per-note envelopes follow today's pattern and leave Pause and Next nothing extra to reset.
- **Reverb:** the shared convolver (the most expensive node) with a larger send, not a second convolver.
- **Mix:** a calibrated trim so the garage's music sits within 1.5 dB of the lofi places' median in `verify-mix`; the shared compressor, sliders and ceiling apply. Without drums: drums to zero, no pumping, bass eased back.
- **Performance:** nodes are built when a note is scheduled. At about 30 notes a second a 6 s horizon holds some 180 pending voices, so the style schedules 3 s ahead. Chrome does not throttle timers on audible pages and Firefox relaxes throttling while an AudioContext exists, so this bounds pending work, not timer safety; it stays far above the 250 ms tick. If the phone check fails, the fallback is rendering eight-bar chunks ahead with `OfflineAudioContext`; it is not the default because it changes playback.

## Top deck

- **Paintings.** `public/scenes/top-deck.png` (sunset) and `top-deck-night.png`, made like the other four: an original painting at 1672×941 or larger, then a composition-matched lighting edit of that image. Each has a `.png.json` sidecar and an `ARTWORK.md` section. Prompts and the Codex steps are in the appendices.
- **Composition.** The open top deck at human height: a parked 1980s coupe in the left third with its door open and cabin glowing (the shelter), concrete, bay lines, sodium lamps and a low wall; beyond, 1980s glass towers, an elevated highway of tail-lights, palms far below, and a banded orange, magenta and violet sun in the upper third. One broad continuous puddle across the lower middle fits the existing single water outline. At night a storm gathers in indigo and violet, neon comes up, the lamps turn amber and the puddle reflects it all. Palette, architecture and shelter keep it apart from Neon rain.
- **Place data.** Name "Top deck", crop anchor .43 so the car stays in frame on phones, the four-region light arc with the sun and its reflection fading together (as at the coast), lamp and cabin glows, tower windows through the existing windows event, and the procedural evening fallback. Water outline, lamp and window positions are traced from the delivered painting.
- **Environment.** Headlights sweep the deck as a car arrives, twice in the hour; a storm spans the last two chapters, raising the weather curve that drives the existing rain effect (dry until then) and flickering lightning over the sky. Six chapter captions, three daily light lines, and a city-hum scene sound (low traffic wash, rain on concrete in the storm) at least 18 dB under the music, including drumless passages and the slow burner.
- **Interface.** Same brown, amber and cream. The places panel gains a fifth row. The drums option and the instrument line under the title come from the active style (lofi keeps "Warm lofi beats" and its instrument names). The places panel intro is rewritten for five places. Copy is drafted in the Motes voice and reviewed with Impeccable; working drafts: title "Above the city lights.", subtitle "Nowhere to be until morning."

## Testing

No new test files.

- **Safety net, first.** `music.test.ts` gains one check comparing hashes of the lofi session scores (four places, three seeds, songs 0, 9, 17 and 18) and `sessionAt` samples, recorded from `main` before anything moves. Screenshots from `verify-scenes` and `verify-sessions` are captured on `main` and compared byte for byte after the refactor, once, by hand.
- **The registry is the contract.** Checks that hold for any place or style loop over `PLACES` and `STYLES`: the exact contiguous hour, determinism, continuity across chapter edges, after hours without rewinding, evening painting and provenance, light arcs, regions summing to one, events inside their drawings, playable finite events, each style's declared event caps and grid, kicks on bass onsets. Lofi-only checks (swing, shells, comp, melody hygiene) stay lofi-only.
- **Synthwave checks** in `session.test.ts`: darkness rises by chapter and stays high after hours; neighbours differ in loop, arpeggio, groove and form; hooks repeat (the 40% rule, via an instrument parameter on the existing helper); song 17's lead matches song 0's.
- **Scripts.** `verify-scenes`, `verify-sessions`, `verify-music` and `verify-mix` loop over the registry. `verify-mix` adds the loudness match and the atmosphere margin for the garage; `verify-music`'s voice bound (< 200) and lifecycle checks run on it. `render-music-preview` renders a sunset song, a dark song, the slow burner and a medley, and reports render speed for the dark song.
- **By ear and by hand.** Numbers establish health, not taste: the previews are listened to before commit 2, and the garage is played on a real phone for a few minutes.

Budget: about 150 net lines for the refactor, 700 to 900 for synthwave, and a handful of new checks inside existing tests.

## Delivery

Three commits on the branch, each gated by `npm test`, `npm run build` and the relevant scripts:

1. **Structure.** Safety net, place folders, music-style interface with lofi behind it, registry-driven tests and scripts, and an "Adding a place" section in the README. Nothing audible or visible changes.
2. **Synthwave music.** Library, planner, parts, sound bank and mix calibration; previews and a phone check. Not reachable from the interface yet.
3. **Top deck.** Place folder, paintings, regions, events, copy, and updates to `DESIGN.md`, `.impeccable/design.json`, `ARTWORK.md`, `public/audio/README.md` and the README. Finish review, then the branch is ready for Kyle. It is pushed only when asked.

The paintings are needed only for commit 3.

## Risks

- **Thin or toy-like synths.** Detune, chorus, filter envelopes, shared reverb, curated libraries, and the listening gate before commit 2.
- **Phone CPU.** Cheap per-note nodes, a 3 s horizon, the voice bound, render-speed report, a real-phone check, and the pre-render fallback.
- **Loudness jumps.** The calibrated trim and the `verify-mix` match.
- **Refactor regressions.** Score hashes and screenshot comparison before any new behaviour.
- **Art registration.** The edit prompt's constraints, the existing same-dimensions test, and masks traced from the delivered images.
- **Sounding like someone else.** Original generative writing from rules; no quoted melodies or titles.

## Appendix A: painting prompts

### Top deck (sunset)

Use case: stylized-concept. Asset type: original full-bleed environment painting for an interactive lofi web artwork, 16:9 landscape, ideally 2560x1440 or larger.
Input images 1 and 2 are STYLE references only: two existing Motes paintings. Match their richly hand-painted cosy videogame / anime background finish, layered atmospheric depth, confident silhouettes and inviting refuge light. Create an entirely new composition; copy no objects or layout.
Paint the open top deck of a multi-storey car park above an immense 1980s city at sunset. A parked generic 1980s coupe with pop-up headlights sits in the LEFT third, driver's door open, its cabin glowing warm amber, a jacket over the seat and a cassette on the dashboard: this is the refuge. Around it: weathered concrete, faded bay lines, a low parapet wall, two unlit sodium lamp posts, and a stairwell block with a small lit doorway. Beyond the parapet, from centre to right: a skyline of glass towers and angular 1980s high-rises catching the sunset, an elevated highway ribbon with tiny tail-lights, palm trees along a boulevard far below, and distant hazy mountains. A huge low sun sits just above the horizon in the upper third, cut into horizontal bands by thin clouds, in molten orange, hot magenta and violet, with a few faint stars in the deep violet above. Main foreground centre-right: ONE broad, continuous, still rainwater puddle across the deck (roughly x 30–84%, y 62–90%), dark and glassy, reflecting the banded sun and the towers, and clear for animated reflections added by code. The scene is viewed from inside the deck at a comfortable human height, horizon in the upper third, NOT top-down or isometric.
Style: richly detailed hand-painted anime background / beautiful videogame environment concept art, cinematic lofi wallpaper. Intentional brush textures and confident silhouettes, warm sunset palette of orange, magenta, violet and deep teal shadow, clearly unlike a blue-hour city. Distant towers may carry painted neon shapes but no legible words, numbers, logos or car badges. No pixelation, no voxel/clay look, no photorealism. NO rain streaks, particles or bright dots; those animate in code. No people, UI, title, watermark or giant foreground character. Edge-to-edge finished illustration.

### Top deck (night)

Use case: lighting-weather.
Asset type: precisely composition-matched late-evening lighting layer for an existing living lofi painting. It will be slowly composited directly over the original, so geometric registration is critical.
Input image is the EDIT TARGET, not a loose reference. Original canvas is WIDTH by HEIGHT pixels, approximately 16:9 landscape. Return the same full image framing, aspect ratio, camera, perspective and object positions. Edit ONLY time of day, weather light and material-specific illumination. Preserve every landmark contour and fine spatial detail as closely as possible; do not redraw the scene.
Primary request: let this sunset car-park deck settle into a deep, stormy night. The banded sun has gone below the horizon; heavy storm clouds in indigo, violet and petrol blue gather over the skyline, lit faintly from beneath by the city. Tower windows and the painted neon shapes glow magenta, cyan and amber; the elevated highway becomes a bright ribbon of red and white car lights. The two sodium lamps are lit, casting warm amber pools on the wet concrete. The coupe's cabin stays warmly inviting. Relight the puddle into dark glassy ink reflecting the neon, lamps and tower windows; remove the sun's broad orange reflection.
Preserve the coupe, open door, jacket and cassette, every bay line, the parapet, lamp posts, stairwell and doorway, all tower silhouettes, the highway, palms and mountains, and the exact puddle outline, in the same positions. No new lettering, signs or objects. No lightning bolts; lightning is animated in code.
Style: retain the original richly textured, painterly cosy videogame / anime background illustration. A luminous and readable night, no black crush, no uniform colour filter.
Strict constraints: identical composition; no cropping, zooming, moving or resizing objects, altered contours or new scenery. No people, rain streaks, snowflakes, particles, bright floating dots, extra text, graphics or watermark. Deliver one complete landscape image.

## Appendix B: Codex steps

The existing sidecars record Codex's built-in `image_gen` tool: a generation for each arrival painting and a "lighting-weather" edit for each evening.

1. In Codex, in this repository, attach `public/scenes/neon-rain.png` and `public/scenes/the-last-chapter.png` as style references and paste the sunset prompt. Ask for image generation.
2. Accept an image only if the coupe and its glowing cabin sit in the left third, the puddle is one continuous region in the lower middle, the sun is banded and low, and there is no text, badge, particle or person. Regenerate otherwise.
3. Save it as `public/scenes/top-deck.png` at its generated size (at least 1672×941).
4. In a new message, attach `top-deck.png` as the edit target, fill WIDTH and HEIGHT in the night prompt with its pixel size, paste it and ask for an edit, not a new image.
5. Accept it only if it is exactly the same pixel size and every contour lines up when the two are flicked between. Save it as `public/scenes/top-deck-night.png`.
6. Send both files, the generation date and the source paths Codex reports. The sidecars, water outline and lamp positions are written from them.
