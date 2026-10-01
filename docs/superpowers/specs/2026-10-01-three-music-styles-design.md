# Three music styles in every place

The user approved this design on 1 October 2026, for rebasing `feat/places-and-synthwave` onto Kyle's `main`.

## Problem

On 1 October, `main` gained Kyle's dreamy synthwave (`167afa9`, `20fe73e`) and an iOS playback fix (`abf0a44`). Sound & motion now has a remembered Music style select (Warm lofi or Dreamy synthwave) for every place, and a separate Drums select (On or Off). This branch adds Top deck, pluggable places and music styles, and its own driving synthwave. The two changes rewrite the same core: the session plan, the audio engine, the shared sound graph and the style type. A straight merge conflicts in seven files.

## Intent

Keep both pieces of work. Every place offers three styles. Warm lofi and Dreamy synthwave behave exactly as they do on `main`, and Top deck behaves as approved on this branch. Kyle reviews the result before it merges.

User decisions, 1 October:
- Keep both synthwaves, and offer all three styles in every place.
- Top deck defaults to driving synthwave.
- The choice is remembered once and applies everywhere. Top deck opens on its own music only until the listener first picks a style.
- Squash this branch's code commits, then rebase.

## Styles

| Id | Select label | Source | Home |
| --- | --- | --- | --- |
| `lofi` | Warm lofi | `src/music/styles/lofi/` | rain, meadow, snow, coast |
| `dreamy` | Dreamy synthwave | Kyle's `src/music/synthwave/`, moved unchanged to `src/music/styles/dreamy/` | none |
| `driving` | Driving synthwave | this branch's `src/music/styles/synthwave/`, renamed to `src/music/styles/driving/` | deck |

Each place keeps declaring its own style in `music.style`. Each style implements the existing `MusicStyle` interface and is registered in `STYLES`. Kyle's union type `MusicStyle = 'lofi' | 'synthwave'` becomes `StyleId = keyof typeof STYLES`, so it no longer collides with the interface name. Instrument names may overlap (both synthwaves use `pad`, `arp` and `lead`) because each style's bank schedules only its own tracks.

Each style names its instrument through `labels.voice`. Lofi names the piano voice, dreamy names its family (Kyle's four labels: arpeggios, pulsing bass, drifting pads, night-drive melodies), and driving names its synth voice. `labels.drums` is removed, because Kyle's Drums select reads On or Off for every style.

## Choosing a style

Sound & motion keeps Kyle's layout and copy. **Music style** offers Warm lofi, Dreamy synthwave and Driving synthwave in that order, and **Drums** offers On and Off. Both stay labelled on phones, keyboard reachable and scrollable on short screens. The select always shows the style that is playing.

One function decides what plays: the saved pick if there is one, otherwise the place's own `music.style`. The audio, the select and the tests all read it, so the panel and the music cannot disagree.

Panel brief (impeccable shape, Operate mode, inside the established world):
- No new component, copy or layout. The three options go in Kyle's existing native select, so focus, labels, phone behaviour and the cream field styling carry over unchanged. The longest label ("Driving synthwave") is no longer than Kyle's "Dreamy synthwave", so no phone overflow is introduced.
- The two synthwaves sit next to each other so they read as a pair. Their head words differ in mood (dreamy against driving), which is the real difference a listener chooses between. Both begin with "Dr", a small scanning cost accepted to keep Kyle's label and the established "mood word plus genre" pattern.
- DESIGN.md's Sound & motion entry drops "the rhythm labels belong to the place's music style" and describes the Music style and Drums selects instead.
- After the UI change, run `impeccable detect --json index.html` once.

Memory:
- A pick from the select is saved in preferences as `styleChoice` and applies everywhere, in every place and every daily edition.
- With nothing saved, each place plays its own style, so a first visit to Top deck plays driving synthwave.
- Only a pick from the select counts. Kyle's code writes `style: 'lofi'` whenever any preference is saved, so a stored `lofi` from `main` cannot be told apart from the default. On load, a saved `synthwave` from `main` becomes `dreamy`, and a saved `lofi` from `main` is ignored.
- The style never goes in the URL. Daily and scene links behave as before.

Switching:
- **Changing style** follows Kyle's rule. The music fades out over 0.6 s, the new style starts a new musical hour with a 0.6 s fade in, and the scenery and its clock are untouched. Paused playback stays paused, choosing the playing style does nothing, and the latest request wins.
- **Changing place** follows this branch's rule. The new place's environment starts at once, and the old song finishes before the new place's hour begins. That hour plays the saved style, or the new place's own style if nothing is saved.
- A place change during a pending style switch uses the latest requested style, never the one being replaced.
- If a place change needs a bank that fails to load (a lofi place with the piano unreachable), the music already playing carries on in the new place, the select shows it, and Kyle's message invites choosing the style again to retry.
- While a switch is pending, the track details read Kyle's "Tuning into your music…".

## Planning

`createSession(seed, place, style)` keeps the environment and the music apart:
- **Environment.** Events, weather, chapters and captions always come from the place's own style plan, drawn from the same random stream as today. A style switch cannot move a train, a boat or Top deck's headlights, and every existing environment is byte-identical.
- **Music.** The slots come from the selected style. When that is the place's own style, it is the same plan, so nothing changes. A different style plans from its own random stream and never draws from the environment's, so the scenery cannot depend on the music (CLAUDE.md: never consume scenery randomness from the audio clock).
- **Dreamy.** It keeps Kyle's own seeding (`planSynthwave(seed)`) and his after-hours rule, so its hour is identical to `main` in every place. `planHour` gains the session seed for this. Kyle's title table gains a Top deck row that reuses four of Top deck's existing titles, so dreamy can play there.

One plan carries both: `slots` are the selected style's music and `events` are the place's scenery. Light, weather and events follow the place. The chapter in the track details follows the music being played, because it is read from the music's position, so rain playing driving synthwave shows Sunset, The drive and so on.

## Sound and loading

Each style owns its bank:
- Dreamy's bank takes over Kyle's stereo chorus, hall, gated snare room, synth drum buffers and voices, which move out of the shared `createGraph` and `scheduleNote`.
- The shared `sound.ts` keeps Kyle's lifecycle fix. `Voice` records its auxiliary oscillators, and `stopVoices` and `disposeGraph` stop them. Every auxiliary is started when its voice is scheduled, because `stop()` before `start()` throws `InvalidStateError`, and a later `stop()` replaces an earlier one (Web Audio spec, verified via context7).
- Shared effect sources belong to their bank and stop on disposal.

Banks load on demand, which generalises Kyle's on-demand piano:
- Listen prepares only the playing style's bank. A switch prepares the new style's bank before the fade.
- A failed piano load blocks only Warm lofi. The error stays visible and retryable, never overrides a newer choice and never resumes paused playback.
- Switching to a synthwave aborts an obsolete piano fetch, as on `main`.

Kyle's iOS audio-session request stays exactly as written. Each style keeps its own mix calibration, and each place keeps its ambience trim.

## Documentation

- CLAUDE.md and AGENTS.md combine both sides' rules for three styles and stay byte-identical.
- README.md, PRODUCT.md and DESIGN.md merge Kyle's dreamy synthwave text with this branch's Top deck text.
- Kyle's dated spec and plan are kept as they are.
- No playlist, taste reference or artist name appears anywhere.

## Verification

Proof of no change:
- **Lofi and dreamy.** For rain, meadow, snow and coast, the score projection of songs 0 to 21 at three seeds matches `origin/main` byte for byte. The projection is the title, bpm, key, bars, events, harmony and sections; style ids are excluded because they are renamed. One 60 s PCM render per style matches within render noise (at most 4 LSB for lofi, as before).
- **Driving.** Top deck's plan and tracks match `138af07`.
- **Environments.** Whichever style is selected, each lofi place's events and `sessionAt` samples match `origin/main`, and Top deck's match `138af07`.
- **Captures.** The eight lofi reduced-motion scene captures are byte-identical to `captures-baseline/scenes/`.

Tests and checks, extending what exists rather than adding new harnesses:
- Kyle's `tests/synthwave.test.ts` becomes `tests/dreamy.test.ts`, with updated imports and ids. Kyle's `verify-synthwave.mjs`, `verify-synthwave-sound.mjs` and `verify-ios-audio.mjs` keep their names, and their select values change to `dreamy`.
- The style contract test covers all three styles. It also asserts, for every place, that the events and `sessionAt` samples are identical whichever style is selected, so the environment invariant stays tested after this change.
- `verify-mix` takes a style argument, as on `main`. It checks lofi in its four places and at Top deck, driving at Top deck and rain, and Kyle's dreamy sweep with Top deck added, all in both drum modes (CLAUDE.md: verify every timbre, including sparse passages).
- No new browser script. Kyle's existing preferences check in `verify-synthwave` is extended to cover:
  - the select offering three options;
  - Top deck playing Driving synthwave with nothing saved, even with a saved `style: 'lofi'` from `main`;
  - a pick applying in another place and surviving a reload;
  - a saved `synthwave` from `main` loading as Dreamy.
- The deck piano check now says that a piano failure does not block Top deck, and that switching to Warm lofi there shows a retryable error.
- The full suite runs: `npm test`, `npm run build`, `tsc`, verify-music, verify-mix (all three styles), verify-scenes, verify-sessions, Kyle's three scripts, desktop and phone captures, and a rendered PCM preview per style.

Budget: the integration commit adds under 150 lines of source, excluding moved files, and no new test files or scripts.

## Delivery

1. Create `backup/pre-rebase` at the current branch tip.
2. Squash the seven code commits, `b212911` to `138af07`, into one: "feat: add Top deck, pluggable places and a driving synthwave". Keep the docs commits and `50f3631` (Playwright 1.61.0, which `main` still lacks) as separate commits.
3. Rebase onto `origin/main`. Resolve the squashed commit by moving dreamy into the style system as described above, proved unchanged against `origin/main`. In this commit, our style keeps its `synthwave` id, the select keeps Kyle's two options for the four lofi places, and Top deck always plays its own style. The commit builds and passes the full suite.
4. Add the integration commit, "feat: offer all three music styles in every place": the three-option select, the memory rule, Top deck's default, the `driving` rename and the docs.
5. Run the full verification at the final tip. Do not push. Delete `backup/pre-rebase` once the user is happy.

## Out of scope

- Unifying the two synthwave composers, or retuning either one.
- Any change to lofi composition, the paintings or the daily rotation (`DAILY_PLACES` stays rain, meadow, snow and coast).
- Per-place style memory.

## Risks

- **Dreamy at Top deck, driving in the lofi places.** Each style was calibrated at its home place. The verify-mix pairs above catch level problems, but taste is the user's call.
- **Kyle's switching code against our segment scheduler.** Kyle's `setStyle` replaces the active segment directly, while this branch schedules segments per style horizon. The port must keep both the 0.6 s fades and the lookahead per style, and verify-music and `verify-synthwave` must both pass.
- **Squashing loses per-commit review granularity.** The ledger in `.superpowers/sdd/handoff-2026-09-30/` keeps the review record, and the PR summarises it for Kyle.
