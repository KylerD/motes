# A wider musical vocabulary — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-template composer with a plan-then-realise composer (loops, rootless voicings, themes, forms, groove cells) so an hour of Motes is eighteen different jazzy-lofi songs.

**Architecture:** `src/music/composer/` (pure, deterministic) plans a song from an `Arrangement`, then independent realisers emit `ScoreEvent`s through the unchanged swung `perform()` grid. `src/session/session.ts` assigns forms, loops, cells and themes across the hour under adjacency rules and exact 3,600 s timing.

**Tech Stack:** TypeScript (strict, bundler resolution), Vitest, Vite, Playwright scripts, Web Audio (unchanged).

**Spec:** `docs/superpowers/specs/2026-09-25-composer-vocabulary-design.md`

## Global Constraints

- The composer is pure: no `Math.random`, no wall time; the same inputs give `toEqual` output.
- Every non-piano event lies within ±0.025 beats of the swung eighth grid; every kick coincides (±0.015) with a bass onset.
- Events per track < 2,600; no bar > 34 events; mean ≤ 19 events per bar.
- 68 < bpm < 88 in every session track; the eighteen slots sum to exactly 3,600 s and `slot.duration === bars*4*60/bpm`.
- Notes 24–88, velocity (0, 1], duration > 0, beat in `[0, bars*4)`.
- Voicings: 4 distinct pitch classes within MIDI 55–74. Bass 36–48. Melody 64–81 and ≥ the sounding voicing's top − 2.
- Intro texture is today's (rolled chord every bar, bass from bar 4, drums from bar 4 at energy ≥ .65, melody fragments bars 2 and 6).
- `sound.ts` and `audio.ts` are not modified; imports of `'./composer'` / `'../music/composer'` keep working.
- `verify-mix.mjs`: atmosphere ≥ 18 dB below music for opening and theme windows at indices 0,1,3,6,9,10,17.

## Review Focus

1. Standalone `composeTrack(seed, mood, index)` (groove tests, standalone previews) must still produce a complete, valid song with no arrangement — test seeds 0–19 in every mood.
2. After-hours tracks (`index ≥ 18`) must honour the same forms/durations and energy cap and differ from the first hour — covered by the session after-hours test.
3. Two-chord bars and anticipations (note at x.5 in beat 3.5) must be judged against the right chord — hygiene test uses `chordAt(beat)` with the anticipation rule.
4. `push` comping must never leave a bar with no chord attack and no tie — test: every bar with harmony has a piano onset in it or a piano note sounding across its downbeat.
5. The mix's quiet windows (opening 1–12 s, theme 30–45 s) at index 10 (nocturne) — run `verify-mix.mjs` in Tasks 3 and 5.

---

### Task 1: Module split with behaviour preserved

**Files:** Create `src/music/composer/{types,random,perform,index}.ts`; delete `src/music/composer.ts`. Tests unchanged.

**Produces:** `types.ts` — all public types (existing plus `Mode`, `FormName`, `Role`, `Quality`, `Theme`, `CompCell`, `GrooveCell`); `random.ts` — `randomSource(seed)`, `chooser(random)`; `perform.ts` — `performer({swing, songSeed, random, bars, voice})` returning `{events, add(instrument, beat, note, duration, velocity, pan?, roll?)}` using today's pocket table, phrase drift, backbeat, keyVoice and clamp `bars*4 − 0.01`.

- [ ] Move code verbatim; `index.ts` keeps `composeTrack` and re-exports types and `randomSource`.
- [ ] `npm test` passes unchanged (proves the move is behaviour-preserving). `npm run build` passes.
- [ ] Commit `refactor: split the composer into modules`.

### Task 2: Harmony — qualities, shells, loops, chord scales

**Files:** Create `src/music/composer/harmony.ts`; Test `tests/harmony.test.ts`.

**Produces:**
- `SHELLS: Record<Quality, [number[], number[]]>` (spec table), `MELODY_TONES: Record<Quality, number[]>` (chord tones excluding root: maj 4,7,11,14 · six9 4,7,9,14 · maj9#11 4,7,11,14,18 · min7/min9 3,7,10,14 · min11 3,7,10,14,17 · min6 3,7,9,14 · dom7/dom9 4,7,10,14 · dom13 4,10,14,21 · dom7sus 5,7,10,14 · dom7b9 4,7,10,13 · halfdim 3,6,10,14), `CADENCE_TONES` (3rd, 9th, 5th; sus uses 9th, 5th), `CHORD_SCALES`.
- `LOOPS: Loop[]` with `{id, mode, bars: [degree, Quality][][], turn: boolean, nocturne: boolean}` — 10 major, 6 minor; `B_LOOPS` 4 major, 3 minor; `TURNAROUNDS: Record<Mode, [degree, Quality][][]>` (major: ii9–V13, ii9–bII9, bVII9; minor: iiø–V7b9, bVII13).
- `voice(root, quality, previous, top): number[]` — rotations × octaves of both shells within 55..top, cost = motion + 0.9·|centre − 64|.
- `allowedPitchClasses(chord, keyScale): Set<number>` = (key ∩ chord scale) ∪ chord tones.
- `buildHarmony(sections, loop, bLoop, turn, mode, tonic): Chord[][]` — per bar one or two `Chord {root, quality, notes, beat}`; per spec roles; softening in intro/breath/nocturne; tag ends on tonic (hook-major may end on ivm6).

Tests (write first, see them fail, then implement): every loop/B loop is 4 bars with ≤ 2 chords per bar and 2 only in bar 4; every voicing for every quality × 12 roots × 2 tops (72, 74) has 4 distinct pcs within bounds; no loop pass contains more than one `dom7b9` or tritone sub; nocturne-flagged loops are minor with single-chord bars and no `dom7b9`; `allowedPitchClasses` for iii in C excludes F and F♯.

- [ ] Commit with Task 3.

### Task 3: Melody, cells, and the harmony+melody composer (commit 1)

**Files:** Create `src/music/composer/{cells,melody,form,comp,bass,drums,plan}.ts`; Modify `index.ts`, `src/session/session.ts` (arrangement fields, hour theme, loops, modes; form fixed to `beat-tape`), `tests/music.test.ts`, `tests/session.test.ts`; Create `tests/similarity.ts` (exists), `tests/variety.test.ts`, `tests/melody.test.ts`.

**Produces:** `MELODY_CELLS` (12 authored two-bar cells, eighth grid, last note ≥ 1 beat, no overlaps), `COMP_CELLS`, `GROOVE_CELLS`, `FORMS`, `ROLE_DYNAMICS`, `PHRASE_CONTOUR`; `realiseMelody(plan, add)`, `realiseComp`, `realiseBass` (returns bass onsets; kicks drawn by drums from the same groove cell), `realiseDrums`; `planSong(arrangement, songSeed): SongPlan`; `makeTheme(random, cell?, contour?)`; `Track` gains `form`, `mode`, `sections[].role`, `harmony: Chord[][]`.

Melody rules (spec): contour steps in key scale from an anchor near 72; strong (beat 0/2 of a bar or duration ≥ 1) → nearest `MELODY_TONES`; phrase-final → `CADENCE_TONES`; weak → nearest allowed pc; then every non-chord tone whose next note is not a chord tone within 2 semitones snaps to a chord tone; register `[max(64, top − 2), 81]`; a note at bar-beat 3.5 uses the next bar's chord.

Tests: hygiene (above) for 8 sessions; head melody equals return melody; first-hour similarity/hook/space thresholds from the spec for melody and harmony; theme return (17 vs 0 ≥ .6, 15 and 16 share 0's cell); determinism; existing groove tests.

- [ ] Write tests; run and see failures; implement; run `npm test`, `npm run build`.
- [ ] `node scripts/verify-mix.mjs`, `node scripts/verify-music.mjs`, `node scripts/verify-sessions.mjs` (dev server on 5175) pass.
- [ ] Render previews (`render-music-preview.mjs 150 captures-music/after/rain-0.wav 20260917 rain 0` and a medley) and listen/inspect RMS; README composer description updated.
- [ ] Commit `feat: give every Motes song its own loop and melody`.

### Task 4: Forms and planner (commit 2)

**Files:** Modify `form.ts`, `plan.ts`, `src/session/session.ts`, tests.

- [ ] `FORMS` gains `hook` (56), `long` (72), `nocturne` (48) per spec; `FORM_SEQUENCES` (three authored 18-slot sequences, Σbars 1128, nocturne at 10 and 16, never at 8, B/H at 0 and 17).
- [ ] Planner: durations `bars*4*60/bpm`, tempo scale; seeded greedy loop/comp/groove assignment with adjacency exclusion and fixed fallback order; minor on nocturnes + one track in each of chapters 1, 2, 4 and one in chapter 5 (not 17); stretch on ≤ 2 `long` tracks with energy ≥ .8.
- [ ] Tests: planner rules across 200 seeds per mood; sections tile; no kick in breath; after-hours.
- [ ] Scripts + previews; commit `feat: let Motes songs take different shapes`.

### Task 5: Groove (commit 3)

**Files:** Modify `cells.ts`, `comp.ts`, `bass.ts`, `drums.ts`, tests.

- [ ] Comp cells (roll, stab, push, halves, charleston ≤ 8 bars, pad) by role; stretch fragments; kick/bass cells (home, skip, late, lean) with approach notes; drum ghost/halftime/phrase-end treatments; nocturne drums.
- [ ] Tests: adjacent comp and kick/bass skeleton ≤ .5, medians ≤ .5; density bounds; push coverage (Review Focus 4); grid/kick tests.
- [ ] Scripts + previews + medley; README; commit `feat: vary the Motes rhythm section from song to song`.
