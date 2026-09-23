# Motes

Living scenes and warm, jazzy lofi. A place to leave open while you read, work or do nothing at all.

Four original illustrated places unfold through water, weather, light and small distant movements: **Neon rain**, **Golden hour**, **Last light station** and **The last chapter**. A new local calendar day chooses a different place and a fresh musical/atmospheric edition. You can visit any place or return to a date.

## Run

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5175
```

`npm run build` produces a static `dist/` site. There is no backend, account, runtime npm dependency, API key or daily content-generation job. Fonts, illustrations and piano samples are bundled locally; the page makes no font-service requests.

## Listen

**Listen** starts the radio. **Next track** moves to another arrangement. **Sound & motion** controls music and scene sounds separately, offers a version without drums, and freezes scene motion without stopping the music. Preferences stay in this browser. **Find a place** changes scenery; the current song finishes and the next one belongs to the new edition. The date control revisits a day. **Just the scene** hides the controls; Escape restores them.

The shelter-and-mote logo, warm brown radio, amber playback button and cream settings panels give every place the same welcoming interface. Original SVG brand masters live in [public/brand](public/brand/README.md); the self-hosted Nunito Sans and EB Garamond fonts retain their [licenses and sources](public/fonts/README.md). Desktop, phone and short landscape layouts keep the listening controls within reach.

Each Listen session unfolds over an hour: eighteen connected 64-bar arrangements, six chapters, related keys and a return to the opening theme. Upright and softened felt piano give way to mellow electric keys and occasional mallet melodies. Seventh/ninth chords, recurring phrases, soft swung percussion and round bass leave room for quieter passages. After the hour, gentler new arrangements continue without a hard stop. The piano uses local CC0 Kawai upright recordings; electric keys and mallets are synthesized. See [audio provenance](public/audio/README.md).

Piano, melody, bass and drums share one swung performance grid. Kick accents follow the bass, backbeats sit slightly behind the shared pulse, and restrained hat patterns leave space for the piano. The short kick and filtered percussion stay soft; piano echoes follow the track tempo.

A dedicated Web Audio look-ahead clock schedules music independently of rendering. Hiding the tab stops visual rendering while audio continues; browser or operating-system suspension can still interrupt playback. Controls and media-session playback actions support pause/resume. Failed sample loading is visible and retryable.

## Living scenes, daily editions

The four paintings are authored assets, not new AI images generated each day. Each date changes the selected place and its seed for music, weather intensity, wind, light and event timing. Water reflections move; rain makes ripples, snow drifts, steam curls above cups, butterflies and distant birds pass through. A tap inside painted water makes a ripple. Reduced-motion preference starts with the scene still, independently of the radio.

The same date and place reproduce the same starting edition. An open session receives a quiet invitation at midnight instead of an abrupt change. Visiting today's edition resets to the daily place; an explicit scene URL pins a chosen place. Examples: `/?day=2026-09-17`, `/?day=2026-09-17&scene=snow`.

Listening gradually deepens the light, changes the weather and warms windows. A train briefly visits the snowy station, a small boat crosses the bay, birds and butterflies pass through the meadow, and a shower passes over the city. These moments belong to the hour rather than repeating every few seconds. A separate clock counts actual listening time: Pause holds it, Next changes only the music, and Still freezes only the picture. The clock continues during normal background listening and starts fresh on arrival in another edition, while the current song finishes naturally. After the hour, the scene stays in its evening state.

Every place has a matched evening painting. Over roughly fifty minutes, the sky, distance, sheltered foreground and water change at their own pace:

- **Neon rain:** bright blue clouds give way to indigo, with neon and lantern reflections across the darkening rooftop pond.
- **Golden hour:** the sunlit clearing becomes a blue, lantern-lit evening. Pollen fades, butterflies settle and fireflies appear.
- **Last light station:** the last pink leaves the mountains; snow and valley settle into winter blue around amber cafe windows and platform lamps.
- **The last chapter:** the sunset and its reflection fade together into a silver-blue bay, leaving warm reading light and harbour windows.

Water animation samples the changing painting, so reflections follow the sky. Local lamps and scene captions follow each place's lighting arc. These are four original compositions with four additional lighting states, not eight separate places. Paintings load when their place is visited; revisits reuse the decoded images, and only the active place keeps a full-size composite. If evening artwork fails, the original remains visible with a retry action.

Artwork and exact generation prompts live in [public/scenes](public/scenes/ARTWORK.md). Paintings load on demand and crossfade between places. If an image fails, sound and controls remain available with a retry action.

## Code

| Module | Responsibility |
| --- | --- |
| `src/scenes/edition.ts` | Scene catalogue, validated local dates, deterministic daily atmosphere |
| `src/scenes/renderer.ts` | Paintings, water, light, weather, small events, transitions and ripples |
| `src/scenes/session-effects.ts` | Gradual evening light, train, boat, birds, butterflies and fireflies |
| `src/scenes/scene-light.ts` | Lighting arcs and spatial masks for all four places; cached painting compositing |
| `src/scenes/meadow-light.ts` | Meadow timing for sunlight, lantern light and fireflies |
| `src/session/environment.ts` | Listening-time clock independent of track skips and rendering |
| `src/session/session.ts` | Deterministic hour-long arrangement, chapters and environmental timeline |
| `src/music/composer.ts` | Pure, deterministic musical form, harmony, motifs and performance |
| `src/music/sound.ts` | Upright/felt piano, electric keys, mallets, bass, drums, reverb and atmosphere |
| `src/music/audio.ts` | Playback clock, track continuity, loading, volume and lifecycle |
| `src/main.ts`, `src/style.css` | Listening interface, daily navigation, preferences and accessibility |

The organism simulation, names, stats, experiments, lenses, save/rewind tools and all previous renderers have been removed. Git history preserves the earlier direction.

## Verify

```sh
npm test
npm run build
node scripts/verify-scenes.mjs
node scripts/verify-music.mjs
node scripts/verify-mix.mjs
node scripts/verify-sessions.mjs
node scripts/render-music-preview.mjs
```

Browser checks need Playwright Chromium (`npx playwright install chromium`). Scene/session checks use port 5175, overridable with `MOTES_URL`; music checks start their own temporary server. Checks cover all four scenes on desktop and phone, intermediate/evening artwork, daily revisiting, control panels, pause (including song boundaries), retry for every evening asset, navigation during loading, bounded painting caches, preferences, visibility events, session continuity and bounded voice resources. The preview script renders a stereo WAV and reports peak/RMS/clipping; it takes duration, output path, seed, scene and zero-based track index arguments.

Technical audio checks establish playback and signal health, not a claim that every generated track meets someone's musical taste. The listening experience remains the quality bar.

The mix check renders isolated music and atmosphere stems for all four scenes, with and without drums, across all four instrumental colours and the quietest late-session arrangements. At default levels and maximum weather gain, atmosphere must stay at least 18 dB below both the quiet opening and the theme in these fixtures. Scene-specific attenuation applies beneath the slider, so saved preferences receive the same calibration. Player and offline previews share the same defaults.

Original application code: CC0 / public domain. Illustration prompts and piano provenance accompany their assets.
