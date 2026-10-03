# Each place’s own

The user approved this option on 3 October 2026, on `feat/places-and-synthwave`, after the design audit of the three music styles. Open questions were settled from what Motes already does, as the user asked. Each one is recorded below so it can be challenged at review.

## Problem

Music style offers Warm lofi, Dreamy synthwave and Driving synthwave in every place. With no saved pick, each place plays its own music: Top deck plays Driving synthwave and the four lofi places play Warm lofi. Once a listener picks any style, it is saved as `styleChoice` and applies everywhere, and there is no way back to each place playing its own.

## Intent

Music style gains a first option, **Each place’s own**. Choosing it forgets the saved pick, so every place plays its own music again. Two options also get shorter names: Dreamy synthwave becomes **Dreamy** and Driving synthwave becomes **Drive**. Nothing else about styles, places or the scenery changes.

## Choosing it

- The option sits first in the existing native select, before Warm lofi. Its value is `own`, which is not a style id. The copy follows the audit’s suggestion and echoes Find a place (“Five places, each with its own feeling.”), with the app’s curly apostrophe (“couldn’t”, “today’s”).
- Choosing it clears the pick in the player and in storage: `styleChoice` is removed from `motes-listening`. A legacy `style` key from `main` is already dropped by any save, so the old migration cannot bring a pick back.
- The music then follows the existing switching rule. If the place’s own style differs from what is playing, the music fades over 0.6 s into a new musical hour of the place’s own style, and the scenery and its clock are untouched. If it is already playing (a Warm lofi pick at a lofi place, say), nothing audible happens and only the pick is forgotten. Paused playback stays paused, and the latest request wins.
- From then on, every place change plays the new place’s own style, as it does for a listener who never picked.

## Shorter style names

The user asked for this on 3 October, after checking the panel on a phone. Warm lofi keeps its name, because only the two synthwaves were named. The options now read Each place’s own, Warm lofi, Dreamy and Drive.

- Only the labels change. The ids (`dreamy`, `driving`), saved preferences, track details and every check that selects by value stay as they are.
- The failure messages take their names from the select through `styleName`, so they follow without code changes: “Warm lofi couldn’t load here, so Drive stays on.”
- Docs that name a style use the new names: README, DESIGN.md, CLAUDE.md and AGENTS.md. Lowercase descriptions of the music as synthwave stay, and so do the dated specs and plans.

## What the select shows

This replaces the 2026-10-01 rule that “the select always shows the style that is playing”. The select shows the listener’s setting: the saved pick, or **Each place’s own** when there is none. While a switch is pending it shows the option just chosen, as today.

One exception keeps the select honest. With nothing picked, if a place’s own music cannot load and another style stays on, the select shows the style that stayed on. That is the only case where the setting and the music differ, and it is what the select did before this change (“the select returns to the synths that keep playing”). It also makes Each place’s own a real change there, so choosing it retries.

Why from precedent: the select is a setting, and Drums already shows its setting rather than what a song happens to be doing. Showing the playing style instead would make the select jump away from a choice the listener just made.

Accepted trade-off: with nothing picked, the panel names no style. The listener hears it, the track detail names the instrument once music plays (Upright piano, Arpeggios & warm pads, Analog synths and so on, though not before Listen or while a switch is pending), and Each place’s own is one step back from any pick. Choosing the style a place already plays (Warm lofi at rain) is still a pick that applies everywhere. The select then says so, and Each place’s own undoes it.

## Failures

The bank rules are unchanged. A failed load never overrides a newer choice and never resumes paused playback.

- **Choosing Each place’s own fails** (a lofi place, with a Dreamy or Driving pick, and the piano unreachable). The current music and the saved pick stay, the select returns to the pick, and Kyle’s message appears: “That music couldn’t load. Your current style is still here. Choose the style again to retry.” Choosing Each place’s own again retries. The message reads right as it is.
- **A place change fails** (no pick, Top deck to a lofi place, piano unreachable). Drive carries on and the select shows Drive. The message changes its last sentence to point at the retry that keeps the setting: “Warm lofi couldn’t load here, so Drive stays on. Choose Each place’s own in Sound & motion to try again.” This follows Kyle’s rule of retrying by choosing again what failed, and what failed here is the place’s own music. Choosing it loads Warm lofi without saving a pick, and the message retires once the music plays. Only Warm lofi’s bank can fail, so this two-style message only arises with nothing picked.
- **A Warm lofi pick is still a pick.** This was the open question raised with this option. Choosing Warm lofi from that state also retries, and saves Warm lofi as the pick, so Top deck would then play Warm lofi too. The user’s yes to Each place’s own answers it: such a pick stays a pick, and Each place’s own undoes it. The message no longer steers the listener into it.

## Code

- `index.html`: one `<option value="own">Each place’s own</option>` before Warm lofi, and the two synthwave options relabelled `Dreamy` and `Drive`.
- `src/music/audio.ts`: `setStyle(style?: StyleId)`. An undefined style clears `chosen`, and `playingStyle` already returns the place’s own style when nothing is chosen. The revision guard, bank loading, fallback and fade are reused unchanged.
- `src/main.ts`:
  - The change handler maps any value that is not a style id to no pick. On success it saves `styleChoice` as that pick, so `JSON.stringify` omits it when cleared.
  - `updatePlayer` keeps its one select line, which already runs on every visit, failure and settled switch. It now sets `preferences.styleChoice ?? (track.style === playingStyle(SCENES[current.scene]) ? 'own' : track.style)`.
  - `placeError` ends with “Choose Each place’s own in Sound & motion to try again.”, taking the option’s text from the select as `styleName` already does.

With the shorter names, Each place’s own becomes the widest option (101 px as rendered, against Dreamy synthwave’s 114 px today). The select’s width follows its widest option, so it narrows from 156 px to about 143 px at 1440, 390 and 320 px, and the row keeps its label and alignment. Focus, label, keyboard use and the cream field styling carry over from the native select. VoiceOver reads it as “Music style, Each place’s own, pop-up button”.

## Documentation

- README’s Listen section: the option, what it does, and the retry after a place’s own music fails.
- README, DESIGN.md, CLAUDE.md and AGENTS.md: Dreamy and Drive wherever they name a style.
- DESIGN.md’s Sound & motion entry: the four options and what the select shows.
- PRODUCT.md: a dated line for the 3 October decisions.
- CLAUDE.md and AGENTS.md: the pick sentence gains “until Each place’s own clears it”. The two files stay byte-identical.

## Verification

Extend what exists. No new test files or scripts.

- Playwright’s `selectOption` dispatches `change` even when the option is already selected (verified via context7 against Playwright 1.61’s injected script). A person’s `change` fires only on committing a different option (MDN). So no check uses `selectOption` to model choosing the selected option again.
- `scripts/verify-synthwave.mjs`, audio section: at rain, a Dreamy pick followed by `setStyle(undefined)` plays Warm lofi again.
- `scripts/verify-synthwave.mjs`, preferences section: the options read `own`, `lofi`, `dreamy`, `driving`. Every “nothing saved” case (empty, invalid, `main`’s `style: 'lofi'`, a bogus `styleChoice`) shows `own`. After a Dreamy pick at rain, choosing `own` removes `styleChoice`, and Top deck then shows `own` and plans `driving`.
- `scripts/verify-scenes.mjs`, the deck piano check: a failed Warm lofi pick at Top deck returns the select to `own`. The failed move to rain shows `driving` with the new message, which names Drive. Choosing `own` there retries: Warm lofi plays, the message retires, the select shows `own` and no `styleChoice` is saved.
- `tests/session.test.ts` needs no change. The contract test already asserts that with no pick Top deck plays `driving` and rain plays `lofi`.
- Full suite: `npm test`, `npx tsc --noEmit -p .`, `npm run build`, the six PCM renders against `captures-baseline/` (scores and audio are untouched), `verify-mix`, `verify-mix dreamy`, `verify-music`, `verify-synthwave`, `verify-synthwave-sound`, `verify-ios-audio`, `verify-scenes`, `verify-sessions`, the eight lofi scene captures byte-identical, and `impeccable detect --json index.html`. Check the Sound & motion captures on desktop and phone.

Budget: about 10 lines of source and about 15 lines of checks.

## Out of scope

- Per-place style memory.
- Naming the playing style in the panel, or in the track detail’s tooltip.
- Kyle’s generic failure message, the status card covering an open panel on phones, and the select border contrast (1.42:1). These are already on `main` and listed for the PR.
- Any change to composition, mix, scenery or the daily rotation.
