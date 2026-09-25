# A wider musical vocabulary

Status: design, revised after adversarial review (2026-09-25). Scope: `src/music/` composer and `src/session/session.ts` planner. Timbres (`sound.ts`) and playback (`audio.ts`) are unchanged.

## Problem

A Listen session is eighteen arrangements, but the planner only varies key, tempo, instrument colour and energy. Underneath, every track is the same song. Measured on today's composer (8 sessions, all pairs of tracks, set-Jaccard of per-bar onset skeletons):

| Part | Median pairwise similarity | Max adjacent |
| --- | --- | --- |
| Piano comping rhythm | **1.00** | 1.00 |
| Bass rhythm | **1.00** | 1.00 |
| Melody rhythm | 0.29 | 1.00 |
| Drums | 0.27 | 1.00 |

Pitch-interval n-grams look varied (median 0.03) only because transposed chord tones change the intervals; the skeleton does not change. Also: one 64-bar form with fixed section boundaries, four progressions plus one shared bridge, root-position voicings down to MIDI 48 (the piano is high-passed at 170 Hz ≈ F3, so the bottom notes are mud), kick and bass on {1, 3&} in every bar of every track, and tracks 15–17 identical to one another.

For a product whose bar is "comfortable to listen to for hours", this is the likeliest reason the music tires.

## Intent

User direction (2026-09-25): **jazzy lofi** — Nujabes / Chillhop / Jinsang territory. Richer harmony and real melodic lines, but the beat and repeated hooks lead. Anything jazz-standard (walking bass, solo choruses, busy changes) is rare seasoning at most. Taste is weighted equally with code quality.

Success means:

1. Across an hour, tracks are audibly different songs — different loops, grooves, hooks — measured below and confirmed by listening.
2. Every track still has a hook you could hum after two hearings; the hour's opening theme is recognisable when it returns at the end.
3. Nothing regresses: the shared swung eighth grid, kicks landing with bass, calm dynamics, calibrated mix, determinism, bounded events, the exact 3,600-second hour.

Non-goals: new timbres or samples, walking bass, triplets, generated "solos", tempo or key changes inside a song, a busier average texture.

## Principles

- **Loops, not sentences.** Lofi harmony is a 2- or 4-bar loop repeated, with a second-ending turnaround. Arrangement is layers entering and leaving over the loop.
- **The bass owns the root.** Piano plays rootless 4-note voicings in a warm middle register.
- **Plain sevenths are allowed.** Not every chord is a ninth; fast or passing chords are plain 7ths.
- **Space is a feature.** Melody rests are required, not incidental.
- **Taste is curated by hand.** Loops, rhythm cells, comp cells and kick/bass cells are small authored libraries. Randomness picks among good options and develops them; it does not invent rhythm.

## Architecture

Two stages inside a pure composer:

1. **Plan** — `planSong(arrangement, seed) → SongPlan`: form, per-bar harmony, mode, theme and its per-section treatment, and groove cells per section. No events.
2. **Realise** — independent realisers turn a `SongPlan` into `ScoreEvent`s: comp, bass+kick, melody, drums. Each gets its own `randomSource(songSeed ^ tag)` so velocity jitter in one part never shifts another; none reads another's output. All share `perform()`.

`src/music/composer/` replaces `composer.ts`; `index.ts` re-exports today's public API (`composeTrack`, `randomSource`, types) so `audio.ts`, `session.ts`, tests and scripts keep working with only their import path updated.

| File | Owns |
| --- | --- |
| `random.ts` | `randomSource`, `choose`, weighted choice |
| `form.ts` | Form catalogue, section roles, per-role dynamics |
| `harmony.ts` | Chord qualities, rootless shells, loop library, voice leading, chord-scale table |
| `cells.ts` | Curated data: melody rhythm cells, comp cells, kick/bass cells, drum treatments |
| `melody.ts` | Theme realisation and transformations |
| `perform.ts` | Shared swung timing (today's function, moved verbatim) |
| `comp.ts`, `bass.ts`, `drums.ts` | One realiser each |
| `plan.ts` | `planSong` |
| `index.ts` | `composeTrack`, titles, public types |

`Arrangement` loses `motif` and `progression` and gains `form`, `loop` (A-loop id), `mode` (`major`/`minor`), `comp` (head comp cell id), `groove` (kick/bass cell id), `theme` (`{cell, contour}`) and `stretch` (boolean). `Track` gains `form` and `mode`. Standalone `composeTrack(seed, mood, index)` (used by groove tests and standalone previews) draws all of these from its own RNG.

## Form

Every section is a multiple of 8 bars. A section's **role** is what realisers read; its `name` stays cosy.

Roles: `intro`, `head` (theme stated), `contrast` (B loop, theme fragment), `breath` (drums out, sparse), `stretch` (melody rests; piano answers with theme fragments), `return` (head verbatim), `tag` (thinning out).

| Form | Bars | Sections (bars) |
| --- | --- | --- |
| `beat-tape` | 64 | intro 8 · head 16 · contrast 8 · breath 8 · return 16 · tag 8 |
| `hook` | 56 | intro 8 · head 16 · contrast 8 · return 16 · tag 8 |
| `long` | 72 | intro 8 · head 16 · contrast 8 · return 16 · breath-or-stretch 8 · return 8 · tag 8 |
| `nocturne` | 48 | intro 8 · head 16 · breath 8 · return 8 · tag 8 |

`stretch` replaces `long`'s breath in at most two tracks per hour. `Track.bars` is the form's length; the event clamp becomes `bars*4 − 0.01`, and nothing is anticipated past the final bar.

Per-role dynamics (multiplier on every part's velocity, then today's per-instrument levels):

| intro | head | contrast | breath | stretch | return | tag |
| --- | --- | --- | --- | --- | --- | --- |
| .66 | 1 | .92 | .72 | .88 | 1 | .80 → .60 linear |

A bar-in-phrase contour (bars 1–8 of each phrase: 1, .96, 1, .94, 1, .97, 1.02, .93) keeps phrases breathing without changing the overall level.

## Harmony

### Qualities and voicings

Qualities: `maj7`, `maj9`, `six9`, `maj9#11` (IV is Lydian here), `min7`, `min9`, `min11`, `min6` (borrowed iv), `dom7`, `dom9`, `dom13`, `dom7sus` (9sus4), `dom7b9` (passing dominant into a minor chord), `halfdim`.

Piano plays **rootless 4-note shells** (intervals above the root):

| Quality | Shell A | Shell B |
| --- | --- | --- |
| maj7 / maj9 | 4-7-11-14 | 11-14-16-19 |
| six9 | 4-9-14-19 | 9-14-16-19 |
| maj9#11 | 4-11-14-18 | 11-14-18-19 |
| min7 / min9 | 3-7-10-14 | 10-14-15-19 |
| min11 | 3-10-14-17 | 10-14-15-17 |
| min6 | 3-7-9-14 | 9-14-15-19 |
| dom7 / dom9 | 4-10-14-19 | 10-14-16-19 |
| dom13 | 4-10-14-21 | 10-16-21-26 |
| dom7sus | 5-10-14-19 | 10-14-17-19 |
| dom7b9 | 4-10-13-19 | 10-13-16-19 |
| halfdim | 3-6-10-14 | 10-14-15-18 |

Voice leading keeps today's cost function (minimal motion plus distance from a centre), choosing between shells A/B and octaves within **55–74**, top voice ≤ 72 in `head`/`return`, centre ≈ 64. Every voicing has 4 distinct pitch classes. `Chord` keeps `root` (for bass and tests) and `notes` (the shell).

### Loops

A song has an **A loop** (4 bars, ≤ 2 chords per bar, two chords only in bar 4) played twice per 8-bar phrase; the second pass may substitute its last bar with a turnaround (ii–V, bII7 tritone, or bVII7). A **B loop** (4 bars) centres on IV or vi (major) / iv or bVI (minor) and is used in `contrast`.

`harmony.ts` holds a curated library of about 16 A loops (≈10 major, ≈6 minor) and 8 B loops, each tagged with a **family** (for adjacency rules). Examples, in scale degrees:

- major: `Imaj9 – vi9 – ii9 – V13`; `IVmaj9#11 – iii7 – vi9 – V7/vi→vi`; `Imaj7 – III7 – vi9 – ii9 V13`; `ii9 – V13 – Imaj9 – Imaj9 (bVII9)`; `IVmaj9 – ivm6 – iii7 – vi9`; today's four progressions, reduced to 4-bar loops.
- minor: `im9 – ivm9 – bVII13 – bIIImaj9`; `im11 – bVImaj9 – iiø – V7b9`; `im9 – im9 – ivm11 – bVII9`; `bVImaj7 – bVII13 – im9 – im9`.

Secondary dominants: `V/vi` (III7) weighted most, then `V/ii`, `V/IV`. `iii` is `min7` (its ninth is not diatonic). Taste limits: `dom7b9` and tritone subs at most once per 4-bar loop pass and never in `intro`, `breath` or `nocturne` (there a loop's `dom7b9` softens to `dom7sus` and turnarounds are off); `nocturne` uses only minor loops with ≤ 1 chord per bar. Final bar resolves to the tonic (maj9 or m9); `hook` may end on `ivm6`.

About a third of an hour's tracks are minor, including every `nocturne`.

### Chord scales

One table, used by the melody realiser and the hygiene test:

| Chord | Scale |
| --- | --- |
| maj7/maj9/six9 | Ionian (Lydian if `maj9#11`) |
| min7/min9/min11 | Dorian |
| min6 (borrowed iv) | Dorian |
| dom7/dom9/dom13/dom7sus | Mixolydian |
| dom7b9 | Mixolydian ♭9 ♭13 |
| halfdim | Locrian ♮2 |

A weak-beat melody note may use `(key scale ∩ chord scale) ∪ chord tones`. The intersection keeps diatonic minor chords honest: `iii` loses Dorian's ♯4 and the key's ♭9 avoid-note, and borrowed chords never pull in a note that clashes with the key.

## Melody

### Theme

A theme is two bars: a **rhythm cell** and a **contour** (steps in the chord scale). `cells.ts` holds ~12 curated two-bar cells on the eighth grid (swing applied by `perform()`), including a pickup cell, anticipations into the next bar, a sparse "call" and a held "answer". The library includes rest-heavy cells; no triplets.

Realisation per note:

- A note in the last half-beat of a bar is judged against the next bar's chord (anticipation). A held note is judged at its onset.
- Strong beats (0, 2, and a cell's marked accent) take chord tones from {3, 5, 7, 9, 13} of the chord — never the root.
- Weak-beat notes may be chord-scale tones; each non-chord tone moves by step (≤ 2 semitones) to a chord tone.
- Phrase-final notes are ≥ 1 beat and one of {3, 9, 5}.
- Register: floor = max(64, the sounding voicing's top note − 2), ceiling 81. The window is always ≥ 9 semitones, so a permitted chord tone always exists.

### Development

| Role | Treatment |
| --- | --- |
| `intro` | the theme's first bar at bars 2 and 6, velocity .28 (as full as today's opening) |
| `head` | per 8-bar phrase: theme · theme sequenced a step up · theme · cadence (the theme's first bar, tail altered, last note held into a silent final bar) |
| `contrast` | first bar of the theme, sequenced over the B loop, then rest |
| `breath` | augmented first bar (durations ×2), low velocity |
| `stretch` | melody rests; comp's upper voice answers with theme fragments |
| `return` | head verbatim |
| `tag` | theme's first three notes, then a long tone |

Answers default to tail alteration (the last 2–3 notes change), not inversion.

### Across the hour

The session carries an **hour theme**. Track 0 states it; track 17 returns it over track 0's loop and key; tracks 15 and 16 take its rhythm cell with new contours and loops, so the return is prepared rather than repeated three times. Other tracks use a **cousin**: the hour theme's rhythm with a new contour, or its contour with a new rhythm, alternating by chapter. After hours (cycle ≥ 1) uses fresh themes.

## Groove

`perform()` is today's timing function, moved verbatim: every non-piano event lands on the swung eighth grid within ±0.025 beats. Nothing in this design needs sixteenths.

**Comp cells** are two bars (onsets per bar pair, bar 1 | bar 2):

| Cell | Onsets | Use |
| --- | --- | --- |
| `roll` | 0 + 2.5 answer \| 0 | `beat-tape` default; today's sound |
| `stab` | 1.5, 3.5 \| 1.5 | head/return in major loops at energy ≥ .7 |
| `push` | 0 \| 3.5 (tied; next bar's downbeat omitted) | `hook` heads |
| `halves` | 0, 2 \| 0 | contrast, stretch |
| `charleston` | 0, 1.5 \| 0 | at most 8 bars per song |
| `pad` | 0 \| 0 (held, re-struck) | breath, nocturne breath and tag |

`pad` re-strikes each bar (a held two-bar chord is too thin against the atmosphere). The intro keeps today's opening texture (rolled chord every bar, bass from bar 4, drums from bar 4 at energy ≥ .65) in every form: today's quietest opening sits only 0.2 dB inside the 18 dB atmosphere margin.

**Kick + bass cells** move together (kicks always land on a bass note):

| Cell | Onsets |
| --- | --- |
| `home` | 0, 2.5 (today) |
| `skip` | 0, 1.5, 2.5 |
| `late` | 0, 3.5 |
| `lean` | 0, 1.5 |

Bass plays the root on the downbeat, fifth or octave on the second onset, and a scale/chromatic approach note (on an eighth, no kick) into the next chord in the last bar of each 4-bar loop. Bass register 36–48.

**Drums**: today's three hat/kick variants, plus:

- `ghost` — ghost snares at velocity ≤ .1 on the 2& and 4& eighths of alternate bars;
- `halftime` — snare on 3 only, for low-energy returns;
- phrase-end treatment on the last bar of each 8-bar phrase, not repeated consecutively: nothing (most common), hat drop on beat 4, a two-note ghost pickup on 3 and 3.5, or a **dropout bar** (kick and snare out) before a `return`.
- Drums out in `breath`; `nocturne` uses hats and rim only, and none below energy .55.

No new drum sounds.

## Session planner

The planner picks one of three **authored form sequences** for the hour (seeded), each with Σbars = 1128 (5 × 64, 6 × 72, 5 × 56, 2 × 48), no adjacent repeats, `beat-tape` or `hook` at tracks 0 and 17, a `nocturne` at track 10 (energy .5, a mix fixture) and one at 16, and never `nocturne` at track 8 (the snow train's slot). Fixed Σbars keeps the tempo scale ≈ 0.99 (today 1.01), inside the 68–88 BPM band by construction.

It then assigns loops, comp cells and kick/bass cells so adjacent tracks share none of: form, loop family, head comp cell, kick/bass cell. Assignment is a seeded greedy pass with a fixed fallback order (it can't fail: every library has ≥ 3 entries per mode). `stretch` goes to at most two `long` tracks at energy ≥ .8. Modes: minor on every nocturne plus four other tracks spread across chapters.

Slot duration is `bars*4*60/bpm`, scaled so the eighteen sum to exactly 3,600 s. Voices, energies, key steps, chapters and captions stay. After hours reuses the form sequence with fresh themes and energy capped at .66, so slot and track lengths continue to match.

## Testing

Existing tests stay, adjusted where they assumed one form: `bars ∈ {48, 56, 64, 72}`, `harmony.length === bars`, sections tile `[0, bars)`; first `head` melody equals `return` melody in every form; no kick in `breath`; session durations sum to 3,600 s with `slot.duration === bars*4*60/bpm`. The grid and kick-with-bass tests remain the contract, unchanged.

New tests (absolute thresholds; 8 fixture sessions, two per mood):

1. **Distinctness.** Set-Jaccard on per-bar onset skeletons (2-bar n-grams) and on melody n-grams of (interval, onset gap):
   - adjacent tracks: comp skeleton ≤ .5, kick/bass skeleton ≤ .5, melody ≤ .3, harmony root-motion 4-grams ≤ .5;
   - median over all pairs: comp ≤ .5, bass ≤ .5 (today both 1.0).
2. **Hook and space.** In every track, ≥ 40% of melody 4-grams occur at least twice, and ≥ 25% of bars from `head` through `tag` are melody-silent. Distinctness cannot be bought with noise.
3. **Theme return.** Melody similarity of track 17 to track 0 ≥ .6; tracks 15 and 16 share track 0's rhythm cell; tracks 15–17 are pairwise different.
4. **Melodic hygiene.** Against the chord-scale rule with anticipations: strong-beat notes are chord tones other than the root; non-chord tones are permitted scale tones and resolve by step; phrase endings in {3, 9, 5} and ≥ 1 beat; register within bounds.
5. **Harmony.** Shells have 4 distinct pitch classes within 55–74; ≤ 2 chords per bar; `dom7b9`/tritone limits; `nocturne` vocabulary; final bar resolves.
6. **Planner.** All three sequences: Σbars, adjacency, nocturne positions, stretch quota, BPM band across 200 seeds per mood.
7. **Bounds.** Events per track < 2,600; no bar above 34 events (today's maximum is 30); mean ≤ 19 events per bar (today 17.3).

Scripts: `verify-music.mjs`, `verify-mix.mjs` (atmosphere ≥ 18 dB below music including index 10's nocturne) and `verify-sessions.mjs` pass. `render-music-preview.mjs` renders before/after previews for one seed and a medley (35 s from each of one session's eighteen tracks).

**Listening gate.** Numbers establish variety, not taste. The rendered medley and full-length previews are reviewed by ear before each commit, and the user's listening is the final judgement.

## Delivery

Three commits, each shippable and each gated by the full test suite, scripts and a rendered listen:

1. **Harmony and melody** — module split with `perform()` moved verbatim, rootless voicings, loop library, minor mode, chord scales, themes and development, hour-theme cousins; form stays `beat-tape`.
2. **Forms and planner** — the other three forms, per-role dynamics, authored form sequences, adjacency assignment, duration math.
3. **Groove** — comp cells, kick/bass cells, bass approaches, drum treatments, stretch.

README's module table and the composer description are updated in the commit that changes them.

## Risks

- **Busier is not better.** Events-per-bar ceiling, space test, `pad`/`halves` comping, stretch quota.
- **Generated melodies wander.** Authored rhythm cells, chord-tone strong beats without roots, stepwise resolution, verbatim returns, hook test.
- **Mix drift in quiet passages.** Pad velocity floor; `verify-mix` includes the nocturne slot.
- **Theme identity lost.** Cousins share rhythm or contour; return floor test.
- **Library taste.** The curated loops and cells are the product; they are reviewed by ear, not only by test.

## Build notes (2026-09-25)

Decisions changed while building, each forced by a test or a check:

- **Rhythm skeletons use weighted Jaccard.** Set-Jaccard rated "mostly roll, some halves" identical to "mostly halves, some roll". Comp and bass skeletons are compared as counted two-bar n-grams.
- **Hook share counts occurrences:** ≥ 40% of a track's melody 4-gram occurrences belong to a figure heard at least twice.
- **The theme owns its anchor degree** (third or fifth of the key), so track 17 restates track 0's theme at the same pitch.
- **Cousins rotate by track, not by chapter:** same rhythm with a new contour, then same contour with a new rhythm, then a fresh theme. Chapter-wide sharing put the same rhythm cell next to itself.
- **Charleston alternates phrase by phrase with halves** (never more than 8 bars running), and the planner keeps charleston and halves songs apart.
- **Comp answers play from energy .5** (was .6): below it every cell collapsed to a lone downbeat, and quiet songs all sounded alike.
- **The intro plays the comp's answers at level .76** (was .66, no answers). Rootless voicings carry less energy than the old root-position chords; this restores the opening's atmosphere margin (worst case −18.6 dB, previously −18.2 dB).
- **Returns reuse the head's voicings**, not just its chords, so the verbatim melody sits exactly as it did.
- **Loops are spread across the hour:** the planner picks among the least-used loops; no loop appears more than twice in tracks 0–16.
- Plain `min7`, `dom7` and `halfdim` carry no non-diatonic ninth: `min7` and `halfdim` take the 11th, `dom7` its root.
- **After the final review:** the melody anchor is placed so the whole contour (sequenced up to two steps) sits in 68–80 and the contour ceiling is +4; the realiser follows the contour's direction when snapping would stall or reverse it, and avoids a minor ninth over a sounding piano note. Two-chord bars always state the second root in the bass and the second voicing in the piano, and voicings lift before a chord change. Intro bars 0–3 carry a soft bass root. The turnaround belongs to the song's identity, so track 17's head matches track 0's. The hour opens on a tonic-first loop; `tide` now owns its tonic. Fixture sessions use distinct seeds (plans depend on the seed alone).
