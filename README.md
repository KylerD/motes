# Motes

Living scenes and warm, jazzy lofi. A place to leave open while you read, work or do nothing at all.

Four original illustrated places unfold through water, weather, light and small distant movements: **Neon rain**, **Golden hour**, **Last light station** and **The last chapter**. A new local calendar day chooses a different place and a fresh musical/atmospheric edition. You can visit any place or return to a date.

## Run

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5175
```

`npm run build` produces a static `dist/` site. There is no backend, account, runtime npm dependency, API key or daily content-generation job. Web fonts come from Google Fonts with local fallbacks.

## Listen

**Listen** starts the radio. **Next track** moves to another arrangement. **Mix** controls music and atmosphere separately, offers a version without drums, and freezes scene motion without stopping the music. Preferences stay in this browser. **Find a place** changes scenery; the current song finishes and the next one belongs to the new edition. The date control revisits a day. Hide controls leaves the scene; Escape restores them.

The music is composed locally into 64-bar tracks with an opening, theme, variation, quieter passage, return and ending. Voice-led seventh/ninth chords, repeating melodic phrases, soft swung percussion and round bass accompany recordings of a real Kawai upright piano. New songs vary harmony, key, tempo, motif, performance and arrangement details deterministically from the edition and track number. The instrument samples are local CC0 assets; see [audio provenance](public/audio/README.md).

A dedicated Web Audio look-ahead clock schedules music independently of rendering. Hiding the tab stops visual rendering while audio continues; browser or operating-system suspension can still interrupt playback. Controls and media-session playback actions support pause/resume. Failed sample loading is visible and retryable.

## Living scenes, daily editions

The four paintings are authored assets, not new AI images generated each day. Each date changes the selected place and its seed for music, weather intensity, wind, light and event timing. Water reflections move; rain makes ripples, snow drifts, steam curls above cups, butterflies and distant birds pass through. A tap inside painted water makes a ripple. Reduced-motion preference starts with the scene still, independently of the radio.

The same date and place reproduce the same starting edition. An open session receives a quiet invitation at midnight instead of an abrupt change. Visiting today's edition resets to the daily place; an explicit scene URL pins a chosen place. Examples: `/?day=2026-09-17`, `/?day=2026-09-17&scene=snow`.

Artwork and exact generation prompts live in [public/scenes](public/scenes/ARTWORK.md). Paintings load on demand and crossfade between places. If an image fails, sound and controls remain available with a retry action.

## Code

| Module | Responsibility |
| --- | --- |
| `src/scenes/edition.ts` | Scene catalogue, validated local dates, deterministic daily atmosphere |
| `src/scenes/renderer.ts` | Paintings, water, light, weather, small events, transitions and ripples |
| `src/music/composer.ts` | Pure, deterministic musical form, harmony, motifs and performance |
| `src/music/sound.ts` | Sampled piano, bass, drums, reverb and atmosphere |
| `src/music/audio.ts` | Playback clock, track continuity, loading, volume and lifecycle |
| `src/main.ts`, `src/style.css` | Listening interface, daily navigation, preferences and accessibility |

The organism simulation, names, stats, experiments, lenses, save/rewind tools and all previous renderers have been removed. Git history preserves the earlier direction.

## Verify

```sh
npm test
npm run build
node scripts/verify-scenes.mjs
node scripts/verify-music.mjs
node scripts/render-music-preview.mjs
```

Browser checks need Playwright Chromium (`npx playwright install chromium`). Scene checks use port 5175, overridable with `MOTES_URL`; music checks start their own temporary server. Checks cover all four scenes on desktop and phone, daily revisiting, control panels, pause, retry, preferences, visibility events, music scheduling and bounded voice resources. The preview script renders a stereo WAV and reports peak/RMS/clipping; it can take duration, output path, seed and scene arguments.

Technical audio checks establish playback and signal health, not a claim that every generated track meets someone's musical taste. The listening experience remains the quality bar.

Original application code: CC0 / public domain. Illustration prompts and piano provenance accompany their assets.
