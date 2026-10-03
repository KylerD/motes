# Each Place’s Own Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first Music style option, “Each place’s own”, that forgets the saved pick so every place plays its own music again.

**Architecture:** The pick already flows through one function, `playingStyle(place, chosen)`, which returns the place’s own style when nothing is chosen. So `RadioAudio.setStyle` only needs to accept no style, and the page maps the new option to no pick, stops saving `styleChoice`, and shows the setting in the select instead of the playing style. The one exception: with nothing picked, a place whose own music failed to load shows the style that stayed on, and the failure message points at Each place’s own to retry.

**Tech Stack:** TypeScript, Web Audio, Vite 6, Vitest 4, Playwright 1.61 (Chromium). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-03-each-places-own-design.md`. Read it first, with `CLAUDE.md`, `README.md`, `PRODUCT.md` and `DESIGN.md`.

## Global Constraints

- Never push, and never merge to `main`. Kyle reviews first.
- No em dashes (U+2014) in any added text: docs, comments or commit messages. Use a full stop or rewrite the sentence.
- UI copy uses the curly apostrophe: `Each place’s own` (U+2019), as in `couldn’t` and `today’s`.
- The option value is `own`. It is not a style id and never reaches `setStyle` or storage.
- `CLAUDE.md` and `AGENTS.md` stay byte-identical (`cmp CLAUDE.md AGENTS.md`).
- Keep it lean: about 10 lines of source and about 15 lines of checks. No new test files or scripts.
- Scores, audio and scenery do not change. The six PCM renders stay within 4 LSB (lofi) and 16 LSB (dreamy, driving) of `captures-baseline/`, and the eight lofi scene captures stay byte-identical to `captures-baseline/scenes/`.
- Playwright’s `selectOption` always dispatches `change`, even when the option is already selected (Playwright 1.61, verified via context7). Never use it to model a person choosing the selected option again.
- End every commit message with the attribution trailer your session specifies.
- Dev servers bind to `127.0.0.1` only. Stop every server you start.

## Review Focus

1. **Each place’s own fails while a pick plays.** Dreamy picked, at rain, piano unreachable: the request rejects, Dreamy keeps playing and the pick stays. Test: Task 1, Step 1 (`verify-synthwave` audio section).
2. **Each place’s own while paused.** It replans quietly: playback stays paused and the environment clock holds. Test: Task 1, Step 1 (`verify-synthwave` paused block).
3. **A pick saved by `main`.** Any save drops `main`’s `style` key, so its `synthwave` migration cannot bring a pick back after Each place’s own. Test: Task 1, Step 2 (`verify-synthwave` preferences section).

Each place’s own during a pending pick needs no new test: it takes the same revision guard as every pick, which the existing late-switch check covers.

## File map

| Path | Change |
| --- | --- |
| `index.html` | The new first option in `#music-style`. |
| `src/music/audio.ts` | `setStyle(style?: StyleId)`. Type and doc comment only. |
| `src/main.ts` | Import `playingStyle`; the failure message; the select line in `updatePlayer`; the change handler. |
| `scripts/verify-synthwave.mjs` | Audio-section pins and the preferences section. |
| `scripts/verify-scenes.mjs` | The deck piano check. |
| `README.md`, `DESIGN.md`, `PRODUCT.md`, `CLAUDE.md`, `AGENTS.md` | One sentence each. |

---

### Task 1: Each place’s own

**Files:**
- Modify: `index.html:49`
- Modify: `src/music/audio.ts:162-163`
- Modify: `src/main.ts:3`, `src/main.ts:51-52`, `src/main.ts:146`, `src/main.ts:166-168`
- Modify: `scripts/verify-synthwave.mjs` (audio section near lines 22-31 and 45-48, preferences section lines 143-185)
- Modify: `scripts/verify-scenes.mjs:123-139`
- Modify: `README.md:18`, `DESIGN.md:180`, `PRODUCT.md:13`, `CLAUDE.md:7`, `AGENTS.md:7`

**Interfaces:**
- Consumes: `playingStyle(place: Place, chosen?: StyleId): StyleId` from `src/music/styles/index.ts` (unchanged); `SCENES: Record<SceneId, Place>` already imported in `src/main.ts`.
- Produces: `RadioAudio.setStyle(style?: StyleId): Promise<void>`, where `undefined` means no pick. The `#music-style` option values become `own`, `lofi`, `dreamy`, `driving`.

- [ ] **Step 1: Pin the player’s behaviour in `scripts/verify-synthwave.mjs`’s audio section**

These pins pass before the change too: at runtime `setStyle` already treats a missing style as no pick. They hold the behaviour the UI relies on. The failing checks come in Steps 2 and 3.

After the existing failed-lofi assertion (`'A failed switch leaves the playing style intact.'`) and before `failedPiano = false;`, insert:

```js
  // Each place’s own fails the same way: the pick that is playing stays.
  assert.match(await page.evaluate(() => window.radio.setStyle(undefined).then(() => '', e => e.message)), /piano could not load/);
  assert.equal(await page.evaluate(() => window.radio.current.style), 'dreamy', 'A failed Each place’s own keeps the pick playing.');
  assert.equal(await page.evaluate(() => window.radio.chosen), 'dreamy', 'A failed Each place’s own keeps the pick.');
```

After `assert.ok(await page.evaluate(t => window.radio.environment.elapsed >= t, before));` and before the `results.push('synth starts …')` line, insert:

```js
  // Each place’s own clears a pick while playing: rain plays its own Warm lofi again.
  await page.evaluate(async () => { await window.radio.setStyle('dreamy'); await window.radio.setStyle(undefined); });
  assert.equal(await page.evaluate(() => window.radio.current.style), 'lofi', 'No pick plays the place’s own style.');
```

In the paused block, replace:

```js
  await page.evaluate(() => window.radio.setStyle('lofi'));
  await page.evaluate(() => window.radio.setStyle('dreamy'));
  assert.equal(await page.evaluate(() => window.radio.playing), false);
```

with:

```js
  await page.evaluate(() => window.radio.setStyle('lofi'));
  await page.evaluate(() => window.radio.setStyle('dreamy'));
  await page.evaluate(() => window.radio.setStyle(undefined));
  assert.equal(await page.evaluate(() => window.radio.playing), false);
```

A few lines further on, the edition check still needs a real switch after the place change. With no pick left, `setStyle('lofi')` at snow would do nothing, so replace:

```js
  await page.evaluate(() => { window.radio.setEdition(84, 'snow'); });
  await page.evaluate(() => window.radio.setStyle('lofi'));
```

with:

```js
  await page.evaluate(() => { window.radio.setEdition(84, 'snow'); });
  await page.evaluate(() => window.radio.setStyle('dreamy'));
```

- [ ] **Step 2: Update `scripts/verify-synthwave.mjs`’s preferences section**

Right after `await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).styleChoice === 'lofi');` add:

```js
  assert.equal(await page.evaluate(() => 'style' in JSON.parse(localStorage.getItem('motes-listening'))), false, 'A save drops main’s style key, so its migration cannot bring a pick back.');
```

Change the four “nothing saved” expectations and the option list:

```js
  // after { mode: 'ambient', style: 'invalid' } and reload
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  // after { mode: 'ambient' } and reload
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  assert.deepEqual(await page.locator('#music-style option').evaluateAll(o => o.map(x => x.value)), ['own', 'lofi', 'dreamy', 'driving']);
  // after { volume: .5, style: 'lofi' } at ?scene=deck
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  // after { styleChoice: 'bogus' } at ?scene=deck
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
```

Each of these replaces the matching existing line (the first two were `'lofi'`, the option list lacked `'own'`, the last two were `'driving'`). Leave the `style: 'synthwave'` case as `'dreamy'`.

After the existing `?scene=rain` check (`assert.equal(await page.locator('#music-style').inputValue(), 'dreamy');`) and before the `styleChoice: 'bogus'` line, insert:

```js
  // Each place’s own forgets the pick, so Top deck plays its own music again.
  await page.click('#mix-toggle'); await page.selectOption('#music-style', 'own');
  await page.waitForFunction(() => !('styleChoice' in JSON.parse(localStorage.getItem('motes-listening'))));
  await page.goto(server.resolvedUrls.local[0] + '?debug&scene=deck');
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  assert.equal(await page.evaluate(() => window.__motes.track.style), 'driving');
```

Change the final `results.push(...)` text to `'remembered style, Each place’s own, old/invalid preferences, independent drums and phone controls'`.

- [ ] **Step 3: Update the deck piano check in `scripts/verify-scenes.mjs`**

Replace lines 123-139 (from the `// Warm lofi at Top deck fails visibly` comment through `report.pianoRetryAfterMove=true;`) with:

```js
  // Warm lofi at Top deck fails visibly: the select returns to Each place’s own, whose synths keep playing.
  await piano.click('#mix-toggle');await piano.selectOption('#music-style','lofi');
  await piano.waitForFunction(()=>!document.querySelector('#status').hidden);
  assert.equal(await piano.locator('#music-style').inputValue(),'own');
  assert.equal(await piano.evaluate(()=>window.__motes.track.style),'driving');
  assert.match(await piano.locator('#status').textContent(),/couldn’t load\. Your current style is still here/);
  await piano.keyboard.press('Escape');report.lofiPickFailsAtTheDeck=true;
  // A lofi place keeps the synths playing, names both styles and shows them in the select. The visit plans lofi, so wait for the music, select and message to come back.
  await piano.click('#scenes-toggle');await piano.click('[data-place="rain"]');
  await piano.waitForFunction(()=>window.__motes.track.style==='driving'&&document.querySelector('#music-style').value==='driving'&&/stays on/.test(document.querySelector('#status').textContent));
  assert.equal(await piano.evaluate(()=>window.__motes.radio.playing),true);
  assert.equal(await piano.locator('#status').isVisible(),true);
  assert.equal(await piano.locator('#status').textContent(),'Warm lofi couldn’t load here, so Driving synthwave stays on. Choose Each place’s own in Sound & motion to try again.');
  await piano.unroute('**/audio/piano/*.mp3');report.pianoFailureKeepsSynths=true;
  // Each place’s own retries the piano without saving a pick, and the music playing retires the message.
  await piano.click('#mix-toggle');await piano.selectOption('#music-style','own');
  await piano.waitForFunction(()=>window.__motes.track.style==='lofi'&&document.querySelector('#status').hidden&&document.querySelector('#music-style').value==='own');
  assert.equal(await piano.evaluate(()=>'styleChoice' in JSON.parse(localStorage.getItem('motes-listening'))),false);report.pianoRetryAfterMove=true;
```

Keep the lines before (`const piano=…` through the `Analog synths` label assertion) and after (`const calendar=…`) unchanged.

- [ ] **Step 4: Run the two checks and watch them fail**

```bash
node scripts/verify-synthwave.mjs
npx vite --host 127.0.0.1 --port 5175 --strictPort   # in the background; wait until curl -sf http://127.0.0.1:5175/ answers
MOTES_URL=http://127.0.0.1:5175 node scripts/verify-scenes.mjs
```

Expected: `verify-synthwave` fails in the preferences section with `'lofi' !== 'own'` (the first “nothing saved” case). `verify-scenes` fails with `'driving' !== 'own'` after the failed Warm lofi pick at Top deck. Keep the dev server running for Step 7.

- [ ] **Step 5: Implement**

`index.html` line 49, make the new option first:

```html
      <div class="mix-options"><label for="music-style">Music style</label><select id="music-style"><option value="own">Each place’s own</option><option value="lofi">Warm lofi</option><option value="dreamy">Dreamy synthwave</option><option value="driving">Driving synthwave</option></select></div>
```

`src/music/audio.ts` lines 162-163:

```ts
  /** A listener's pick, or none for each place's own: switch music without resetting the scenery or starting playback. The latest pick wins. */
  async setStyle(style?:StyleId):Promise<void> {
```

The body stays as it is. `this.chosen=style` with `undefined` clears the pick, and `styleFor` then returns the place’s own style.

`src/main.ts` line 3:

```ts
import {isStyleId,playingStyle,type StyleId} from './music/styles';
```

`src/main.ts` lines 51-52:

```ts
/** A place whose music fails keeps the style it had, playing or paused, so name both. Only Warm lofi can fail, so this
 * arises with nothing picked, and choosing Each place’s own retries without saving a pick. */
const placeError=(failed:string,kept:string)=>failed===kept?styleError:`${styleName(failed)} couldn’t load here, so ${styleName(kept)} stays on. Choose ${styleName('own')} in Sound & motion to try again.`;
```

`src/main.ts` line 146, replacing the one select line in `updatePlayer`:

```ts
  // The select shows the setting. With nothing picked, a place whose own music failed shows what stayed on, so Each place’s own retries.
  const styleSelect=$<HTMLSelectElement>('music-style'),shownStyle=preferences.styleChoice??(track.style===playingStyle(SCENES[current.scene])?'own':track.style);
  if(!switchingStyle&&styleSelect.value!==shownStyle)styleSelect.value=shownStyle;
```

`src/main.ts` lines 166-168, the start of the change handler:

```ts
$<HTMLSelectElement>('music-style').addEventListener('change',async e=>{
  // Each place’s own is no pick, so every place plays its own music again.
  const value=(e.target as HTMLSelectElement).value,style=isStyleId(value)?value:undefined,request=++styleRequest;switchingStyle=true;updatePlayer();
```

The rest of the handler stays as it is. `preferences.styleChoice=style;savePreferences();` now stores no pick for Each place’s own, because `JSON.stringify` omits an `undefined` field.

- [ ] **Step 6: Type-check, unit tests and build**

```bash
npx tsc --noEmit -p .
npm test
npm run build
```

Expected: tsc prints nothing; Vitest reports 90 passed; the build succeeds. `tests/session.test.ts` needs no change: its contract test already asserts `playingStyle(placeById('deck'))` is `'driving'` and `playingStyle(placeById('rain'))` is `'lofi'`.

- [ ] **Step 7: Run the two checks and watch them pass**

```bash
node scripts/verify-synthwave.mjs
MOTES_URL=http://127.0.0.1:5175 node scripts/verify-scenes.mjs
```

Expected: both exit 0. `verify-scenes` prints a report with `lofiPickFailsAtTheDeck`, `pianoFailureKeepsSynths` and `pianoRetryAfterMove` true and `"errors":[]`. Known flake under load: `verify-synthwave`’s “Execution context was destroyed”. Re-run once if it appears.

- [ ] **Step 8: Update the docs**

`README.md` line 18. Replace `A pick is remembered and applies everywhere; with none, each place plays its own music, so Top deck opens on Driving synthwave.` with:

```
A pick is remembered and applies everywhere. **Each place’s own**, the first option, forgets it, so each place plays its own music again and Top deck opens on Driving synthwave.
```

In the same line, replace `If a switch to lofi cannot load its piano, the current music continues and selecting lofi again retries.` with:

```
If a switch to lofi cannot load its piano, the current music continues and selecting lofi again retries. If a place’s own Warm lofi cannot load, the music already playing stays on, the select names it, and choosing Each place’s own retries.
```

`DESIGN.md` line 180. Replace `**Music style** (Warm lofi / Dreamy synthwave / Driving synthwave)` with `**Music style** (Each place’s own / Warm lofi / Dreamy synthwave / Driving synthwave)`, and replace `A pick is remembered and applies in every place; with none, each place plays its own music, so Top deck opens on Driving synthwave.` with:

```
A pick is remembered and applies in every place. Each place’s own, the default, forgets it, so each place plays its own music and Top deck opens on Driving synthwave. The select shows the setting rather than the song, except when a place’s own music cannot load: then it names the style that stayed on.
```

`PRODUCT.md`, after line 13 (the 1 October paragraph), add a blank line and:

```
On 3 October they asked for a way back from a pick: **Each place’s own**, the first Music style option, so every place plays its own music again.
```

`CLAUDE.md` line 7. Replace `a pick from Music style is remembered once and applies everywhere, and with no pick each place plays its own` with `a pick from Music style is remembered once and applies everywhere until Each place’s own clears it, and with no pick each place plays its own`. Then `cp CLAUDE.md AGENTS.md`.

Check:

```bash
cmp CLAUDE.md AGENTS.md && echo identical
git diff | grep '^+' | grep -c "$(printf '\342\200\224')"   # prints 0
```

- [ ] **Step 9: Full verification, in two parallel streams**

Offline stream:

```bash
npm test && npx tsc --noEmit -p . && npm run build
mkdir -p captures-after
node scripts/render-music-preview.mjs 60 captures-after/dreamy-rain.wav 20260917 rain 3 dreamy
node scripts/render-music-preview.mjs 60 captures-after/driving-deck.wav 20260917 deck 3
for p in rain meadow snow coast; do node scripts/render-music-preview.mjs 60 captures-after/$p.wav 20260917 $p 3; done
node -e "const fs=require('fs');for(const n of ['dreamy-rain','driving-deck','rain','meadow','snow','coast']){const a=fs.readFileSync('captures-baseline/'+n+'.wav'),b=fs.readFileSync('captures-after/'+n+'.wav');let m=0;for(let i=44;i<Math.min(a.length,b.length);i+=2)m=Math.max(m,Math.abs(a.readInt16LE(i)-b.readInt16LE(i)));console.log(n,a.length===b.length,m);}"
node scripts/verify-mix.mjs && node scripts/verify-mix.mjs dreamy
```

Expected: every size check prints `true`; the maximum difference is at most 4 for rain, meadow, snow and coast and at most 16 for dreamy-rain and driving-deck; both `verify-mix` runs exit 0. `verify-mix dreamy` takes several minutes.

Browser stream (the dev server from Step 4 is still on 5175):

```bash
node scripts/verify-music.mjs && node scripts/verify-synthwave.mjs && node scripts/verify-synthwave-sound.mjs && node scripts/verify-ios-audio.mjs
MOTES_URL=http://127.0.0.1:5175 node scripts/verify-scenes.mjs && MOTES_URL=http://127.0.0.1:5175 node scripts/verify-sessions.mjs
for s in rain meadow snow coast; do for v in desktop mobile; do cmp -s captures-scenes/$s-$v.png captures-baseline/scenes/$s-$v.png && echo "same $s-$v" || echo "DIFF $s-$v"; done; done
```

Expected: every script exits 0 and all eight lines print `same`. Known flakes under load: `verify-music`’s `progress>0` after 1.2 s and `verify-synthwave`’s “Execution context was destroyed”. Re-run once if one appears. Stop the dev server afterwards.

- [ ] **Step 10: Look at the panel and run the design detector**

Read `captures-scenes/mix-desktop.png`, `captures-scenes/mix-mobile.png`, `captures-scenes/mix-320.png`, `captures-synthwave/desktop-controls.png` and `captures-synthwave/phone-controls.png`. Confirm the Music style select is fully visible, keeps its width and its label, and nothing in the panel overflows.

```bash
/Users/shannonholgate/.claude/skills/impeccable/scripts/impeccable detect --json index.html
```

Expected: exit 0 with only the existing `design-system-color` advisory for the canvas fallback text. Anything new about the Music style select must be fixed before committing.

- [ ] **Step 11: Commit**

```bash
git add index.html src/music/audio.ts src/main.ts scripts/verify-synthwave.mjs scripts/verify-scenes.mjs README.md DESIGN.md PRODUCT.md CLAUDE.md AGENTS.md
git status --short   # only these files; no captures
git commit -F - <<'EOF'
feat: add Each place’s own to Music style

A first Music style option forgets the saved pick, so every place plays
its own music again and Top deck returns to Driving synthwave. The
select now shows the listener's setting. With nothing picked, a place
whose own music cannot load shows the style that stayed on, and its
message points at Each place's own, which retries without saving a
pick.

<attribution trailer>
EOF
```

Replace `<attribution trailer>` with the trailer your session specifies.
