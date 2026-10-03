# Each place’s own

The user approved this option on 3 October 2026, on `feat/places-and-synthwave`, after the design audit of the three music styles. Open questions were settled from what Motes already does, as the user asked; each one is recorded below so it can be challenged at review.

## Problem

Music style offers Warm lofi, Dreamy synthwave and Driving synthwave in every place. With no saved pick, each place plays its own music: Top deck plays Driving synthwave and the four lofi places play Warm lofi. Once a listener picks any style, it is saved as `styleChoice` and applies everywhere, and there is no way back to each place playing its own.

## Intent

Music style gains a first option, **Each place’s own**. Choosing it forgets the saved pick, so every place plays its own music again. Nothing else about styles, places or the scenery changes.

## Choosing it

- The option sits first in the existing native select, before Warm lofi. Its value is `own`, which is not a style id. The copy follows the audit's suggestion and the app's curly apostrophe (“couldn’t”, “today’s”).
- Choosing it clears the pick in the player and in storage: `styleChoice` is removed from `motes-listening`. A legacy `style` key from `main` is already dropped by any save, so the old migration cannot bring a pick back.
- The music then follows the existing switching rule. If the place’s own style differs from what is playing, the music fades over 0.6 s into a new musical hour of the place’s own style, and the scenery and its clock are untouched. If it is already playing (a Warm lofi pick at a lofi place, say), nothing audible happens and only the pick is forgotten. Paused playback stays paused, and the latest request wins.
- From then on, every place change plays the new place’s own style, as it does for a listener who never picked.

## What the select shows

This replaces the 2026-10-01 rule that “the select always shows the style that is playing”. The select now shows the listener’s setting: the saved pick, or **Each place’s own** when there is none. While a switch is pending it shows the option just chosen, as today.

Why from precedent: the select is a setting, and Drums already shows its setting rather than what a song happens to be doing. The player’s track detail names the instrument that is playing (Upright piano, Arpeggios & warm pads, Analog synths and so on), so the listener can still tell the music apart. Showing the playing style would make the select jump away from a choice the listener just made.

The one case where the setting and the music differ is a failed load, below. The status message names both styles there.

## Failures

The bank rules are unchanged. A failed load never overrides a newer choice and never resumes paused playback.

- **Choosing Each place’s own fails** (a lofi place, with a Dreamy or Driving pick, and the piano unreachable). The current music and the saved pick stay, the select returns to the pick, and Kyle’s message appears: “That music couldn’t load. Your current style is still here. Choose the style again to retry.” Choosing Each place’s own again retries. The message reads right as it is.
- **A place change fails** (no pick, Top deck to a lofi place, piano unreachable). Driving synthwave carries on, the select shows Each place’s own, and the message stays: “Warm lofi couldn’t load here, so Driving synthwave stays on. Choose Warm lofi in Sound & motion to try again.” It still reads right. It names what plays and the way to retry. It cannot point at Each place’s own, because that option is already selected and choosing it again does not fire a change.
- **A retry counts as a pick.** Choosing Warm lofi from that message saves Warm lofi as the pick, so Top deck would then play Warm lofi too. This was the open question raised with this option, and the user’s yes to Each place’s own answers it: the retry stays a pick, and Each place’s own undoes it.

## Code

- `index.html`: one `<option value="own">Each place’s own</option>` before Warm lofi.
- `src/music/audio.ts`: `setStyle(style?: StyleId)`. An undefined style clears `chosen`, and `playingStyle` already returns the place’s own style when nothing is chosen. The revision guard, bank loading, fallback and fade are reused unchanged.
- `src/main.ts`: the change handler maps any value that is not a style id to no pick, and on success saves `styleChoice` as that pick, so `JSON.stringify` omits it when cleared. `updatePlayer` sets the select to `preferences.styleChoice ?? 'own'` instead of the playing style.

The new label is narrower than the widest option, Dreamy synthwave (about 124 px against 140 px in Nunito Sans), so the select keeps its width on desktop and phones. Focus, label, keyboard use and the cream field styling carry over from the native select.

## Documentation

- README’s Listen section: the option and what it does.
- DESIGN.md’s Sound & motion entry: the four options and the select showing the setting.
- PRODUCT.md: a dated line for the 3 October decision.
- CLAUDE.md and AGENTS.md: the pick sentence gains “until Each place’s own clears it”. The two files stay byte-identical.

## Verification

Extend what exists. No new test files or scripts.

- `scripts/verify-synthwave.mjs`, audio section: at rain, a Dreamy pick followed by `setStyle(undefined)` plays Warm lofi again.
- `scripts/verify-synthwave.mjs`, preferences section: the options read `own`, `lofi`, `dreamy`, `driving`; every “nothing saved” case (empty, invalid, `main`’s `style: 'lofi'`, a bogus `styleChoice`) shows `own`; after a Dreamy pick at rain, choosing `own` removes `styleChoice`, and Top deck then shows `own` and plans Driving synthwave.
- `scripts/verify-scenes.mjs`, the deck piano check: a failed Warm lofi pick at Top deck returns the select to `own`; the failed move to rain shows `own` with the message unchanged; after the Warm lofi retry, choosing `own` removes the pick, and Top deck plays Driving synthwave again.
- `tests/session.test.ts` needs no change: the contract test already asserts that with no pick Top deck plays Driving synthwave and rain plays Warm lofi.
- Full suite: `npm test`, `npx tsc --noEmit -p .`, `npm run build`, the six PCM renders against `captures-baseline/` (scores and audio are untouched), `verify-mix`, `verify-mix dreamy`, `verify-music`, `verify-synthwave`, `verify-synthwave-sound`, `verify-ios-audio`, `verify-scenes`, `verify-sessions`, the eight lofi scene captures byte-identical, and `impeccable detect --json index.html`. Check the Sound & motion captures on desktop and phone.

Budget: under 10 lines of source and about 15 lines of checks.

## Out of scope

- Per-place style memory.
- Changing any failure copy, or the status card covering an open panel (already on `main`, listed for the PR).
- Any change to composition, mix, scenery or the daily rotation.
