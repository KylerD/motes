# A wider musical vocabulary

Status: design, awaiting review. Scope: `src/music/` composer and `src/session/session.ts` planner. Timbres (`sound.ts`) and playback (`audio.ts`) are unchanged.

## Problem

A Listen session is eighteen arrangements, but the planner only varies key, tempo, instrument colour and energy. Underneath, every track is the same song:

- one 64-bar form with fixed section boundaries (0 / 8 / 24 / 32 / 40 / 56 / 64);
- four eight-bar progressions, and the same bridge progression in every track;
- four motifs of 2–3 chord-tone indices; the phrase skeleton (bars 2/6 at beats 1.5 and 2.5, single held note in bars 3/7) is fixed;
- one comping rhythm (rolled downbeat plus an and-of-three answer) in every bar;
- three drum variants, no fills; one bass shape.

For a product whose bar is "comfortable to listen to for hours", this is the likeliest reason the music tires. Timbre changes disguise repetition for a few tracks, not an hour.

## Intent

User direction (2026-09-25): **jazzy lofi** — Nujabes / Chillhop / Jinsang territory. Richer harmony and real melodic lines, but the head-nodding beat and repeated hooks lead. Walking bass and solo-like passages are rare seasoning, not the default. Taste is weighted equally with code quality.

Success means:

1. Across an hour, tracks are audibly different songs, not re-voicings — measured (below) and confirmed by listening.
2. Every track still has a hook you could hum after two hearings; the opening theme's return near the end of the hour is recognisable.
3. Nothing regresses: shared groove, calm dynamics, calibrated mix, determinism, bounded events, exact 3,600-second hour.

Non-goals: new timbres or samples, generative "improvised solos", tempo changes inside a song, key changes inside a section, anything that makes the music busier on average.

## Approach

Two stages inside a pure composer:

1. **Plan** — `planSong(arrangement, random) → SongPlan`: form, per-bar harmony, the song's theme and how each section treats it, and groove choices per section. No events.
2. **Realise** — independent realisers turn a `SongPlan` into `ScoreEvent`s: `comp`, `bass`, `melody`, `drums`. Each takes the plan and the shared `perform()` timing function; none reads another's output.

Rhythm cells for melody and comping are **hand-authored** (a small curated library); pitches are generated from harmony. Rhythm is where generated melody most often sounds mechanical, and it is the cheapest place to apply taste by hand.

### Modules

`src/music/composer/` replaces `composer.ts`; `src/music/composer/index.ts` re-exports today's public API (`composeTrack`, `randomSource`, types) so `audio.ts`, `session.ts`, tests and scripts keep their imports.

| File | Owns | Depends on |
| --- | --- | --- |
| `random.ts` | `randomSource`, `choose`, weighted choice | — |
| `form.ts` | Form catalogue and section roles | — |
| `harmony.ts` | Chord vocabulary, progression grammar, voice leading | `random` |
| `cells.ts` | Curated melody rhythm cells and comping patterns (data only) | — |
| `melody.ts` | Theme generation and transformations | `harmony`, `cells`, `random` |
| `groove.ts` | Comp, bass and drum realisers; `perform()` shared timing | `form`, `cells` |
| `plan.ts` | `planSong` | all of the above |
| `index.ts` | `composeTrack`, titles, public types | `plan`, `groove`, `melody` |

Each file stays small enough to read in one sitting (target < 200 lines, matching the repo's density).

## Form

A form is a list of sections, each with a **role** that realisers read. Section `name` stays cosy and human (it is not shown in the UI today but appears in debug state).

Roles: `intro`, `head` (theme stated), `answer` (theme varied), `contrast` (new harmony, theme developed), `breath` (drums out, sparse), `stretch` (melody rests, piano fills with theme fragments), `return` (theme verbatim), `tag` (ending, thinning out).

| Form | Bars | Sections (bars) | Character |
| --- | --- | --- | --- |
| `beat-tape` | 64 | intro 8 · head 16 · contrast 8 · breath 8 · return 16 · tag 8 | Today's shape, kept as one option |
| `standard` | 72 | intro 4 · head 8 · answer 8 · contrast 8 · return 8 · stretch 16 · return 16 · tag 4 | AABA head, a chorus of piano over the changes, head out |
| `hook` | 56 | intro 4 · head 8 · answer 8 · contrast 8 · head 8 · breath 8 · return 8 · tag 4 | Short verse/hook loop, most "beat tape" |
| `nocturne` | 48 | intro 8 · head 12 · breath 8 · answer 12 · tag 8 | Sparse, drums light or absent, augmented theme; after-hours default |

`Track.bars` is the form's length. The event beat clamp becomes `bars*4 - 0.01`. `standard` is the only form with a `stretch` section; it is where walking bass may appear (see Groove).

## Harmony

Chord qualities: `maj9`, `six9`, `min9`, `min11`, `dom9`, `dom13`, `dom7sus` (9sus4), `dom7alt` (b9, used only as a passing dominant), `halfdim` (m7b5). Extensions are chosen for lofi colour; every chord still voices 4–5 distinct pitch classes.

Progressions are built from **blocks** of 1–4 bars, written in scale degrees:

- `I` (maj9 / six9, 1–2 bars)
- `ii–V` (min9 → dom9|dom13|dom7sus, one bar each or two per bar at a turnaround)
- `iii–vi` (min9 → min9|dom7alt as V/ii)
- `IV–iv` (maj9 → borrowed min9|min11)
- `bVII7` (dom9, backdoor into I)
- `tritone` (bII7 replacing V, only before I)
- `V/x` secondary dominant into ii, iii or IV
- `vi` tonic substitute, `iiø–V/vi` minor ii–V into vi

A song's **A progression** is an 8-bar sentence from a grammar: opening block from {`I`, `IV–iv`, `vi`}, middle from {`iii–vi`, `V/x`, `I`}, cadence from {`ii–V`, `tritone`, `bVII7`}, landing on I (or vi for a deceptive `answer`). **B progression** (contrast) moves the tonal centre to IV or vi for 4–6 bars and returns via a ii–V. At most 2 chords per bar, and only in the last two bars of an 8-bar phrase.

Taste rules, enforced in `harmony.ts`:

- `dom7alt` and `tritone` appear at most once per 8 bars, never in `intro` or `nocturne`.
- `nocturne` uses only I, IV–iv, vi, ii–V (slow harmonic rhythm: some chords last 2 bars).
- The four current progressions remain in the grammar as fixed "classic" sentences so the old sound stays reachable.

Voice leading keeps today's `voiceChord` cost function (range 48–76, minimal motion, centre ≈ 62). The final bar resolves to I maj9 except `hook`, which may end on a IV–iv plagal colour.

Each progression gets a **family** id (its opening block + cadence type) used by the planner for adjacency rules.

## Melody

### Theme

A theme is two bars: a **rhythm cell** (from `cells.ts`) and a **contour** (sequence of scale-degree steps). It is realised per bar against the underlying chord:

- Strong-beat notes (on beats 0/2, or the cell's marked accent) are chord tones, chosen nearest to the contour's target.
- Weak-beat notes may be scale tones (passing or neighbour); every non-chord tone resolves by step to a chord tone on the next note.
- Range: a 10th, centred in 64–79, never below the comp's top voice.
- Every phrase ends on a longer note (≥ 1 beat) that is a chord tone.

`cells.ts` holds ~12 curated two-bar rhythm cells (onsets + durations, eighth-note grid, swung by `perform()`). They include anticipations across the barline, a pickup cell, a three-note "call" and a held-note "answer". At most one cell uses triplets and it is excluded from `beat-tape`/`hook` heads.

### Development

Transformations are pure functions `Theme → Theme`, used by section role:

| Role | Treatment |
| --- | --- |
| `head` | theme, theme sequenced (contour transposed to fit the new chord), theme, cadence cell |
| `answer` | same rhythm, contour inverted or tail altered; ends on a different chord tone |
| `contrast` | theme fragment (first bar) sequenced over B harmony, then silence |
| `breath` | augmented (durations ×2), first bar only, low velocity |
| `stretch` | melody rests; comp right hand plays theme fragments in the gaps |
| `return` | head verbatim (identical notes) |
| `tag` | theme truncated to its first 3 notes, then a final long tone |

Hook repetition is preserved: the `return` section's melody equals the first `head` exactly.

### Across the hour

The session carries an **hour theme** (rhythm cell + contour). Track 0 and tracks 15–17 use it; other tracks use a **cousin**: the hour theme's rhythm with a new contour, or its contour with a new rhythm, alternating by chapter. This keeps the hour's identity while making each song its own. After hours (cycle ≥ 1) draws fresh themes that are not cousins.

## Groove

`perform()` is today's timing function moved verbatim: one swing, the same pocket table, phrase drift and backbeat offset. Every realiser calls it. The existing grid tests remain the contract.

**Comp patterns** (`cells.ts`), one per section, energy-gated:

| Pattern | Onsets per bar | Use |
| --- | --- | --- |
| `roll` | 0 (rolled) + 2.5 answer | today's sound; default in `beat-tape` |
| `charleston` | 0, 1.5 | `head`/`return` at energy ≥ .7 |
| `push` | 0, 3.5 tied into next bar | `hook` heads |
| `halves` | 0, 2 | `answer`, `contrast` |
| `pad` | 0 held full bar | `breath`, `nocturne`, `intro` at low energy |

In `stretch`, comp uses `halves` plus theme fragments in the right hand at the melody's register and velocity 0.26–0.32.

**Bass**: root on 1, fifth or octave answer on the and-of-3 (today), plus a chromatic or scale approach note into the next chord on beat 4& in the last bar of each 4-bar group. **Walking bass** (quarter notes, chord tones on 1/3, approach on 4) only in a `standard` form's `stretch` section and only when `energy ≥ .8`; the planner allows at most two per hour.

**Drums**: existing three variants, plus:

- `ghost` — two ghost snares (velocity ≤ .1) on 1.75 and 3.75 in alternate bars;
- `halftime` — snare on 3 only, for `answer` in low-energy tracks;
- phrase-end treatments at the last bar of 8-bar phrases, one chosen per phrase, never twice in a row: nothing (most common), hat drop (beat 4 hats out), a 3-note ghost-snare pickup, or a **dropout bar** (kick and snare out, hats kept) before a `return`.
- Drums stay out in `breath`; `nocturne` uses hats and rim only, or no drums below energy .55.

No new drum sounds: every instrument maps to today's `kick`, `snare`, `hat`, `rim`.

## Session planner

`Arrangement` gains `form`, `family` (harmony family), `comp` (head comp pattern), `theme` (`{cell, contour}`) and `walking` (boolean). The planner:

- chooses a form sequence for the hour where no two adjacent tracks share a form, track 0 and track 17 use `beat-tape` or `hook`, and at least one `nocturne` falls in chapter 4 ("Room to breathe");
- never places adjacent tracks with the same harmony family or head comp pattern;
- keeps today's voices, energies, key steps and chapter captions;
- computes each slot's duration as `bars*4*60/bpm` and scales tempos so the eighteen still sum to exactly 3,600 s (tempo stays within 68–88 BPM; if scaling would leave that band, the planner swaps a form for a longer/shorter one rather than stretch tempo);
- after hours: prefers `nocturne` and `beat-tape`, energy capped at .66 as today.

Event timing (train on track 8, etc.) keys off the slot's start and bpm as today; the train's `96*60/bpm` offset (bar 24) must fall inside the song for every form; the planner never assigns `nocturne` (48 bars, where bar 24 is the midpoint) to the train's track so the visit stays early in a fuller arrangement.

## Testing

Existing tests stay, adjusted where they assumed one form:

- `bars` is one of 48/56/64/72 and `harmony.length === bars`; `sections` tile `[0, bars)` without gaps.
- The recurring-theme test becomes: first `head` melody equals `return` melody, in every form.
- Quieter break test: no kick in any `breath` section.
- Session: durations sum to 3,600 s; slot duration equals `bars*4*60/bpm`.

New tests:

1. **Distinctness.** For each of 8 fixture sessions (two per mood), compute per track:
   - melody n-grams: 4-grams of (pitch interval, onset gap quantised to ½ beat);
   - harmony n-grams: 4-grams of (root motion mod 12, quality).

   Jaccard similarity pairwise. First, record today's composer as the **baseline** (committed as a number in the test with a comment). Requirements: median non-theme pairwise melody similarity ≤ 50% of baseline; no adjacent pair above a fixed ceiling (set at calibration, expected ≈ 0.3); tracks 15–17 vs track 0 melody similarity ≥ a floor, proving the hour theme returns.
2. **Melodic hygiene.** Every non-chord tone is on a weak subdivision and followed by a step (≤ 2 semitones) to a chord tone; melody within a 10th per section; phrase-final notes are chord tones ≥ 1 beat.
3. **Harmony rules.** Chord density ≤ 2 per bar; `dom7alt`/`tritone` frequency; `nocturne` vocabulary; final bar resolves.
4. **Planner rules.** Adjacent form/family/comp differ; ≤ 2 walking-bass tracks; `nocturne` in chapter 4; tempo band.
5. **Bounds.** Events per track < 2,600 in every form; events per bar do not exceed today's maximum by more than 15% (keeps it from getting busier).

Scripts:

- `verify-music.mjs`, `verify-mix.mjs`, `verify-sessions.mjs` pass unchanged or with fixture updates only (mix must still hold atmosphere ≥ 18 dB under music, including `nocturne` quiet passages).
- `render-music-preview.mjs` renders before/after previews for the same seed, plus a **10-minute medley** (first 35 s of each of the eighteen tracks of one session, and one full `standard` and one full `nocturne`) for the listening gate.

**Listening gate.** Implementation is not done until the user has listened to the medley and at least 20 continuous minutes in the app and agrees it is better. Numbers establish variety; they do not establish taste.

## Delivery

Two commits, each shippable:

1. **Harmony and melody** — module split with `perform()` moved verbatim, harmony grammar, curated cells, theme and transformations, hour-theme cousins, distinctness/hygiene tests. Form stays `beat-tape` only.
2. **Form and groove** — the other three forms, comp patterns, bass approaches and walking, drum treatments, planner rules and duration math.

A regression anywhere (groove tests, mix, lifecycle) blocks the commit it appears in.

## Risks

- **Busier is not better.** Mitigated by the events-per-bar ceiling, `pad`/`halves` comping, and rare seasoning quotas. The listening gate is the final check.
- **Generated melodies wander.** Mitigated by hand-authored rhythm cells, chord tones on strong beats, stepwise resolution, verbatim returns.
- **Theme identity lost across the hour.** Cousins share rhythm or contour; floor test on tracks 15–17.
- **Metric gaming.** Distinctness could rise from noise. Hygiene and repetition tests pull the other way; listening decides.
- **Hour arithmetic.** Variable bar counts change the tempo-scaling solve; tested for exact 3,600 s and BPM band across many seeds.
