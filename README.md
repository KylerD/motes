# Motes

Living scenes, warm jazzy lofi, and dreamy or driving synthwave. A place to leave open while you read, work or do nothing at all.

Five original illustrated places unfold through water, weather, light and small distant movements: **Neon rain**, **Golden hour**, **Last light station**, **The last chapter** and **Top deck**. A new local calendar day chooses one of the first four and a fresh musical/atmospheric edition; Top deck waits until you choose it. You can visit any place or return to a date.

## Run

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5175
```

`npm run build` produces a static `dist/` site. There is no backend, account, runtime npm dependency, API key or daily content-generation job. Fonts, illustrations and piano samples are bundled locally; the page makes no font-service requests.

## Listen

Choose **Warm lofi**, **Dreamy** or **Drive** under **Sound & motion → Music style**, in any place. A pick is remembered and applies everywhere. **Each place’s own**, the first option, forgets it, so each place plays its own music again and Top deck opens on Drive. **Drums** is a separate On/Off choice for every style. Both preferences are remembered. Switching styles gently fades to a new musical hour while the scenery keeps its place in the evening; changing styles while paused stays paused. Both synthwaves start without downloading piano samples. If a switch to lofi cannot load its piano, the current music continues and selecting lofi again retries. If a place’s own Warm lofi cannot load, the music already playing stays on, the select names it, and choosing Each place’s own retries.

**Listen** starts the radio. **Next track** moves to another arrangement. **Sound & motion** controls music and scene sounds separately, offers a version without drums, and freezes scene motion without stopping the music. Preferences stay in this browser. **Find a place** changes scenery; the current song finishes and the next one belongs to the new edition. The date control revisits a day. **Just the scene** hides the controls; Escape restores them.

The shelter-and-mote logo, warm brown radio, amber playback button and cream settings panels give every place the same welcoming interface. Original SVG brand masters live in [public/brand](public/brand/README.md); the self-hosted Nunito Sans and EB Garamond fonts retain their [licenses and sources](public/fonts/README.md). Desktop, phone and short landscape layouts keep the listening controls within reach.

Each lofi Listen session unfolds over an hour: eighteen connected songs, six chapters, related keys and a return to the opening theme. Every song is planned before it is played: one of four shapes (a 64-bar beat tape, a 56-bar hook, a 72-bar long form, a sparse 48-bar nocturne), a hand-picked four-bar chord loop with a contrasting middle, a two-bar theme that is stated, answered, echoed and brought home note for note, and its own comping, kick-and-bass and drum feel. Neighbouring songs never share a shape, loop, comp pattern or groove; about a third of the hour is in minor keys, including both nocturnes. Upright and softened felt piano give way to mellow electric keys and occasional mallet melodies. After the hour, gentler new arrangements continue without a hard stop. The piano uses local CC0 Kawai upright recordings; electric keys and mallets are synthesized. See [audio provenance](public/audio/README.md).

In lofi, piano, melody, bass and drums share one swung performance grid. Kick accents follow the bass, backbeats sit slightly behind the shared pulse, and restrained hat patterns leave space for the piano. The short kick and filtered percussion stay soft; piano echoes follow the track tempo.

Dreamy is a synthwave with its own composer: warm detuned pads, plucked arpeggios, mellow lead hooks, rounded pulsing bass and soft electronic drums on a straight pulse. Four song families alternate across eighteen tracks: arpeggio-led night drives, bass pulses, spacious drifting pads and lead melodies. Eight authored chord loops, six hook rhythms and four arpeggio patterns give songs their identity; contrasting sections and deliberate space shape 64-, 80- and 96-bar forms. Tempos are scaled together to keep the hour exactly 3,600 seconds, with the opening theme returning at the end and quieter fresh themes after hours. All synthwave sounds are generated locally with Web Audio; no new recordings, services or downloads are needed.

Drive, Top deck's own synthwave, is a night drive through six chapters (Sunset, The drive, Night falls, Neon, The storm, Midnight) that grows darker as it goes, from melodic outrun with clean bass and bright arpeggios to darksynth with clipped bass, four-on-the-floor kicks and deep pumping. Every song has one of four shapes (an 88-bar cruise, a 112-bar drive, a 128-bar descent with a long intro, a 64-bar slow burner near 92 bpm), one minor four-chord loop and a two-bar hook, stated low in verses and high in choruses. Each song plays one of four synth voices, and the player names it: Analog synths (detuned saws), Soft pulse (a hollow pulse pad with square plucks), Glass bells (triangle bells, mostly around sunset) or Darksynth (wide, dark saw stacks with organ stabs, mostly late). Every hour uses all four, neighbouring songs never share one, and each voice brings its own snare. Each song also has one melodic focus. Either the lead carries the choruses, or the arpeggio does while the lead sings the verses and takes back the final chorus (a descent has no verses, so there the lead teases the hook in the build and sings the break low), so no bar layers more than three of pad, bass, arpeggio, lead and stabs. The opening and last songs are lead songs. Its parts share one straight sixteenth grid. Every intro builds without kick or snare: the pad plays the loop alone for four bars before the arpeggio and a soft bass pulse join, and a descent adds quiet closed hats from bar 9. The last song brings back the first song's hook and lifts to major in its final chorus; after the hour, darker arrangements continue with fresh hooks. Every synth and drum is synthesized locally, shares the lofi reverb and sits within 1.5 dB of the lofi places' loudness.

A dedicated Web Audio look-ahead clock schedules music independently of rendering. Hiding the tab stops visual rendering while audio continues; browser or operating-system suspension can still interrupt playback. Controls and media-session playback actions support pause/resume. Failed sample loading is visible and retryable.

On browsers supporting the Audio Session API, Listen requests the music playback category before starting audio so iOS Silent Mode does not mute the radio. Older iOS versions without that API may still require Silent Mode to be turned off.

## Living scenes, daily editions

The five paintings are authored assets, not new AI images generated each day. Each date changes the selected place and its seed for music, weather intensity, wind, light and event timing. Water reflections move; rain makes ripples, snow drifts, steam curls above cups, butterflies and distant birds pass through. A tap inside painted water makes a ripple. Reduced-motion preference starts with the scene still, independently of the radio.

The same date and place reproduce the same starting edition. An open session receives a quiet invitation at midnight instead of an abrupt change. Visiting today's edition resets to the daily place; an explicit scene URL pins a chosen place. Examples: `/?day=2026-09-17`, `/?day=2026-09-17&scene=snow`.

Listening gradually deepens the light, changes the weather and warms windows. A train briefly visits the snowy station, a small boat crosses the bay, birds and butterflies pass through the meadow, a shower passes over the city, and headlights sweep the top deck before a storm gathers over it. These moments belong to the hour rather than repeating every few seconds. A separate clock counts actual listening time: Pause holds it, Next changes only the music, and Still freezes only the picture. The clock continues during normal background listening and starts fresh on arrival in another edition, while the current song finishes naturally. After the hour, the scene stays in its evening state.

Every place has a matched evening painting. Over roughly fifty minutes, the sky, distance, sheltered foreground and water change at their own pace:

- **Neon rain:** bright blue clouds give way to indigo, with neon and lantern reflections across the darkening rooftop pond.
- **Golden hour:** the sunlit clearing becomes a blue, lantern-lit evening. Pollen fades, butterflies settle and fireflies appear.
- **Last light station:** the last pink leaves the mountains; snow and valley settle into winter blue around amber cafe windows and platform lamps.
- **The last chapter:** the sunset and its reflection fade together into a silver-blue bay, leaving warm reading light and harbour windows.
- **Top deck:** the banded sunset gives way to a stormy night. The sodium lamps turn amber, the tower neon brightens and the puddle becomes glassy ink; rain arrives with the storm, and soft lightning flickers in the sky, never after the hour or while the scene is still.

Water animation samples the changing painting, so reflections follow the sky. Local lamps and scene captions follow each place's lighting arc. These are five original compositions with five additional lighting states, not ten separate places. Paintings load when their place is visited; revisits reuse the decoded images, and only the active place keeps a full-size composite. If evening artwork fails, the original remains visible with a retry action.

Artwork and exact generation prompts live in [public/scenes](public/scenes/ARTWORK.md). Paintings load on demand and crossfade between places. If an image fails, sound and controls remain available with a retry action.

## Code

| Module | Responsibility |
| --- | --- |
| `src/places/` | One file per place: paintings, light arc, regions, water, lamps, events, drawings, ambience and music. `index.ts` holds the registry and the frozen daily rotation |
| `src/scenes/edition.ts` | Scene catalogue, validated local dates, deterministic daily atmosphere |
| `src/scenes/renderer.ts` | Paintings, water, light, weather, small events, transitions and ripples |
| `src/scenes/session-effects.ts` | Gradual evening light and the shared drawings: lit windows, birds and timed events |
| `src/scenes/scene-light.ts` | Spatial masks from each place's regions; cached painting compositing |
| `src/scenes/meadow-light.ts` | Meadow timing for sunlight, lantern light and fireflies |
| `src/session/environment.ts` | Listening-time clock independent of track skips and rendering |
| `src/session/session.ts` | Deterministic hour: the selected style writes the music, and the place's own style times the scenery |
| `src/music/styles/` | `MusicStyle` and `SoundBank`. `lofi/` plans the lofi hour, names its instruments and holds the piano, keys, bass and drums; `driving/` plans the night drive, composes its songs and synthesizes every sound |
| `src/music/styles/dreamy/` | Authored synthwave vocabulary, deterministic song planning/composition and synthesized voices |
| `src/music/composer/` | Pure, deterministic lofi song planning (forms, loops, rootless voicings, themes) and realisation of piano, bass, melody and drums on one swung grid |
| `src/music/sound.ts` | Shared mix, compressor, reverb, voice tracking and atmosphere; hands each note to its style's bank |
| `src/music/audio.ts` | Playback clock with each style's look-ahead, track continuity, loading, volume and lifecycle |
| `src/main.ts`, `src/style.css` | Listening interface, daily navigation, preferences and accessibility |

The organism simulation, names, stats, experiments, lenses, save/rewind tools and all previous renderers have been removed. Git history preserves the earlier direction.

### Adding a place

Create `src/places/<id>.ts` exporting a `Place`, starting from the closest existing place, and add it to `PLACES` in `src/places/index.ts`. Never add it to `DAILY_PLACES`: that list is frozen, and changing it would move every existing daily link. Until its paintings exist, a place can wait in `DRAFTS`, reachable by id but never shown.

Make the two paintings in order: first the sunset or arrival painting, then a composition-matched lighting edit of it, both 1672×941. Each needs a `.png.json` sidecar with its exact prompt and a section in [ARTWORK.md](public/scenes/ARTWORK.md). Then trace the water outline, lamps and windows from the delivered paintings, in image coordinates from 0 to 1. Choose `music.style` and give the place its own salt, titles and tempo.

`npm test` and the browser scripts then check the new place with the others: its hour, continuity, events, light, regions and paintings.

### Adding a music style

Implement `MusicStyle` in `src/music/styles/<id>/`. `planHour(random, place, seed)` writes eighteen slots spanning exactly 3,600 seconds, `compose` writes each song including after hours, `labels` supplies the interface copy, including `name`, which Sound & motion lists as a Music style option after Each place’s own, so a new style needs no HTML edit, and `bank` builds the style's instruments on the shared graph and loads their assets. `lookahead` is how many seconds ahead the player schedules its notes, and the optional `away` factor lowers a place's atmosphere while the style plays away from its home place. Register it in `STYLES` in `src/music/styles/index.ts` and declare its `limits`: tempo range, grid, and events per bar and per track. The session tests check every place's tempo, grid and song size against its style's limits. Banks load on demand: Listen prepares only the playing style's bank, a switch or a place change prepares the next one, and only Warm lofi downloads anything.

## Verify

```sh
npm test
npm run build
node scripts/verify-scenes.mjs
node scripts/verify-music.mjs
node scripts/verify-ios-audio.mjs
node scripts/verify-mix.mjs
node scripts/verify-mix.mjs dreamy
node scripts/verify-synthwave.mjs
node scripts/verify-synthwave-sound.mjs
node scripts/verify-sessions.mjs
node scripts/render-music-preview.mjs
```

Browser checks need Playwright Chromium (`npx playwright install chromium`). Scene/session checks use port 5175, overridable with `MOTES_URL`; music checks start their own temporary server. Checks cover all five scenes on desktop and phone, canvas sizing after a late viewport change with no window resize, intermediate/evening artwork, daily revisiting, control panels, pause (including song boundaries), retry for every evening asset, navigation during loading, bounded painting caches, preferences, visibility events, session continuity and bounded voice resources. The preview script renders a stereo WAV and reports peak/RMS/clipping; it takes duration, output path, seed, scene and zero-based track index arguments, so `deck` with an index renders a driving synthwave song.

Technical audio checks establish playback and signal health, not a claim that every generated track meets someone's musical taste. The listening experience remains the quality bar.

The preview command accepts an optional final style argument: `node scripts/render-music-preview.mjs 90 captures-synthwave/arpeggio.wav 20260928 rain 0 dreamy`. Indices 0, 1 and 2 preview the arpeggio, pulse and drift families. The synthwave browser check covers style loading failures, late requests, rapid switching, pause/resume, independent scenery time, preference migration and desktop/phone controls.

The dreamy synthwave sound builds from wide detuned pads into a rolling sixteenth-note bass gallop, arpeggios and electronic drums, with a thicker chord layer entering as the hook develops. Pads sustain across chord changes; four decaying dotted-eighth echoes carry the arpeggios, lead and chord accents between attacks. Filter brightness opens through the arrangement. A dedicated stereo chorus, long hall reverb and gated snare room give it its night-drive character. Each voice owns its short mono delay stages so pause and switching cancel queued echoes. `node scripts/verify-synthwave-sound.mjs` checks the rendered tail, stereo width, headroom, timed repeats, cancellation and continuity at chord changes.

The mix check renders isolated music and atmosphere stems for all five scenes, with and without drums, across all four lofi instrumental colours and all four synth voices, the synthwave sunset, slow burner and darkest songs, and the quietest late-session arrangements. Drive's sunset, loudest and last songs, at Top deck and on the coast, must sit within 1.5 dB of the lofi places' median, and lofi is also checked at Top deck. Away from Top deck, driving synthwave plays over a 3.1 dB quieter atmosphere so its sparse intros keep the 18 dB margin. At default levels and maximum weather gain, atmosphere must stay at least 18 dB below both the quiet opening and the theme in these fixtures. Scene-specific attenuation applies beneath the slider, so saved preferences receive the same calibration. Player and offline previews share the same defaults.

Original application code: CC0 / public domain. Illustration prompts and piano provenance accompany their assets.
