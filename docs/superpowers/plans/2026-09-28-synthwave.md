# Synthwave Radio Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task with a fresh final review.

**Goal:** Build the approved dreamy synthwave mode, with contrasting music and reliable switching.

**Architecture:** Dedicated deterministic synth composer, bounded synthesized voices, shared playback clock and separate environment plan. Existing lofi composition stays unchanged.

**Tech Stack:** TypeScript, Web Audio, Vitest, Vite, Playwright; no new dependencies.

**Spec:** docs/superpowers/specs/2026-09-28-synthwave-design.md

## Global Constraints

- Eighteen tracks total exactly 3,600 seconds; 84–112 BPM for synthwave.
- Keep lofi, daily seeds, reduced motion, piano retry and no-drums preferences working.
- Style switches preserve environment progress/event timing and paused state.
- Bound scheduled voices and explicitly stop every oscillator on cancellation.
- Provide three contrasting rendered previews; do not claim automated checks prove taste.

## Review Focus

1. Switching from synthwave with no piano bank to lofi, including failed or late sample loads.
2. Rapid switching near a song boundary, then pause/resume: no stale notes or duplicated clocks.
3. Style changes after visiting another scene: correct environment and latest edition.
4. Persisted old/invalid preferences: default to lofi and retain no-drums choice.
5. Synth voice tails and auxiliaries: no leaked oscillators after pause/disposal.

### Task 1: Musical vocabulary

Files: src/music/synthwave/{catalog,composer}.ts, src/music/composer/types.ts, src/session/session.ts, tests/synthwave.test.ts.

Interfaces: MusicStyle = lofi | synthwave; SynthArrangement; planSynthwave(seed) produces arrangements; composeSynthwave(seed,mood,index,arrangement) produces Track. createSession(seed,mood,style='lofi') chooses a plan; composeSessionTrack dispatches its composer.

- [x] Write tests for exact timing, valid events, deterministic hooks/returns, family and rhythm variation, after-hours and unchanged default lofi.
- [x] Run npm test -- tests/synthwave.test.ts; expect missing synth behaviour to fail.
- [x] Implement curated loops, four forms/families and contrasting part realisation; use straight timing, preserve repeats and space.
- [x] Run npm test and npm run build; expect success.

### Task 2: Sound and switching

Files: src/music/synthwave/sound.ts, src/music/sound.ts, src/music/audio.ts, scripts/verify-synthwave.mjs.

Interfaces: synth scheduling returns owned Voice resources; RadioAudio.setStyle(style): Promise<void>; current includes style/family. Separate environment plan from music. renderPreview accepts style.

- [x] Add executable browser tests for style switching, no sample dependency, sample failure/retry, paused state, environment continuity and rapid changes; run and observe failure.
- [x] Implement sounds and explicit oscillator ownership, lazy piano loading, latest-choice handling, fades and cancellation.
- [x] Run browser lifecycle checks and rendered PCM checks in both drum modes; expect bounded voices, no browser errors/clipping or unintended silence.

### Task 3: Controls and delivery

Files: src/main.ts, index.html, scripts/render-music-preview.mjs, README.md, PRODUCT.md, DESIGN.md; extend browser checks.

- [x] Add browser coverage for saved synth style, old/invalid preferences, independent drums and phone panel access; observe failure.
- [x] Add labelled style selector and separate drums selector, save preferences, show loading/retry errors and instrument labels.
- [x] Render three contrasting previews of at least 90 seconds. Run npm test, npm run build, verify-music, verify-mix, verify-sessions, verify-scenes and verify-synthwave; inspect desktop/phone screenshots.
- [x] Update docs; request a fresh whole-change review, resolve important findings, and commit the verified feature locally.

### Sound revision: rolling gallop, reverb and thicker build

- [x] Reproduce the missing sixteenth-note gallop and weak reverb tail with score and rendered-audio checks.
- [x] Add articulated saw/sub bass, detuned synth layers, progressive filter opening and delayed chord entrances.
- [x] Add dedicated stereo chorus, hall reverb and gated snare room with explicit resource ownership.
- [x] Pass 60 tests, the production build, synthwave and lofi lifecycle checks, and the rendered tail/width check. Render revised night-drive, pulse and drift previews.
- [x] Obtain a fresh review of the sonic revision and effect lifecycle; no new actionable findings.
- [x] Pass the revised synthwave mix sweep across 56 combinations of scenes, track families, late-session tracks and drum settings.
