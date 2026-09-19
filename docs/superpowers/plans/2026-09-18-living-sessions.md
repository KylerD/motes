# An hour in a living scene

User-approved direction: music-led, long-form sessions in the existing Listen experience. Keep the four paintings and restrained controls. A deliberate musical arc leads gradual weather/light changes and occasional small events. Preserve the corrected shared groove and quiet atmosphere mix.

## Implementation

- [x] Add a deterministic session plan: eighteen 64-bar arrangements spanning exactly 3,600 seconds, six chapters, related keys, recurring motifs, upright/felt/electric/mallet colours, and sparse events anchored to musical moments. After an hour, music continues gently and the picture stays in evening light.
- [x] Extend composition and sound with arrangement controls and calibrated instrumental colours. Preserve the current groove, voice limits, opt-in playback, pause/resume and automatic track continuity.
- [x] Use the active score position as the session clock. Skips advance to the next arrangement; scene/date changes begin a new session after the current song. Hidden tabs continue listening; Still freezes only the picture.
- [x] Add restrained evening grading, weather development and scene-specific moments. Snow: a distant train arrives, rests and leaves along the painted track. Coast: a distant boat and passing birds. Meadow: butterflies, birds, then fireflies. Rain: a passing shower and windows warming. No new dashboard or modal.
- [x] Verify deterministic timing, event sparsity, score variety, groove, full-hour scheduling, pause/skip/scene-change lifecycle, mix, desktop/mobile rendering and reduced motion. Update product/design documentation and commit locally.

## Boundaries

`src/session/session.ts` owns the pure plan and sampled scene state. `src/music/composer.ts` owns musical form and arrangement options; `sound.ts` owns timbres. `audio.ts` maps playback to session time. `src/scenes/session-effects.ts` owns scene events and evening light; the existing renderer calls it with image coordinates. `main.ts` connects them and updates the existing descriptive text.

## Motion thesis

The focal moment is the snowbound station's brief train visit during a musical lull. Long changes in light and weather establish time passing; most of the hour is quiet. Effects use bounded Canvas work and existing artwork coordinates. Session events do not recur every few seconds. Reduced motion/Still freezes the complete visual state, while music remains independently controllable.
