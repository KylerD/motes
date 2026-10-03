# Arrival-to-evening clips

User approved the design on 2026-10-03, choosing a slow pan for framing and a Share panel as the entry point. It closes the last part of gate G6 in GOAL.md ("clip export makes a valid 15 s vertical video") and is the clip that Phase 1 posts to TikTok, Reels and Shorts.

## Experience

Share now opens a cream panel, "Pass this place on.", with two actions:

- **Send a link:** the existing share-sheet, copy or show-link behaviour.
- **Make a 15-second clip:** with the line "Arrival to evening, with its music. Vertical, for Reels, TikTok and Shorts." It shows progress while it works ("Painting the evening… 40%"). When the clip is ready, a browser that can share files opens the share sheet with the video; otherwise the MP4 downloads. Either way the panel confirms quietly.

The panel follows the other panels: labelled, scrollable on short screens, closed by Escape or its close button with focus returned to Share. Closing it cancels a clip in progress. The music keeps playing throughout, and the clip never changes the live picture, clocks or preferences.

Where the browser can't encode H.264, the clip action is disabled with "Clips need a browser that can make video, such as Chrome, Edge or Safari." If the place's evening painting failed to load, the action offers the existing retry. An encoding failure says so and offers "Try again".

## The clip

- **Format:** 15.0 s, 1080×1920, 30 fps (450 frames). H.264 at about 4 Mbps with a keyframe every 2 s; AAC-LC stereo at 48 kHz and 160 kbps; MP4 with the index at the front (fast start). About 8 MB.
- **Name:** `motes-<place slug>-<day>.mp4`, for example `motes-neon-rain-2026-10-03.mp4`.
- **Place and day:** the edition currently on screen, so a revisited day makes that day's clip.
- **Layout:** the scene is drawn as a 405×720 phone viewport at a 2.667× pixel ratio, so rain, ripples and lamps keep the proportions they have on a phone.
- **Evening:** over the first 13 s the scene's listening time eases (smoothstep) from 0 to 3,420 s, by which point every place's painted light (settled at 3,000 s) and the session's dusk grade (95% of the hour) have settled; it holds for the last 2 s. Rain, water, steam, snow and fireflies move at natural speed (picture time = clip time). Session events (train, boat, birds, butterflies, windows) are omitted: at 200× they would flicker past.
- **Camera:** the cover crop's horizontal position, normally the place's fixed anchor, drifts with smoothstep easing from 15% to 85% of the available travel, left to right, across the full 15 s. Vertical crop is unchanged.
- **Overlays:**
  - Throughout: the Motes logo (`public/brand/motes-logo.svg`), 300 px wide, centred, its top edge 220 px from the top, at 85% opacity with a soft dark shadow.
  - From 12 s (fading in over 0.8 s): the place's title line in EB Garamond 72 px and "motes.sh" in Nunito Sans 34 px beneath it, centred around 36% of the height.
  - Nothing sits in the bottom 25% or the right-hand 12%, where the apps draw their own controls.
- **Sound:**
  - The edition's opening song in the listener's chosen style and drums setting, starting at the first beat of its first theme ("head") section.
  - Scene sounds underneath at the default mix level and the place's calibrated trim. The music uses the default music level, not the listener's slider.
  - Fade in over 0.3 s, fade out over the last 1.5 s.
  - Normalised towards −18 dBFS RMS, with gain limited so sample peaks stay at or below −1.5 dBFS, leaving true-peak headroom for AAC.

## Architecture

New code lives in `src/clip/`. Only `plan.ts` and the panel wiring load with the page. Everything that renders or encodes is a dynamic import, fetched when someone makes a clip.

- **`plan.ts` (pure).** Clip constants; per-frame state for a time `t` (picture time, listening time, pan position, title opacity); the music start beat for a track; the file name. No DOM.
- **`music.ts`.** Renders the clip's audio with an `OfflineAudioContext` at 48 kHz. It reuses the radio's graph and `scheduleNote`, so the clip sounds exactly like the radio. `renderPreview` in `src/music/audio.ts` gains an optional start beat, and the shared offline-rendering core moves into a function both use. Fades and normalisation are applied to the rendered buffer.
- **Scene renderer.** `SceneRenderer` gains an optional fixed size (CSS width, height and pixel ratio) used instead of measuring the canvas, and an optional pan (0–1) that replaces the place's anchor in `layout()`. Defaults leave the live renderer unchanged.
  - The clip uses its own renderer on a detached canvas, so for the length of an export a second full-size composite exists. It is disposed when the export ends; CLAUDE.md's one-composite rule is reworded to "one composite for the active place, plus one while a clip is being made".
  - Session state comes from `sessionAt` with `events` emptied.
- **`encode.ts`.** Mediabunny (MPL-2.0): `Output` + `Mp4OutputFormat({fastStart: 'in-memory'})` + `BufferTarget`, `CanvasSource` (avc) and `AudioBufferSource` (aac).
  - `canMakeClips()` checks `VideoEncoder.isConfigSupported` for `avc1.640028` at 1080×1920 without loading Mediabunny.
  - When native AAC encoding is missing (Firefox, Linux Chromium), the `@mediabunny/aac-encoder` extension (MPL-2.0; a WebAssembly build of FFmpeg's LGPL encoder) is imported and registered first.
- **`export.ts`.** `makeClip(edition, style, mode, {signal, onProgress})`:
  1. waits for both paintings and both fonts (`document.fonts.load`);
  2. renders the music;
  3. starts the output and adds the audio;
  4. draws and adds the 450 frames, awaiting the encoder after each frame for backpressure and yielding to the page (a zero-delay timeout) every few frames;
  5. finalises and returns a `File`.

  Cancelling through the signal cancels the output and disposes the renderer. It reports progress as a fraction.
- **Panel wiring in `main.ts`.**
  - Share toggles the new `share-panel`; the panel's buttons are "Send a link" (`data-share`) and "Make a 15-second clip" (`data-clip`).
  - The clip goes to `navigator.share({files})` when `navigator.canShare({files})` allows, otherwise to an `<a download>` with an object URL that is revoked afterwards.
  - Analytics gains one milestone event, `clip`, with `method` (`sheet` or `download`), `place` and `style`.

## Scripts and score

- **`scripts/verify-clip.mjs`** runs in installed Chrome, which has H.264.
  - For each of the four places, it makes a clip through the real panel, saves it, and checks with ffprobe:
    - duration 15.00 ± 0.05 s, 1080×1920, `h264` and `aac` streams, 450 video frames, `moov` before `mdat`;
    - frames at 0 s, 7.5 s and 14.5 s are extracted to `captures/clips/` for review, with mean luminance at 14.5 s below that at 0 s;
    - audio is not silent, and ffmpeg's `ebur128` true peak is ≤ −1 dBTP.
  - It also checks the panel on desktop and phone, Escape and focus return, that closing mid-export cancels and leaves no export running, and that the unsupported message appears when `VideoEncoder` is absent.
- **`scripts/render-clip.mjs [day] [place] [style]`** makes the daily clip for posting through the same path and writes it to `captures/clips/`.
- **`npm run score`:** G6's quick check looks for both controls; with `--full` it runs `verify-clip.mjs` and passes only if it does. G5 opens the Share panel along with the other panels.

## Out of scope

The numbered edition postcard, stream/OBS mode, picture-in-picture, session events inside clips, per-place camera paths and the S2 clip judges are separate work.

## Verification

Unit tests cover frame timing (450 frames, ends exact), the listening-time ease and hold, the pan ease and range, the title fade, the music start beat for lofi and synthwave tracks, and file names.

Browser and render checks:
- `verify-clip.mjs` for all four places;
- `verify-scenes.mjs` and `verify-sessions.mjs` still pass, including the live renderer's bounded composites;
- G5 accessibility with the Share panel open;
- G2 unchanged, since nothing loads or runs until a clip is requested.

Review the extracted frames and listen to one clip per place before shipping. Automated checks establish a valid, healthy file; the user judges whether it would stop a scroll.
