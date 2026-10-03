# Motes

Living scenes, warm jazzy lofi and dreamy synthwave. A place to leave open while you read, work or do nothing at all.

Four original illustrated places unfold through water, weather, light and small distant movements: **Neon rain**, **Golden hour**, **Last light station** and **The last chapter**. A new local calendar day chooses a different place and a fresh musical/atmospheric edition. You can visit any place or return to a date.

## Run

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5175
```

`npm run build` produces a static `dist/` site. There is no backend, account, runtime npm dependency, API key or daily content-generation job. Fonts, illustrations and piano samples are bundled locally; the page makes no font-service requests.

## Listen

Choose **Warm lofi** or **Dreamy synthwave** under **Sound & motion → Music style**. **Drums** is a separate On/Off choice for either style. Both preferences are remembered. Switching styles gently fades to a new musical hour while the scenery keeps its place in the evening; changing styles while paused stays paused. Synthwave starts without downloading piano samples. If a switch to lofi cannot load its piano, the current music continues and selecting lofi again retries.

**Listen** starts the radio. **Next track** moves to another arrangement. **Sound & motion** controls music and scene sounds separately, offers a version without drums, and freezes scene motion without stopping the music. Preferences stay in this browser. **Find a place** changes scenery; the current song finishes and the next one belongs to the new edition. The date control revisits a day. **Just the scene** hides the controls; Escape restores them.

The shelter-and-mote logo, warm brown radio, amber playback button and cream settings panels give every place the same welcoming interface. Original SVG brand masters live in [public/brand](public/brand/README.md); the self-hosted Nunito Sans and EB Garamond fonts retain their [licenses and sources](public/fonts/README.md). Desktop, phone and short landscape layouts keep the listening controls within reach.

Each lofi Listen session unfolds over an hour: eighteen connected songs, six chapters, related keys and a return to the opening theme. Every song is planned before it is played: one of four shapes (a 64-bar beat tape, a 56-bar hook, a 72-bar long form, a sparse 48-bar nocturne), a hand-picked four-bar chord loop with a contrasting middle, a two-bar theme that is stated, answered, echoed and brought home note for note, and its own comping, kick-and-bass and drum feel. Neighbouring songs never share a shape, loop, comp pattern or groove; about a third of the hour is in minor keys, including both nocturnes. Upright and softened felt piano give way to mellow electric keys and occasional mallet melodies. After the hour, gentler new arrangements continue without a hard stop. The piano uses local CC0 Kawai upright recordings; electric keys and mallets are synthesized. See [audio provenance](public/audio/README.md).

In lofi, piano, melody, bass and drums share one swung performance grid. Kick accents follow the bass, backbeats sit slightly behind the shared pulse, and restrained hat patterns leave space for the piano. The short kick and filtered percussion stay soft; piano echoes follow the track tempo.

Synthwave has its own composer: warm detuned pads, plucked arpeggios, mellow lead hooks, rounded pulsing bass and soft electronic drums on a straight pulse. Four song families alternate across eighteen tracks: arpeggio-led night drives, bass pulses, spacious drifting pads and lead melodies. Eight authored chord loops, six hook rhythms and four arpeggio patterns give songs their identity; contrasting sections and deliberate space shape 64-, 80- and 96-bar forms. Tempos are scaled together to keep the hour exactly 3,600 seconds, with the opening theme returning at the end and quieter fresh themes after hours. All synthwave sounds are generated locally with Web Audio; no new recordings, services or downloads are needed.

A dedicated Web Audio look-ahead clock schedules music independently of rendering. Hiding the tab stops visual rendering while audio continues; browser or operating-system suspension can still interrupt playback. Controls and media-session playback actions support pause/resume. Failed sample loading is visible and retryable.

On browsers supporting the Audio Session API, Listen requests the music playback category before starting audio so iOS Silent Mode does not mute the radio. Older iOS versions without that API may still require Silent Mode to be turned off.

## Living scenes, daily editions

The four paintings are authored assets, not new AI images generated each day. Each date changes the selected place and its seed for music, weather intensity, wind, light and event timing. Water reflections move; rain makes ripples, snow drifts, steam curls above cups, butterflies and distant birds pass through. A tap inside painted water makes a ripple. Reduced-motion preference starts with the scene still, independently of the radio.

The same date and place reproduce the same starting edition. An open session receives a quiet invitation at midnight instead of an abrupt change. Visiting today's edition resets to the daily place. Choosing a place moves to that place's own page, which pins it and carries its own link preview. Examples: `/?day=2026-09-17`, `/places/last-light-station/?day=2026-09-17`. Older `?scene=snow` links still open the place.

Listening gradually deepens the light, changes the weather and warms windows. A train briefly visits the snowy station, a small boat crosses the bay, birds and butterflies pass through the meadow, and a shower passes over the city. These moments belong to the hour rather than repeating every few seconds. A separate clock counts actual listening time: Pause holds it, Next changes only the music, and Still freezes only the picture. The clock continues during normal background listening and starts fresh on arrival in another edition, while the current song finishes naturally. After the hour, the scene stays in its evening state.

Every place has a matched evening painting. Over roughly fifty minutes, the sky, distance, sheltered foreground and water change at their own pace:

- **Neon rain:** bright blue clouds give way to indigo, with neon and lantern reflections across the darkening rooftop pond.
- **Golden hour:** the sunlit clearing becomes a blue, lantern-lit evening. Pollen fades, butterflies settle and fireflies appear.
- **Last light station:** the last pink leaves the mountains; snow and valley settle into winter blue around amber cafe windows and platform lamps.
- **The last chapter:** the sunset and its reflection fade together into a silver-blue bay, leaving warm reading light and harbour windows.

Water animation samples the changing painting, so reflections follow the sky. Local lamps and scene captions follow each place's lighting arc. These are four original compositions with four additional lighting states, not eight separate places. Paintings load when their place is visited; revisits reuse the decoded images, and only the active place keeps a full-size composite. If evening artwork fails, the original remains visible with a retry action.

Artwork and exact generation prompts live in [public/scenes](public/scenes/ARTWORK.md). Paintings load on demand and crossfade between places. Each browser receives AVIF, WebP or the original PNG, whichever is the lightest it can decode. The evening painting waits until the arrival painting has loaded. If an image fails, sound and controls remain available with a retry action. After changing a painting, run `node scripts/encode-scenes.mjs` to rebuild its AVIF/WebP copies, the place thumbnail, the link-preview card and the app icons.

The scene paints at a steady 30 frames a second, 60 during crossfades and ripples. A still picture is redrawn only when something about it changes, so a tab left open for hours stays light.

## Code

| Module | Responsibility |
| --- | --- |
| `src/scenes/edition.ts` | Scene catalogue, validated local dates, deterministic daily atmosphere |
| `src/scenes/renderer.ts` | Paintings, water, light, weather, small events, transitions and ripples |
| `src/scenes/frame-budget.ts` | Steady, smooth and still frame rates |
| `src/scenes/painting-source.ts` | AVIF → WebP → PNG painting fallback |
| `src/share/pages.ts`, `vite.config.ts` | Per-place pages and link previews, built beside the home page |
| `src/scenes/session-effects.ts` | Gradual evening light, train, boat, birds, butterflies and fireflies |
| `src/scenes/scene-light.ts` | Lighting arcs and spatial masks for all four places; cached painting compositing |
| `src/scenes/meadow-light.ts` | Meadow timing for sunlight, lantern light and fireflies |
| `src/session/environment.ts` | Listening-time clock independent of track skips and rendering |
| `src/session/session.ts` | Deterministic hour-long arrangement, chapters and environmental timeline |
| `src/music/composer/` | Pure, deterministic song planning (forms, loops, rootless voicings, themes) and realisation of piano, bass, melody and drums on one swung grid |
| `src/music/sound.ts` | Upright/felt piano, electric keys, mallets, bass, drums, reverb and atmosphere |
| `src/music/synthwave/` | Authored synthwave vocabulary, deterministic song planning/composition and synthesized voices |
| `src/music/audio.ts` | Playback clock, track continuity, loading, volume and lifecycle |
| `src/main.ts`, `src/style.css` | Listening interface, daily navigation, preferences and accessibility |

The organism simulation, names, stats, experiments, lenses, save/rewind tools and all previous renderers have been removed. Git history preserves the earlier direction.

## Verify

```sh
npm test
npm run build
node scripts/verify-scenes.mjs
node scripts/verify-music.mjs
node scripts/verify-ios-audio.mjs
node scripts/verify-mix.mjs
node scripts/verify-mix.mjs synthwave
node scripts/verify-synthwave.mjs
node scripts/verify-synthwave-sound.mjs
node scripts/verify-sessions.mjs
node scripts/render-music-preview.mjs
```

`npm run score` scores a change against the gates in [GOAL.md](GOAL.md): CPU against a YouTube lofi stream, first load on a slow phone, accessibility and link previews. `npm run score -- --full` also runs every check above. The CPU gate opens visible Chrome windows; installed Chrome is preferred.

Browser checks need Playwright Chromium (`npx playwright install chromium`). Scene/session checks use port 5175, overridable with `MOTES_URL`; music checks start their own temporary server. Checks cover all four scenes on desktop and phone, intermediate/evening artwork, daily revisiting, control panels, pause (including song boundaries), retry for every evening asset, navigation during loading, bounded painting caches, preferences, visibility events, session continuity and bounded voice resources. The preview script renders a stereo WAV and reports peak/RMS/clipping; it takes duration, output path, seed, scene and zero-based track index arguments.

Technical audio checks establish playback and signal health, not a claim that every generated track meets someone's musical taste. The listening experience remains the quality bar.

The preview command accepts an optional final style argument: `node scripts/render-music-preview.mjs 90 captures-synthwave/arpeggio.wav 20260928 rain 0 synthwave`. Indices 0, 1 and 2 preview the arpeggio, pulse and drift families. The synthwave browser check covers style loading failures, late requests, rapid switching, pause/resume, independent scenery time, preference migration and desktop/phone controls.

The synthwave sound builds from wide detuned pads into a rolling sixteenth-note bass gallop, arpeggios and electronic drums, with a thicker chord layer entering as the hook develops. Pads sustain across chord changes; four decaying dotted-eighth echoes carry the arpeggios, lead and chord accents between attacks. Filter brightness opens through the arrangement. A dedicated stereo chorus, long hall reverb and gated snare room give it its night-drive character. Each voice owns its short mono delay stages so pause and switching cancel queued echoes. `node scripts/verify-synthwave-sound.mjs` checks the rendered tail, stereo width, headroom, timed repeats, cancellation and continuity at chord changes.

The mix check renders isolated music and atmosphere stems for all four scenes, with and without drums, across all four instrumental colours and the quietest late-session arrangements. At default levels and maximum weather gain, atmosphere must stay at least 18 dB below both the quiet opening and the theme in these fixtures. Scene-specific attenuation applies beneath the slider, so saved preferences receive the same calibration. Player and offline previews share the same defaults.

## Licences

- **Application code:** [AGPL-3.0](LICENSE). Code published up to and including commit `abf0a44` was dedicated to the public domain (CC0) and remains so.
- **Music engine** (`src/music/`): [MIT](src/music/LICENSE), so radio can be embedded elsewhere with a credit line.
- **Paintings, masks, evening arcs and the Motes identity** (`public/scenes/`, `public/brand/`): all rights reserved, to the extent rights exist. The Motes name and logo are covered by [TRADEMARKS.md](TRADEMARKS.md).
- **Third-party assets keep their own licences:** the piano recordings are CC0 ([provenance](public/audio/README.md)) and the fonts use the SIL Open Font License ([sources](public/fonts/README.md)).

Contributions need a contributor licence agreement; see [CONTRIBUTING.md](CONTRIBUTING.md). Illustration prompts and piano provenance accompany their assets.
