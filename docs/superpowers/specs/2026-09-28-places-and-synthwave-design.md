# Places and synthwave

Status: design, revised after adversarial review and improved with hq:improve (2026-09-28). Branch `feat/places-and-synthwave`; nothing merges to `main` until Kyle has reviewed it. Scope: a place registry and a music-style interface (no behaviour change), a synthwave style, and a fifth place, **Top deck**, that plays it.

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

1. From the first garage song onward, the hour is unmistakably synthwave, and unmistakably darker by its last chapter, with hooks that repeat and the opening hook returning at the end.
2. Moving between the garage and any lofi place never jumps in loudness, and the four lofi places sound and look exactly as they do today (proved by score hashes, a PCM comparison and screenshots).
3. Adding a sixth place is one file plus one registry line, and the existing tests then check it.
4. `npm test`, `npm run build`, the browser scripts on desktop and phone, rendered PCM previews and lifecycle checks pass.

Non-goals: loading places at runtime, user-supplied places, vocals or vocoder, guitar, sampled dialogue, key changes inside a song (the late major lift is the one exception), new audio sample files, any change to the lofi sound or the four paintings, new interface colours, adding the garage (or any future place) to the daily rotation, which would reshuffle every existing daily link.

## Principles

- **Reuse before adding.** Per-note voices, the shared compressor and reverb, the echo-delay reset pattern, the single water outline, lamp glows, the rain effect, the windows event, `sessionAt`, `EnvironmentClock` and the look-ahead scheduler all carry over. Anything new is named as new below.
- **Refactor, then extend.** The registry and style interface land first with no audible or visible change. The garage is the first place built on them, which is the test that the seams work.
- **A place is data plus a few drawings. A style plans an hour, composes songs, declares its limits and brings a sound bank.**
- **Deterministic and bounded.** Scores come from seeds alone; scenery randomness never touches the audio clock; events per bar, pending voices and decoded assets have declared caps.
- **Lean.** No new test files. Existing tests loop over the registry, and each style declares the limits it is tested against.

## Architecture

```
src/places/
  index.ts        Place types, PLACES (panel order) and DAILY_PLACES (rain, meadow, snow, coast; frozen)
  rain.ts meadow.ts snow.ts coast.ts   today's per-place tables, branches and own drawings, moved as they are
  deck.ts         Top deck, with its headlights and lightning
src/music/
  composer/       the lofi composer, where it is; its titles, salt and standalone tempo come from the place,
                  and performer gains an optional tight flag
  styles/index.ts MusicStyle, SoundBank and STYLES
  styles/lofi/    index.ts (the hour planner from session.ts) and sound.ts (the bank from sound.ts), moved as they are
  styles/synthwave/  index.ts (style and hour), library.ts (loops, forms, cells), song.ts (plan and parts), sound.ts
```

Types live beside their registries and are imported with `import type`, so place files and the registry never form a runtime cycle. Synthwave imports `randomSource`, `chooser`, `partSeed`, `performer`, `chordAt` and `makeContour` from `composer/` directly, so no lofi file moves and no test import changes beyond what the registry requires.

### Place

Every per-place table or branch in today's code becomes a field; shared code reads the field. The list below covers every branch found in `renderer.ts`, `session-effects.ts`, `scene-light.ts`, `edition.ts`, `session.ts`, `sound.ts`, `composer/index.ts`, `composer/plan.ts` and `main.ts`.

```ts
interface Place {
  id: string; name: string; title: string; weather: string; lights: readonly [string, string, string];
  image: string; eveningImage: string; anchor: number; color: string;
  water?: { outline: readonly Point[]; from?: number; shimmer?: number; tint?: string }; // defaults .6 and 1; tint fixes the ripple colour
  lamps: readonly Point[]; steam?: Point; birds?: string;            // birds: colour of the idle flock
  effect?: 'rain' | 'snow' | 'pollen';                               // rain rings on the water follow rain
  fallback?: { tint: string; depth: number };  // procedural evening and the soft cloud grade, both only before authored light
  light(seconds: number): LightState;                                // arc(table) for most places; the meadow keeps its function
  regions(u: number, v: number): readonly [sky: number, distance: number, foreground: number];
  environment: { events: readonly EventPlan[]; weather(input: WeatherInput): number };
  draw: readonly Layer[];                                            // in order, e.g. windows(spots, fixtures), during('train', train)
  ambience: { trim: number; texture: AmbienceTexture };
  music: { style: StyleId; salt: number; titles: readonly string[]; tempo: number };
}
interface EventPlan { kind: string; slot: number; duration: number; beats?: number } // start: beats·60/bpm + 0–5 s, else 35 + 0–25 s
```

- The place id type derives from `PLACES`. `edition()` rotates through `DAILY_PLACES` with today's formula, so every date keeps its place and seed. The ambience seed stays derived from the id, as today. The caption subtitle is `light(0).subtitle`, which already equals every place's current subtitle.
- `music.salt` carries today's per-mood salt (rain 1, meadow 2, snow 3, coast 4) and `music.tempo` the standalone base tempo, so lofi scores are unchanged. The garage takes salt 5. The train keeps `beats: 96`.
- `draw` is one ordered list per place. Shared factories (`windows`, `birds`, and `during(kind, fn)`, which keeps today's six-event cap) live in `session-effects.ts`; drawings unique to one place live in its file. Today's order (windows, meadow layers, then events) is preserved, and no current plan overlaps two drawn events, so output is identical. Water shimmer and ripples, lamps, rain, snow, pollen, steam and the idle birds stay in the renderer, gated by the fields above in today's fixed order.
- `SessionState.caption` and the per-place chapter captions are removed: nothing reads them (the atmosphere line comes from `light`).

### Music style

```ts
interface MusicStyle {
  id: StyleId; lookahead: number;                                    // seconds scheduled ahead
  limits: { bpm: readonly [number, number]; grid: 2 | 4; perBar: number; meanPerBar: number; perTrack: number };
  planHour(random: () => number, place: Place): Slot[];              // eighteen slots with their chapters, exactly 3,600 s
  compose(seed: number, place: Place, slot: Slot, index: number): Track;  // after-hours cycle is floor(index / 18)
  labels: { drums: string; preparing: string; voice(track: Track): string };
  bank(graph: SoundGraph, signal?: AbortSignal): Promise<SoundBank>; // loads its own assets; Listen awaits every style
}
interface SoundBank {
  schedule(event: ScoreEvent, time: number, secondsPerBeat: number, track: Track): void;
  setMode(mode: MusicMode): void; stop(at: number, from: number): void;
}
```

| | lofi | synthwave |
| --- | --- | --- |
| `lookahead` | 6 s (today) | 3 s |
| `limits.bpm` | 68–88 | 88–150 |
| `limits.grid` (per beat; one check, `n/g + (n odd ? swing : 0)`) | 2, swung | 4, straight |
| per bar / mean / per track | 34 / 19 / 2,600 | 64 / 44 / 6,000 |
| labels | "Warm lofi beats", "Preparing the piano…", instrument names | "Drum machine", "Warming up the synths…", "Analog synths" below darkness 0.6, "Darksynth" above |

- **Session.** `createSession(seed, placeId)` owns the random stream as today: the style's `planHour` draws from it first, then the place's events, so existing plans are identical. `composeSessionTrack` hands after-hours cycles to the style; every cycle keeps its slot's form and tempo so offsets stay exact. `sessionAt`, the environment clock and the Pause, Next, Still, visit and after-hours rules do not change.
- **Tracks.** The style sets `track.style` (and synthwave sets `track.darkness`) after composing; `ScoreEvent` gains an optional `legato`. `Track.voice` and `Track.form` widen to strings, and `Track.harmony` uses a track-level chord type with a string quality, so the lofi composer's own `Quality` tables stay exactly as they are.
- **Sound.** `sound.ts` keeps what is shared: output, compressor, ceiling, music and ambience channels, the convolver reverb, voice tracking, `stopVoices`, ambience playback and disposal. It gains `schedule(graph, event, time, spb, track)`, which dispatches to the bank of the track's style. Today's piano, melody, bass and drum code moves into the lofi bank unchanged, including its echo reset.
- **Loading.** Listen awaits every registered style's bank, each loading its own assets (today only the piano), so moving between places never waits on a download and failure/retry is unchanged. The trade-off is deliberate: a failed piano download also holds the garage, but there stays one failure and retry path and no song ever waits on a download mid-session.
- **Scheduling.** Each queued segment is scheduled up to its own style's `lookahead`, and the next segment is prepared when the last one ends within its style's horizon. A lofi song followed by a synthwave song never schedules synth notes 6 s ahead.
- **Handover between styles (proposed; needs user approval).** Today the old song always finishes after a visit. When the next place plays a different style, the current song instead ends at its next 8-bar phrase boundary with a two-bar fade, so darksynth never plays for minutes over the meadow and lofi never over the garage. Visits between places of the same style keep today's rule. If this is not approved, the rule stays as it is and success criterion 1 already allows for it.

## The synthwave style

Style targets come from published tempo and key data, chord transcriptions and producer interviews, summarised here as rules. The engine writes original music; it quotes no melody, title or recording.

### Hour

Eighteen songs in six chapters. A **darkness** value per song rises from 0 to 1 and chooses loops, groove, tempo band, bass drive, pumping depth, voicing and colour.

| Chapter | Songs | BPM | Character |
| --- | --- | --- | --- |
| Sunset | 0–2 | 105–115 | melodic outrun: clean octave bass, arpeggio hooks, bright lead |
| The drive | 3–5 | 118–128 | sixteenth pedal bass, gated snare, the brightest point |
| Night falls | 6–8 | 124–130, one slow burner at about 91 | the bass starts to clip; the slow burner has no hats |
| Neon | 9–11 | 126–134 | darksynth: obvious pumping, root-and-fifth chords, drumless passages |
| The storm | 12–14 | 130–140 | heaviest drive, organ-like stabs, a second slow burner |
| Midnight | 15–17 | 130–145 | the chase peaks; song 17 restates song 0 and ends on the heroic major lift |

- Two or three authored form sequences, every one with the same bar total (as lofi's sequences all total 1,128). Nominal tempos are set so the common tempo scale that lands the hour on exactly 3,600 s stays within ±1.5% and every song stays inside its chapter band after scaling. Songs average exactly 3:20.
- Neighbouring songs never share a loop, arpeggio, groove or form.
- One tonic for the hour with related key steps between chapters, as lofi does. Song 17 uses song 0's loop, tonic and hook, so its first chorus restates song 0's lead note for note; only its final chorus lifts from i to I, with the hook re-fitted to the major chords.
- After hours: darkness at least 0.8, energy down about 15%, a fresh hook each song, each slot's form and tempo kept. It never returns to sunset.

### Songs

- **Grid.** Straight sixteenths. `performer` gains an optional `tight` flag that zeroes swing, pocket, phrase drift and backbeat, and leaves hats ±0.004 beats of variation; its default keeps lofi timing byte-identical.
- **Forms.** Sections are multiples of 8 bars and the loop changes between sections, not within them. Roles: `intro`, `verse`, `build`, `chorus`, `break` (no drums) and `outro`.

| Form | Bars | Sections (bars) |
| --- | --- | --- |
| `cruise` | 96 | intro 8 · verse 16 · build 8 · chorus 16 · break 16 · chorus 16 · outro 16 (keys only) |
| `drive` | 112 | intro 8 · verse 16 · build 8 · chorus 16 · break 8 · verse 16 · build 8 · chorus 16 · outro 16 |
| `descent` | 128 | intro 16 (held-tonic drone) · build 16 (filter opens) · chorus 32 (distorted bass and full drums land together) · break 16 · chorus 32 · outro 16 |
| `slowburn` | 64 | intro 8 · verse 16 · chorus 16 · break 8 · chorus 8 · outro 8 |

- **Harmony.** Minor tonic. About twelve four-chord loops, each tagged with a darkness range and harmonic rhythm: i–♭VI–♭VII–i, i–♭VI–♭VII–v, ♭VI–♭VII–i–III, i–♭VII–♭VI–iv, ♭VI–IV–i, ♭III–IV–i and IV–♭III–i–V among them. One chord per bar at sunset, one or two bars per chord later. Some sections hold the tonic in the bass under moving chords. Pads play voice-led triads (sus2 and add9 allowed); after dark, root and fifth.
- **Parts.** At most two sixteenth-note layers sound at once.
  - Bass: sixteenth tonic pedal, eighth-note octaves or a gallop; the slow burners pulse. Every kick lands on a bass onset, as in lofi.
  - Drums: kick on 1 and 3, with a last-sixteenth pickup only where the bass has that onset, moving to four on the floor after dark; gated snare or clap on 2 and 4; accented hats (sixteenths or eighths) with one open hat per bar; a tom fill replacing the hats at the end of every 8th bar; a crash on chorus downbeats. The kick hardens with darkness by its pitch sweep, not a second sound.
  - Pad: held chords, one voice per chord note.
  - Arpeggio: about five authored cells, including the eight-note eighth figure and sixteenths up, up-down and in octaves.
  - Lead: a two-bar hook from authored straight rhythm cells and `makeContour`. Strong beats on chord tones, weak beats resolving by step. Stated low and filtered in verses, higher and brighter in choruses, answered and brought home.
  - Stab: an organ-like chord hit at section downbeats from the storm chapter on.

### Sound bank

All synthesized in `styles/synthwave/sound.ts`, seeded like today's drum buffers, with no new files. Envelopes end at 0.0001, never 0, because an exponential ramp to zero throws.

- **Bass:** two saws an octave apart, a filter envelope, then a shared WaveShaper stage chosen by darkness: clean (none), soft clip (no oversampling) or heavy (`'2x'`).
- **Pad:** two detuned saws per chord note, each with its own filter and envelope, into a shared stereo chorus.
- **Arpeggio:** one saw pluck per note with a filter envelope, into the bank's tempo-synced dotted-eighth echo with bounded feedback.
- **Lead:** saw plus square, a short glide on `legato` notes, shared vibrato, the bank's echo and the shared reverb.
- **Stab:** one oscillator per note with a `PeriodicWave` of organ drawbar partials, built once per bank.
- **Drums:** kick as a pitch-swept sine with a click; snare, clap, hats, open hat and crash as seeded noise buffers built once, the snare with its gated reverb baked in; toms as short swept sines.
- **Pumping:** one pump gain per bank that pad, bass and arpeggio pass through. Each scheduled kick adds a dip and a recovery (two events; with a 3 s horizon the parameter holds about fifteen future events). `stop` and `setMode('ambient')` cancel and hold it at 1, exactly as `stopVoices` treats the lofi echo today, so Without drums takes effect at once.
- **Echo reset:** `stop` cancels the echo's tempo automation and briefly ducks its return, so no tail resumes after Pause.
- **Reverb:** the shared convolver with a larger send, never a second convolver.
- **Mix:** a calibrated trim so the garage's music RMS in the theme window sits within 1.5 dB of the lofi places' median in `verify-mix`; the shared compressor, sliders and ceiling apply. Without drums: drums to zero, no pumping, bass eased back.
- **Verified via context7** against the W3C Web Audio specification: exponential ramps reject 0; `setTargetAtTime` clamps a past start to now; `cancelAndHoldAtTime` is used through the existing `holdParameter` wrapper for Firefox; WaveShaper `oversample` takes `'none'`, `'2x'` or `'4x'`; `createPeriodicWave(real, imag)` builds the stab. Throttling behaviour was checked against Chrome's and Mozilla's published notes.
- **Performance:** nodes are built when a note is scheduled; the bank's chorus and vibrato oscillators start with its first note, so they never run for lofi listeners. At about 26 notes a second a 3 s horizon holds roughly 80 pending voices, well inside `verify-music`'s bound of 200. Chrome does not throttle timers on audible pages and Firefox relaxes throttling while an AudioContext exists, so the shorter horizon bounds pending work without risking gaps. If the phone check struggles, the knobs are one saw per pad note, no oversampling and a 2 s horizon.

## Top deck

- **Paintings.** `public/scenes/top-deck.png` (sunset) and `top-deck-night.png`, made like the other four: an original painting, then a composition-matched lighting edit of that image, both at 1672×941 like the others (resize the sunset before the night edit if the tool returns another 16:9 size). Each has a `.png.json` sidecar and an `ARTWORK.md` section. Prompts and the Codex steps are in the appendices.
- **Composition.** The open top deck at human height: a parked 1980s coupe in the left third with its door open and cabin glowing (the shelter), concrete, bay lines, sodium lamps and a low wall; beyond, 1980s glass towers, an elevated highway of tail-lights, palms far below, and a banded orange, magenta and violet sun in the upper third. One broad continuous puddle across the lower middle fits the single water outline. At night a storm gathers in indigo and violet, neon comes up, the lamps turn amber and the puddle reflects it all. Palette, architecture and shelter keep it apart from Neon rain. Its regions keep the shared probes true: open sky at (.57, .12), sheltered foreground at (.1, .6).
- **Place data.** Name "Top deck", crop anchor .43 so the car stays in frame on phones, the four-region light arc with the sun and its reflection fading together (as at the coast), lamp and cabin glows, tower windows through the existing windows event, and the procedural fallback. Water outline, lamp and window positions are traced from the delivered painting.
- **Environment.** Headlights sweep the deck as a car arrives, as events in two slots. The storm is part of the weather curve, not an event: dry until the storm chapter, rising through it and holding after hours, so it drives the existing rain effect and rings and the existing weather scaling of the city-hum scene sound, which stays at least 18 dB under the music. Lightning is a layer while the storm rises during the hour: at most one flash (a double flicker at most, never three in a second) every 20 s, limited to the sky region at a low alpha, none after hours, and none when motion is Still or reduced. Flash times are a pure function of the seed and environment time, like `sessionAt`, so Still, hidden tabs and revisits never replay or bunch them. Four light-arc captions, three subtitles and three daily light lines.
- **Interface (Impeccable shape brief).**
  - Copy, chosen by the user: title "Park up. Stay a while.", subtitle "Nowhere to be until morning.", places row "Neon and a gathering storm". The music is a discovery rather than announced; the panel intro becomes "Five places, each with its own feeling."
  - No new colours, components or type: the fifth row reuses the scene-choice row, and the existing panel-bounds checks at 390×844, 320×568 and 844×390 prove it still scrolls inside short screens with focus returning to its trigger.
  - Style-owned labels: "Drum machine" / "Without drums", "Warming up the synths…", and "Analog synths" or "Darksynth" before the chapter (Sunset, The drive, Night falls, Neon, The storm, Midnight) in the track detail.
  - Lightning stays subordinate to the painting, as the living-scene rules require: sky only, low alpha, capped, off with Still and reduced motion.

## Testing

No new test files.

- **Safety net, first.** `music.test.ts` gains one check: hashes of a fixed projection of the lofi session scores (beat, duration, note, velocity, pan, instrument, voice; four places, three seeds, songs 0, 9, 17 and 18) and of `sessionAt` samples without the unused caption, recorded from `main` before anything moves. Before and after the refactor, `render-music-preview` renders one lofi song per place and the WAVs are compared sample by sample (tolerance 1e-4), and `verify-scenes`' reduced-motion scene captures are compared byte for byte, once, by hand.
- **The registry is the contract.** Checks that hold for any place loop over `PLACES`: the exact contiguous hour, determinism, continuity across chapter edges, after hours without rewinding, evening painting and provenance, light arcs, regions summing to one with the shared probes, and every planned event kind used by a drawing or the weather. Checks that hold for any style loop over `STYLES` using `limits`: bpm, grid, events per bar and track, finite playable events, kicks on bass onsets. The daily rotation test counts `DAILY_PLACES` and asserts it is exactly rain, meadow, snow, coast, so a future place can never silently reshuffle every existing daily link.
- **Lofi-only, unchanged:** four key voices per hour, four-note shells, comp and piano variety, melody hygiene, and the lofi form-sequence checks.
- **Synthwave checks** in `session.test.ts`: darkness rises by chapter and stays at least 0.8 after hours; neighbours differ in loop, arpeggio, groove and form; hooks repeat (the 40% rule, via an instrument parameter on the existing helper); song 17's first chorus lead matches song 0's; lead strong beats sit on chord tones; the peak number of scheduled-plus-sounding notes for the densest song under a 3 s horizon stays under 160.
- **Scripts.** `verify-scenes`, `verify-sessions`, `verify-music` and `verify-mix` loop over the registry, and their image-cache bound becomes the number of places. `verify-music` adds a lofi-to-garage handover case. `verify-mix` adds the loudness match and measures the garage's atmosphere margin in the opening, the theme, a drumless break and a slow burner. `render-music-preview` renders a sunset song, a dark song, a slow burner and a medley, and reports render speed for the dark song.
- **By ear and by hand.** Numbers establish health, not taste: the previews are listened to before commit 2 is final, and the garage is played on a real phone for a few minutes.

Budget: about 150 net lines for the refactor, 700 to 900 for synthwave, and a handful of new checks inside existing tests.

## Delivery

Three commits on the branch, each gated by `npm test`, `npm run build` and the relevant scripts:

1. **Structure.** Safety net, place files, music-style interface with lofi behind it, per-segment horizon, registry-driven tests and scripts, and an "Adding a place" section in the README (the place file, choosing or adding a style, the two-step painting route and its provenance, and which checks then run automatically). Nothing audible or visible changes.
2. **Synthwave music.** Library, hour, songs, sound bank and mix calibration, plus the style handover if approved; previews and a phone check. Not reachable from the interface yet.
3. **Top deck.** Place file, paintings, regions, events, copy, and updates to `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `ARTWORK.md`, `public/audio/README.md` and the README (four places become five, lofi becomes lofi and synthwave, the image-cache bound). Finish review, then the branch is ready for Kyle. It is pushed only when asked.

The paintings are needed only for commit 3.

## Risks

- **Thin or toy-like synths.** Detune, chorus, filter envelopes, shared reverb, curated libraries, and the listening gate before commit 2.
- **Phone CPU.** Cheap per-note nodes, synth oscillators that start only with the first synth note, a 3 s horizon, the pending-voice check, render-speed report, a real-phone check, and the knobs above.
- **Loudness jumps.** The calibrated trim and the `verify-mix` match.
- **Refactor regressions.** Score hashes, PCM comparison and screenshots before any new behaviour.
- **Photosensitivity.** The lightning cap, sky-only area, low alpha and Still/reduced-motion off switch.
- **Art registration.** The edit prompt's constraints, the existing same-dimensions test, and masks traced from the delivered images.
- **Sounding like someone else.** Original generative writing from rules; no quoted melodies or titles.

## Review changes

Revised after an adversarial review against the code: tracks carry style, darkness and legato for the bank; horizons are per segment; pumping moved to one gain per bank with the echo's reset pattern; the pickup follows the bass; forms are tabulated; caps allow at most two sixteenth layers; styles declare test limits; the no-change proof uses a score projection, a PCM comparison and reduced-motion captures; every place branch is enumerated; the storm is a weather curve with capped lightning and no second ambience layer; CLAUDE.md, PRODUCT.md and the image-cache bound join commit 3; the lofi composer stays where it is; the 3+3+2 and half-time grooves, a second kick sound and the pre-render fallback are cut; the style handover is proposed for approval. Then improved (hq:improve): copy and labels settled through an Impeccable shape brief, Web Audio claims verified via context7, the lofi composer's small changes stated honestly, and a simplification pass that flattened places to one file each, merged asset loading into `bank`, made `light` a function, folded drawings into one ordered `draw` list, removed dead fields (caption, grade, lamp size, subtitle) and fixed the train offset to beats.

## Appendix A: painting prompts

### Top deck (sunset)

Use case: stylized-concept. Asset type: original full-bleed environment painting for an interactive lofi web artwork, 16:9 landscape.
Input images 1 and 2 are STYLE references only: two existing Motes paintings. Match their richly hand-painted cosy videogame / anime background finish, layered atmospheric depth, confident silhouettes and inviting refuge light. Create an entirely new composition; copy no objects or layout.
Paint the open top deck of a multi-storey car park above an immense 1980s city at sunset. A parked generic 1980s coupe with pop-up headlights sits in the LEFT third, driver's door open, its cabin glowing warm amber, a jacket over the seat and a cassette on the dashboard: this is the refuge. Around it: weathered concrete, faded bay lines, a low parapet wall, two unlit sodium lamp posts, and a stairwell block with a small lit doorway. Beyond the parapet, from centre to right: a skyline of glass towers and angular 1980s high-rises catching the sunset, an elevated highway ribbon with tiny tail-lights, palm trees along a boulevard far below, and distant hazy mountains. A huge low sun sits just above the horizon in the upper third, cut into horizontal bands by thin clouds, in molten orange, hot magenta and violet, with a few faint stars in the deep violet above. Main foreground centre-right: ONE broad, continuous, still rainwater puddle across the deck (roughly x 30–84%, y 62–90%), dark and glassy, reflecting the banded sun and the towers, and clear for animated reflections added by code. Keep the top centre of the image open sky. The scene is viewed from inside the deck at a comfortable human height, horizon in the upper third, NOT top-down or isometric.
Style: richly detailed hand-painted anime background / beautiful videogame environment concept art, cinematic lofi wallpaper. Intentional brush textures and confident silhouettes, warm sunset palette of orange, magenta, violet and deep teal shadow, clearly unlike a blue-hour city. Distant towers may carry painted neon shapes but no legible words, numbers, logos or car badges. No pixelation, no voxel/clay look, no photorealism. NO rain streaks, particles or bright dots; those animate in code. No people, UI, title, watermark or giant foreground character. Edge-to-edge finished illustration.

### Top deck (night)

Use case: lighting-weather.
Asset type: precisely composition-matched late-evening lighting layer for an existing living lofi painting. It will be slowly composited directly over the original, so geometric registration is critical.
Input image is the EDIT TARGET, not a loose reference. Original canvas is 1672 by 941 pixels, approximately 16:9 landscape. Return the same full image framing, aspect ratio, camera, perspective and object positions. Edit ONLY time of day, weather light and material-specific illumination. Preserve every landmark contour and fine spatial detail as closely as possible; do not redraw the scene.
Primary request: let this sunset car-park deck settle into a deep, stormy night. The banded sun has gone below the horizon; heavy storm clouds in indigo, violet and petrol blue gather over the skyline, lit faintly from beneath by the city. Tower windows and the painted neon shapes glow magenta, cyan and amber; the elevated highway becomes a bright ribbon of red and white car lights. The two sodium lamps are lit, casting warm amber pools on the wet concrete. The coupe's cabin stays warmly inviting. Relight the puddle into dark glassy ink reflecting the neon, lamps and tower windows; remove the sun's broad orange reflection.
Preserve the coupe, open door, jacket and cassette, every bay line, the parapet, lamp posts, stairwell and doorway, all tower silhouettes, the highway, palms and mountains, and the exact puddle outline, in the same positions. No new lettering, signs or objects. No lightning bolts; lightning is animated in code.
Style: retain the original richly textured, painterly cosy videogame / anime background illustration. A luminous and readable night, no black crush, no uniform colour filter.
Strict constraints: identical composition; no cropping, zooming, moving or resizing objects, altered contours or new scenery. No people, rain streaks, snowflakes, particles, bright floating dots, extra text, graphics or watermark. Deliver one complete landscape image.

## Appendix B: Codex steps

The existing sidecars record Codex's built-in `image_gen` tool: a generation for each arrival painting and a "lighting-weather" edit for each evening.

1. In Codex, in this repository, attach `public/scenes/neon-rain.png` and `public/scenes/the-last-chapter.png` as style references and paste the sunset prompt. Ask for image generation.
2. Accept an image only if the coupe and its glowing cabin sit in the left third, the puddle is one continuous region in the lower middle, the top centre is open sky, the sun is banded and low, and there is no text, badge, particle or person. Regenerate otherwise.
3. Save it as `public/scenes/top-deck.png` at 1672×941 (resize a larger 16:9 result to exactly that size first).
4. In a new message, attach `top-deck.png` as the edit target, paste the night prompt and ask for an edit, not a new image.
5. Accept it only if it is exactly 1672×941 and every contour lines up when the two are flicked between. Save it as `public/scenes/top-deck-night.png`.
6. Send both files, the generation date and the source paths Codex reports. The sidecars, water outline and lamp positions are written from them.
