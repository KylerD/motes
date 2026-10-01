# Three Music Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase `feat/places-and-synthwave` onto Kyle's `main`, keep both synthwaves, and offer Warm lofi, Dreamy synthwave and Driving synthwave in every place, with Top deck opening on Driving synthwave.

**Architecture:** Kyle's dreamy synthwave moves unchanged into this branch's pluggable style system as a third `MusicStyle` with its own bank. A session plan carries the place's scenery events (always timed by the place's own style) and the selected style's music slots. `RadioAudio` gains Kyle's style switching (0.6 s fades, latest request wins) over this branch's per-style lookahead scheduler, with banks loaded on demand.

**Tech Stack:** TypeScript, Web Audio, Vite 6, Vitest 4, Playwright 1.61 (Chromium). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-01-three-music-styles-design.md`. Read it first, together with `CLAUDE.md`, `README.md`, `PRODUCT.md` and `DESIGN.md`.

## Global Constraints

- Never push, and never merge to `main`. Kyle reviews first.
- No em dashes (U+2014) in any added text: docs, comments or commit messages. Use a full stop or rewrite the sentence.
- No playlist, taste reference or artist name in any committed file.
- `CLAUDE.md` and `AGENTS.md` stay byte-identical (`cmp CLAUDE.md AGENTS.md`).
- `DAILY_PLACES` stays exactly `['rain','meadow','snow','coast']`.
- Composers stay pure and deterministic. Never consume scenery randomness from the audio clock.
- Audio scheduling stays independent of `requestAnimationFrame`. Scheduled voices stay bounded. Sample failures stay visible and retryable.
- Lofi must not change: `LOFI_FINGERPRINT` passes, and lofi PCM stays within 4 LSB of `captures-baseline/<place>.wav`.
- Dreamy must match `origin/main` (`DREAMY_FINGERPRINT`, PCM within 16 LSB). Driving must match `138af07` (`DRIVING_FINGERPRINT`, PCM within 16 LSB).
- Keep it lean. Add no new test files or scripts, except the renamed `tests/dreamy.test.ts`. The integration commit adds under 150 lines of source, excluding moved files.
- End every commit message with the attribution trailer your session specifies.
- Dev servers bind to `127.0.0.1` only. Stop every server you start.

## Review Focus

1. **A place change into a style whose bank fails.** Example: Top deck to rain with nothing saved and the piano unreachable. The synths should keep playing in the new place, a retryable message should appear, and the select should show what is playing. Test: the `verify-scenes` piano check (Task 2 adds the playback part, Task 3 the select part).
2. **Rapid switching across all three styles near a song boundary.** Voices stay bounded, one segment remains, and the latest request wins. Test: Kyle's switching loop in `verify-synthwave` cycles all three styles (Task 3).
3. **Preferences saved by `main` or by older builds.** With `{style:'lofi'}` saved, Top deck still opens on Driving synthwave and the volume is kept. `{style:'synthwave'}` loads as Dreamy, and junk falls back to the place's own style. Test: the preferences section of `verify-synthwave` (Task 3).
4. **Every style composing in every place, including after hours.** Dreamy at Top deck (title table), lofi at Top deck and driving at rain all stay within the style's limits. Test: the contract test in `tests/session.test.ts` (Task 3), plus `deck` in Kyle's moods loop (Task 2).
5. **Scenery that never depends on the music.** For every place, the events and the light, weather and events in `sessionAt` are identical whichever style is selected. Test: the contract test (Task 3) and Kyle's paused-switch checks.

## File map

| Path | Responsibility | Task |
| --- | --- | --- |
| `src/music/styles/dreamy/{catalog,composer,effects,sound}.ts` | Kyle's files, moved from `src/music/synthwave/` with import paths fixed. `composer.ts` gains a `deck` title row and `style:'dreamy'`. `sound.ts` takes a routes object instead of `SoundGraph`. | 2 |
| `src/music/styles/dreamy/bank.ts` (new) | Dreamy's `SoundBank`: Kyle's effects, synth drum buffers, bass and drums gains, and voice scheduling | 2 |
| `src/music/styles/dreamy/index.ts` (new) | The dreamy `MusicStyle`: hour, after hours, labels and bank | 2 |
| `src/music/styles/index.ts` | `STYLES` with three styles, `StyleId`, `isStyleId`, `playingStyle`, and `planHour(random,place,seed)` | 2, 3 |
| `src/music/styles/lofi/index.ts` | Export `CHAPTERS`, drop `labels.drums` | 2 |
| `src/music/styles/synthwave/` becomes `src/music/styles/driving/` | Id `driving` | 2 (drop `labels.drums`), 3 (rename) |
| `src/music/composer/types.ts` | Union of both sides' instruments, `brightness`, `family`, and `SynthFamily` | 2 |
| `src/music/sound.ts` | Voice auxiliaries, graph `sources` and `loading`, `prepareBank` | 2 |
| `src/session/session.ts` | `createSession(seed,mood,style?)` and `SessionPlan.style` | 2 |
| `src/music/audio.ts` | `setStyle`, banks on demand, the iOS session, `setEdition` fallback, `renderPreview({style})` | 2, 3 |
| `src/main.ts`, `index.html` | Kyle's Music style and Drums selects, preferences | 2, 3 |
| `tests/dreamy.test.ts` (renamed from Kyle's `tests/synthwave.test.ts`) | Kyle's dreamy tests | 2 |
| `tests/music.test.ts` | `DREAMY_FINGERPRINT` and `DRIVING_FINGERPRINT` | 2 |
| `tests/session.test.ts` | Driving imports and a three-style contract test | 2, 3 |
| `scripts/verify-mix.mjs` | Our checks merged with Kyle's dreamy sweep | 2, 3 |
| `scripts/verify-synthwave.mjs`, `verify-synthwave-sound.mjs`, `verify-ios-audio.mjs` | Kyle's checks on the new ids and API | 2, 3 |
| `scripts/verify-scenes.mjs`, `scripts/verify-music.mjs` | Deck piano check and driving bank id | 2, 3 |
| `CLAUDE.md`, `AGENTS.md`, `README.md`, `PRODUCT.md`, `DESIGN.md` | Merged docs | 2, 3 |

---

### Task 1: Record baselines and squash the branch

No product code changes. This task produces the baselines that Task 2 proves against, and a branch with one squashed code commit.

**Files:**
- Create: `.worktrees/baseline-main/` (a worktree at `origin/main`) and `.worktrees/baseline-head/` (a worktree at the current tip). Both are git-ignored and removed at the end of Task 4.
- Create: `captures-baseline/dreamy-rain.wav`, `captures-baseline/driving-deck.wav` (git-ignored)
- Modify: branch history only

**Interfaces:**
- Produces: `backup/pre-rebase` (the current tip), the squashed commit, `DREAMY_FINGERPRINT` and `DRIVING_FINGERPRINT` values (JSON, pasted into Task 2), and two PCM baselines.

- [ ] **Step 1: Check the starting state**

```bash
git status --short            # expect nothing
git fetch origin
git log --oneline -1 origin/main   # expect abf0a44 fix: request media playback audio on iOS
git log --oneline origin/main..HEAD | wc -l   # expect 18: 6 docs, 1 chore, 7 code (b212911 to 138af07), then 4 docs (aa25042 onwards)
```

If `origin/main` has moved past `abf0a44`, stop and ask the user. This plan resolves against `abf0a44`.

- [ ] **Step 2: Back up the branch**

```bash
git branch backup/pre-rebase HEAD
```

- [ ] **Step 3: Create both baseline worktrees**

```bash
git worktree add --detach .worktrees/baseline-main origin/main
git worktree add --detach .worktrees/baseline-head HEAD
ln -s "$PWD/node_modules" .worktrees/baseline-main/node_modules
ln -s "$PWD/node_modules" .worktrees/baseline-head/node_modules
```

- [ ] **Step 4: Write the fingerprint script into both worktrees**

Save this as `fingerprint.ts` in each worktree root. It is the same projection that Task 2's test uses.

```ts
import {createSession,composeSessionTrack,sessionAt} from './src/session/session';
const fnv=(text:string)=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),0x01000193)>>>0;return h.toString(16);};
// Usage: node fingerprint.mjs <style|-> <mood...>. The cast spans main's overloads and this branch's signature.
const create=createSession as unknown as (seed:number,mood:string,style?:string)=>ReturnType<typeof createSession>;
const [style,...moods]=process.argv.slice(2);
console.log(JSON.stringify(Object.fromEntries(moods.flatMap(mood=>[1,4242,20260917].map(seed=>{
  const plan=create(seed,mood,style==='-'?undefined:style);
  const scores=[0,9,17,18].map(i=>{const t=composeSessionTrack(plan as never,i);return JSON.stringify([t.title,t.bpm,t.bars,t.key,t.events,t.harmony,t.sections]);});
  const states=[0,600,1800,3300,5000].map(s=>{const {elapsed,progress,chapter,dusk,warmth,weather,lamps,events}=sessionAt(plan as never,s);return JSON.stringify({elapsed,progress,chapter,dusk,warmth,weather,lamps,events});});
  const slots=plan.slots.map(s=>[s.start,s.duration,s.chapter].join(',')),events=plan.events.map(e=>[e.kind,e.start,e.duration].join(','));
  return [`${mood}/${seed}`,fnv([...scores,...states,...slots,...events].join('|'))];
})))));
```

- [ ] **Step 5: Record the fingerprints**

```bash
for w in baseline-main baseline-head; do node_modules/.bin/esbuild .worktrees/$w/fingerprint.ts --bundle --platform=node --format=esm --log-level=error --outfile=.worktrees/$w/fingerprint.mjs; done
node .worktrees/baseline-main/fingerprint.mjs synthwave rain meadow snow coast   # DREAMY_FINGERPRINT
node .worktrees/baseline-head/fingerprint.mjs - deck                            # DRIVING_FINGERPRINT
```

Expected: two JSON objects, with 12 and 3 keys. Keep both outputs for Task 2 Step 13.

- [ ] **Step 6: Record the PCM baselines**

```bash
(cd .worktrees/baseline-main && node scripts/render-music-preview.mjs 60 "$OLDPWD/captures-baseline/dreamy-rain.wav" 20260917 rain 3 synthwave)
node scripts/render-music-preview.mjs 60 captures-baseline/driving-deck.wav 20260917 deck 3
ls -l captures-baseline/rain.wav captures-baseline/meadow.wav captures-baseline/snow.wav captures-baseline/coast.wav captures-baseline/scenes/rain-desktop.png
```

Expected: both renders report `clipped: 0`, and the four lofi WAVs and the eight scene PNGs from earlier work already exist. If any are missing, regenerate them from `.worktrees/baseline-head`:
- the WAVs with `node scripts/render-music-preview.mjs 60 <abs path>/captures-baseline/<place>.wav 20260917 <place> 3`;
- the scene PNGs by running `verify-scenes` against a dev server started in that worktree, then copying `captures-scenes/<place>-<desktop|mobile>.png`.

- [ ] **Step 7: Squash the seven code commits**

```bash
CODE_FROM=50f3631; CODE_TO=138af07
git switch --detach $CODE_FROM
git merge --squash $CODE_TO
git commit -F - <<'EOF'
feat: add Top deck, pluggable places and a driving synthwave

Places and music styles become pluggable: each place owns its painting,
scenery and music style, and each style plans its hour, writes its songs,
names its instruments and voices them in its own bank. Top deck, a fifth
place above the city, plays a synthwave night drive through six chapters
with four synth voices.

<trailer>
EOF
git cherry-pick $CODE_TO..backup/pre-rebase     # the addendum, the spec and the plan, in order
git diff backup/pre-rebase HEAD --stat     # expect no output
git branch -f feat/places-and-synthwave HEAD
git switch feat/places-and-synthwave
git log --oneline origin/main..HEAD | wc -l     # expect 12: six fewer than Step 1, since seven code commits became one
```

Replace `<trailer>` with your session's attribution trailer.

- [ ] **Step 8: Confirm the squashed tree still passes**

```bash
npm test && npx tsc --noEmit -p .
```

Expected: 82 tests pass (8 files) and `tsc` is clean. There is nothing new to commit in this step.

---

### Task 2: Rebase onto main and move dreamy into the style system

One rebase stop: the squashed commit conflicts in seven files. Resolve it by porting Kyle's dreamy synthwave into the style system with no behaviour change. At the end of this task, Top deck always plays its own style, and the Music style select offers Kyle's two options and is disabled at Top deck. Task 3 replaces that interim rule.

**Files:**
- Move: `src/music/synthwave/*` to `src/music/styles/dreamy/`, and `tests/synthwave.test.ts` to `tests/dreamy.test.ts`
- Create: `src/music/styles/dreamy/bank.ts`, `src/music/styles/dreamy/index.ts`
- Modify: `src/music/styles/index.ts`, `src/music/styles/lofi/index.ts`, `src/music/styles/synthwave/index.ts`, `src/music/composer/types.ts`, `src/music/sound.ts`, `src/session/session.ts`, `src/music/audio.ts`, `src/main.ts`, `index.html`, `scripts/verify-mix.mjs`, `scripts/verify-synthwave.mjs`, `scripts/verify-synthwave-sound.mjs`, `scripts/verify-ios-audio.mjs`, `scripts/verify-scenes.mjs`, `tests/music.test.ts`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `PRODUCT.md`, `DESIGN.md`

**Interfaces:**
- Consumes: the Task 1 fingerprints and PCM baselines.
- Produces, for Task 3:
  - `type StyleId = keyof typeof STYLES` (`'lofi'|'dreamy'|'synthwave'`; Task 3 renames `synthwave` to `driving`), and `isStyleId(value:unknown):value is StyleId`, both in `src/music/styles/index.ts`.
  - `MusicStyle.planHour(random:()=>number,place:Place,seed:number):Slot[]`.
  - `MusicStyle.labels:{preparing:string;voice(track:Pick<Track,'voice'|'darkness'|'family'>):string}`.
  - `SoundBank.synth?:GainNode`.
  - `prepareBank(graph:SoundGraph,style:MusicStyle,signal?:AbortSignal):Promise<SoundBank>`, plus `SoundGraph.sources` and `SoundGraph.loading`.
  - `createSession(seed:number,mood:Mood,style?:string):SessionPlan` with `SessionPlan.style:StyleId`.
  - `RadioAudio.setStyle(style:StyleId):Promise<void>` and `RadioAudio.setEdition(seed,mood):Promise<void>`.
  - `RadioAudio.current.style:StyleId` and `RadioAudio.current.family?:string`.
  - The private `RadioAudio.styleFor(mood:Mood):StyleId`, which holds the interim rule.

- [ ] **Step 1: Start the rebase**

```bash
GIT_EDITOR=true git rebase origin/main
```

Expected: the docs commits and the Playwright bump apply cleanly. The rebase stops at "feat: add Top deck, pluggable places and a driving synthwave" with conflicts in `README.md`, `scripts/verify-mix.mjs`, `src/main.ts`, `src/music/audio.ts`, `src/music/composer/types.ts`, `src/music/sound.ts` and `src/session/session.ts`.

If it stops anywhere else, resolve that commit: keep both sides' text, and make `AGENTS.md` a copy of `CLAUDE.md`. Then run `GIT_EDITOR=true git rebase --continue`. At the main stop, also open `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, `index.html` and `scripts/render-music-preview.mjs`. They auto-merged, but Steps 9 to 12 change them.

- [ ] **Step 2: Move Kyle's files and fix their imports**

```bash
mkdir -p src/music/styles/dreamy
git mv src/music/synthwave/catalog.ts src/music/synthwave/composer.ts src/music/synthwave/effects.ts src/music/synthwave/sound.ts src/music/styles/dreamy/
git mv tests/synthwave.test.ts tests/dreamy.test.ts
sed -i '' "s#from '../composer/random'#from '../../composer/random'#; s#from '../composer/types'#from '../../composer/types'#; s#from '../composer'#from '../../composer'#" src/music/styles/dreamy/*.ts
```

In `src/music/styles/dreamy/composer.ts`, make only two edits. First, add a Top deck row to `names`, reusing four of Top deck's authored titles, because `Mood` now includes `deck`:

```ts
  coast: ['Ocean Drive', 'Silver Coastline', 'Afterglow FM', 'Beyond the Harbour'],
  deck: ['Sodium Glow', 'Violet Hour', 'Rooftop Signal', 'Cabin Light'],
```

Second, in the returned track, change `style: 'synthwave'` to `style: 'dreamy'`.

In `src/music/styles/dreamy/sound.ts`, replace `import type { SoundGraph } from '../sound';` with the routes type below, and change the signature to `synthVoice(graph: DreamyRoutes, ...)`. The function body stays byte-identical, because it reads the same field names.

```ts
/** The nodes a dreamy voice routes into; the bank owns them. */
export interface DreamyRoutes {
  context: BaseAudioContext; synth: GainNode; synthSnare: GainNode; bass: GainNode; drums: GainNode;
  drumBuffers: Map<string, AudioBuffer>;
}
```

- [ ] **Step 3: Write the dreamy bank**

Create `src/music/styles/dreamy/bank.ts`. The routing, seeds and mode targets reproduce `origin/main`'s `createGraph`, `scheduleNote` and `setSoundMode` for synth events exactly. On `main`, the bass and drums gains are `gain(1)` connected to music, the drums target is 0 when drums are off, and the bass target is .55.

```ts
import type { MusicMode } from '../../composer';
import { noiseBuffer, trackVoice, type SoundGraph } from '../../sound';
import type { SoundBank } from '../index';
import { createSynthEffects } from './effects';
import { synthVoice, type DreamyRoutes } from './sound';

/** Dreamy synthwave's own chorus, hall, gated snare room, drums and bass; nothing here touches the lofi path. */
export async function dreamyBank(graph:SoundGraph):Promise<SoundBank> {
  const {context,music,seed}=graph;
  const gain=(value:number)=>{const g=context.createGain();g.gain.value=value;g.connect(music);graph.nodes.push(g);return g;};
  const bass=gain(1),drums=gain(1),effects=createSynthEffects(context,music,drums,seed);
  graph.nodes.push(...effects.nodes);graph.sources.push(...effects.sources);
  const drumBuffers=new Map([
    ['synth-snare',noiseBuffer(context,.32,seed^0x813,(t,n)=>(n*.75+Math.sin(2*Math.PI*180*t)*.25)*Math.exp(-t*17)*(1-Math.exp(-t*1800)))],
    ['synth-hat',noiseBuffer(context,.1,seed^0x808,(t,n)=>n*Math.exp(-t*55)*(1-Math.exp(-t*2000)))],
  ]);
  const routes:DreamyRoutes={context,synth:effects.input,synthSnare:effects.snare,bass,drums,drumBuffers};
  return {
    synth:effects.input,
    schedule(event,time,secondsPerBeat) {
      const voice=synthVoice(routes,event,time,secondsPerBeat);if(!voice)return;
      // Partners start with their note, so any later stop is legal; the voice owner stops them with it.
      for(const extra of voice.auxiliary){extra.start(time);extra.stop(voice.end);}
      trackVoice(graph,voice.source,voice.gain,voice.nodes,time,voice.end,voice.auxiliary);
    },
    setMode(mode:MusicMode) {
      const t=context.currentTime;
      drums.gain.setTargetAtTime(mode==='ambient'?0:1,t,.12);
      bass.gain.setTargetAtTime(mode==='ambient'?.55:1,t,.15);
    },
    stop() {},
  };
}
```

- [ ] **Step 4: Write the dreamy style**

Create `src/music/styles/dreamy/index.ts`. It reproduces `origin/main`'s synthwave branches of `createSession` and `composeSessionTrack`: the lofi chapter names, after hours from song 18 with energy capped at .56, and a fresh theme from `seed^Math.imul(index+1,0x2545f491)`.

```ts
import { randomSource } from '../../composer/random';
import type { MusicStyle } from '../index';
import { CHAPTERS } from '../lofi';
import { planSynthwave, synthTheme, type SynthArrangement } from './catalog';
import { composeSynthwave } from './composer';
import { dreamyBank } from './bank';

const FAMILIES:Record<string,string>={arpeggio:'Arpeggios & warm pads',pulse:'Pulsing bass',drift:'Drifting pads',lead:'Night-drive melodies'};

/** Dreamy night-drive synthwave: warm pads, rolling bass and echoing hooks, with its own seeded hour in every place. */
export default {
  id:'dreamy',lookahead:6,
  limits:{bpm:[84,112],grid:4,perBar:48,meanPerBar:32,perTrack:4200},
  planHour(_random,_place,seed) {
    let start=0;
    return planSynthwave(seed).map((arrangement,index)=>{
      const duration=arrangement.bars*240/arrangement.bpm;
      const slot={index,start,duration,chapter:CHAPTERS[Math.floor(index/3)],arrangement};start+=duration;return slot;
    });
  },
  compose(seed,place,slot,index) {
    const written=slot.arrangement as SynthArrangement;
    const arrangement=index>=18?{...written,energy:Math.min(.56,written.energy),theme:synthTheme(randomSource(seed^Math.imul(index+1,0x2545f491)))}:written;
    return composeSynthwave(seed,place.id,index,arrangement);
  },
  labels:{preparing:'Warming up the synths…',voice:t=>FAMILIES[t.family??'arpeggio']??FAMILIES.arpeggio},
  bank:dreamyBank,
} satisfies MusicStyle;
```

The `perBar: 48` and `meanPerBar: 32` limits come from a measurement on `origin/main`: across 4 places, 40 seeds and songs 0 to 21, the maximum was 46 events per bar, a mean of 30.5 per bar, 2,438 per track, and 85.8 to 102.4 bpm.

- [ ] **Step 5: Update the style registry and the two existing styles**

In `src/music/styles/index.ts`:

```ts
import type { MusicMode, ScoreEvent, Track } from '../composer';
import type { Place } from '../../places';
import type { SoundGraph } from '../sound';
import lofi from './lofi';
import dreamy from './dreamy';
import synthwave from './synthwave';

export interface Slot {index:number;start:number;duration:number;chapter:string;arrangement:{bpm:number}}
/** `pump`, `echo` and `synth`, where a bank has them, are its sidechain gain, echo return and effects input, read by checks. */
export interface SoundBank {schedule(event:ScoreEvent,time:number,secondsPerBeat:number,track:Track):void;setMode(mode:MusicMode):void;stop(at:number,from:number):void;readonly pump?:GainNode;readonly echo?:GainNode;readonly synth?:GainNode}
/** One kind of music: how it plans an hour, writes songs, names its instruments and voices them in its own bank. */
export interface MusicStyle {
  id:string;lookahead:number;
  limits:{bpm:readonly [number,number];grid:2|4;perBar:number;meanPerBar:number;perTrack:number};
  planHour(random:()=>number,place:Place,seed:number):Slot[];
  compose(seed:number,place:Place,slot:Slot,index:number):Track;
  labels:{preparing:string;voice(track:Pick<Track,'voice'|'darkness'|'family'>):string};
  bank(graph:SoundGraph,signal?:AbortSignal):Promise<SoundBank>;
}
export const STYLES={lofi,dreamy,synthwave} satisfies Record<string,MusicStyle>;
export type StyleId=keyof typeof STYLES;
// Not `in` (which accepts inherited keys) or Object.hasOwn (ES2022; this project targets ES2020).
export const isStyleId=(value:unknown):value is StyleId=>typeof value==='string'&&Object.keys(STYLES).includes(value);
export const styleOf=(style:string|undefined):MusicStyle=>isStyleId(style)?STYLES[style]:STYLES.lofi;
```

In `src/music/styles/lofi/index.ts`, rename `const chapters` to `export const CHAPTERS` and update its one use. Delete `drums:'Warm lofi beats',` from `labels`. In `src/music/styles/synthwave/index.ts`, delete `drums:'Drum machine',` from `labels`.

- [ ] **Step 6: Resolve `src/music/composer/types.ts`**

Take this branch's version, then add Kyle's additions:
- `Instrument` gains `| 'synth-chord' | 'synth-bass' | 'synth-kick' | 'synth-snare' | 'synth-hat'` (`pad`, `arp` and `lead` are already there).
- Add `export type SynthFamily = 'arpeggio' | 'pulse' | 'drift' | 'lead';`.
- `ScoreEvent` gains `brightness?: number`.
- `Track` gains `family?: SynthFamily`.

Do not keep Kyle's `MusicStyle = 'lofi' | 'synthwave'` union. `StyleId` replaces it. Keep `export type { PlaceId as Mood } from '../../places';`.

- [ ] **Step 7: Resolve `src/music/sound.ts`**

Take this branch's version. Drop `main`'s `PianoBank` parameter, its synth additions to `createGraph` and its synth branch in `scheduleNote`, because the dreamy bank owns those now. Then add Kyle's lifecycle fix and on-demand banks:

```ts
export interface Voice { start: number; end: number; gain: GainNode; source: AudioScheduledSourceNode; auxiliary: AudioScheduledSourceNode[]; nodes: AudioNode[] }
export interface SoundGraph {
  context: BaseAudioContext; output: GainNode; music: GainNode; ambience: GainNode; reverb: ConvolverNode;
  ambienceSources: {source:AudioBufferSourceNode;gain:GainNode;start:number}[]; voices: Set<Voice>;
  nodes: AudioNode[]; seed: number; banks: Map<string,SoundBank>;
  /** Long-lived effect oscillators, stopped on disposal; and banks still being built. */
  sources: AudioScheduledSourceNode[]; loading: Map<string,Promise<SoundBank>>;
}
```

- `createGraph` returns `{...,banks:new Map(),sources:[],loading:new Map()}`.
- Replace `prepareBanks` with:

```ts
/** One style's bank, built once per graph. A failed build is forgotten, so a later request can retry it. */
export function prepareBank(graph:SoundGraph,style:MusicStyle,signal?:AbortSignal):Promise<SoundBank> {
  const ready=graph.banks.get(style.id);if(ready)return Promise.resolve(ready);
  const known=graph.loading.get(style.id);if(known)return known;
  const loading=style.bank(graph,signal).then(bank=>{graph.banks.set(style.id,bank);return bank;}).finally(()=>graph.loading.delete(style.id));
  graph.loading.set(style.id,loading);return loading;
}
```

- In `trackVoice`, store the auxiliaries: `const voice={source,gain,nodes,start,end,auxiliary};`.
- In `stopVoices`, after `voice.source.stop(...)`, add `for(const extra of voice.auxiliary){try{extra.stop(at+fade+.01);}catch{/* Already stopped. */}}`.
- In `src/music/styles/synthwave/sound.ts`, the `lfo` helper also records its oscillator: `graph.sources.push(o);` after `.start()`. This changes no audio.
- In `disposeGraph`, stop `graph.sources` first and each voice's auxiliaries with its source:

```ts
export function disposeGraph(graph:SoundGraph) {
  for(const source of graph.sources){try{source.stop();}catch{/* Already stopped. */}}
  for(const voice of graph.voices) {for(const source of [voice.source,...voice.auxiliary]){try{source.stop();}catch{/* Already stopped. */}}for(const node of voice.nodes)node.disconnect();}
  graph.voices.clear();
  for(const {source,gain} of graph.ambienceSources){try{source.stop();}catch{/* Already stopped. */}source.disconnect();gain.disconnect();}
  graph.ambienceSources=[];
  for(const node of graph.nodes)node.disconnect();
}
```

- [ ] **Step 8: Resolve `src/session/session.ts`**

Take this branch's version, because `main`'s chapters, captions and synth branch now live in the styles. Then change the plan and `createSession`:

```ts
import {isStyleId,styleOf,type Slot,type StyleId} from '../music/styles';
export interface SessionPlan {seed:number;mood:Mood;style:StyleId;duration:number;slots:Slot[];events:SessionEvent[]}

/** A written hour. The place's own style times the scenery; the selected style, which may differ, writes the music. */
export function createSession(seed:number,mood:Mood,style?:string):SessionPlan {
  const place=placeById(mood),own:StyleId=isStyleId(place.music.style)?place.music.style:'lofi',random=randomSource(seed^0x527a91);
  const home=styleOf(own).planHour(random,place,seed);
  const events:SessionEvent[]=place.environment.events.map(({kind,slot,duration,beats})=>({kind,start:home[slot].start+(beats!==undefined?beats*60/home[slot].arrangement.bpm:35)+random()*(beats!==undefined?5:25),duration}));
  const chosen=isStyleId(style)?style:own;
  // Another style plans from a fresh stream, so the scenery never depends on the music.
  const slots=chosen===own?home:styleOf(chosen).planHour(randomSource(seed^0x527a91),place,seed);
  return {seed,mood,style:chosen,duration:3600,slots,events};
}
```

In `composeSessionTrack`, use `styleOf(plan.style)` instead of `styleOf(place.music.style)`. `sessionAt` is unchanged: its chapter comes from `plan.slots` (the music), and everything else from time and `plan.events`.

- [ ] **Step 9: Resolve `src/music/audio.ts`**

Take this branch's version. Then make these changes:

Imports and fields:

```ts
import { DEFAULT_MIX, createGraph, disposeGraph, holdParameter, prepareBank, schedule, setSoundMode, startAmbience, stopVoices, type SoundGraph } from './sound';
import { STYLES, isStyleId, styleOf, type SoundBank, type StyleId } from './styles';
// fields
  private style:StyleId='lofi';
  private chosen?:StyleId;
  private styleRevision=0;
  constructor(private seed:number,private mood:Mood) {this.style=this.styleFor(mood);this.plan=createSession(seed,mood,this.style);this.track=this.makeTrack();}
```

`current` adds `style:this.style,family:track.family`. `labels` becomes `styleOf(this.style).labels`.

`enable()`:
- Add Kyle's iOS block verbatim (from `origin/main`) right after the `if(this.running)return;` line.
- Inside the pending function, after `await resume;`, use:

```ts
        if(this.disposed||this.context!==context)return;
        this.graph??=createGraph(context,this.seed);
        // Listen needs only the playing style's bank; a newer pick made while it loads wins.
        for(;;){const style=this.style;try{await this.ensureBank(style);break;}catch(error){if(style===this.style||this.disposed)throw error;}}
```

- Before `graph.ambience.gain.value=...`, add Kyle's two lines: `graph.music.gain.cancelScheduledValues(context.currentTime);graph.music.gain.setValueAtTime(this.volume,context.currentTime);`. They replace `graph.music.gain.value=this.volume`.
- In the `catch`, change `this.abort?.abort();` to `this.abort?.abort();this.abort=undefined;`.
- Change the `finally` to `finally{this.pending=undefined;}`.

`setVolume` becomes Kyle's version: `holdParameter` before `setTargetAtTime`.

Add these members:

```ts
  // Until all three styles are offered everywhere, a pick only applies where the place's own music is lofi.
  private styleFor(mood:Mood):StyleId {const own=placeById(mood).music.style;return own==='lofi'?this.chosen??'lofi':isStyleId(own)?own:'lofi';}

  /** One style's bank, prepared on demand: synths need no download, and only Warm lofi waits for the piano. */
  private ensureBank(style:StyleId):Promise<SoundBank> {
    const graph=this.graph;if(!graph)return Promise.reject(new Error('The audio device is not ready.'));
    const ready=graph.banks.get(style);if(ready)return Promise.resolve(ready);
    this.abort??=new AbortController();
    // A bank built mid-session starts in the listener's drum setting.
    return prepareBank(graph,STYLES[style],this.abort.signal).then(bank=>{bank.setMode(this.mode);return bank;});
  }

  /** A listener's pick: switch music without resetting the scenery or starting playback. The latest pick wins. */
  async setStyle(style:StyleId):Promise<void> {
    if(this.disposed)return;
    const revision=++this.styleRevision,previous=this.chosen;
    this.chosen=style;
    const next=this.styleFor(this.mood);
    if(next===this.style)return;
    if(this.graph){
      try{await this.ensureBank(next);}
      catch(error){
        if(revision!==this.styleRevision||this.disposed)return;
        this.chosen=previous;
        // A place change made while this loaded planned with it; give that place its music back.
        if(this.style===next)this.replan(this.styleFor(this.mood));
        throw error;
      }
      if(revision!==this.styleRevision||this.disposed)return;
    }
    this.switchTo(next);
  }

  private replan(style:StyleId):void {
    this.style=style;this.index=0;this.plan=createSession(this.seed,this.mood,style);
    if(!this.running){this.track=this.makeTrack();this.beat=0;}
  }

  private switchTo(style:StyleId):void {
    // Synths need no samples: wake a waiting Listen rather than finish an obsolete piano download.
    if(style!=='lofi'&&this.graph?.loading.has('lofi')){this.abort?.abort();this.abort=undefined;}
    this.style=style;this.index=0;this.plan=createSession(this.seed,this.mood,style);this.track=this.makeTrack();this.beat=0;
    if(this.running&&this.context&&this.graph) {
      const now=this.context.currentTime,graph=this.graph;
      stopVoices(graph,now,.6);
      holdParameter(graph.music.gain,now);graph.music.gain.linearRampToValueAtTime(0,now+.6);graph.music.gain.linearRampToValueAtTime(this.volume,now+1.2);
      this.segments=[this.segment(this.track,now+.62,0)];this.tick();
    }
  }
```

`setEdition` returns a promise. Its first line becomes `if(seed===this.seed&&mood===this.mood)return Promise.resolve();`, and the plan line becomes `this.seed=seed;this.mood=mood;this.index=0;this.style=this.styleFor(mood);this.plan=createSession(seed,mood,this.style);`. Keep the body as it is, then end with:

```ts
    if(!this.graph)return Promise.resolve();
    const plan=this.plan;
    return this.ensureBank(this.style).then(()=>undefined,error=>{
      if(this.plan!==plan||this.disposed)return;
      // Keep the music already playing rather than fall silent in this place.
      const audible=this.position().track.style;
      if(isStyleId(audible)&&audible!==this.style&&this.graph?.banks.has(audible))this.replan(audible);
      throw error;
    });
```

In `tick`, only compose the next song once its bank is ready. Change the guard to `if(end<now+lookahead(segment.track)&&graph.banks.has(this.plan.style)) {`.

`renderPreview`:
- Its options gain `style?:StyleId`.
- `const plan=createSession(options.seed??20260917,options.mood??'rain',options.style);`
- `standalone` applies only to lofi: `options.standalone&&plan.style==='lofi'?composeTrack(...):composeSessionTrack(plan,index)`.
- Prepare only the plan's bank: `const graph=createGraph(context,plan.seed);await prepareBank(graph,STYLES[plan.style]);`.

- [ ] **Step 10: Resolve `src/main.ts` and `index.html`**

In `index.html`, replace this branch's single "The rhythm" row with Kyle's two rows, using the new value:

```html
      <div class="mix-options"><label for="music-style">Music style</label><select id="music-style"><option value="lofi">Warm lofi</option><option value="dreamy">Dreamy synthwave</option></select></div>
      <div class="mix-options"><label for="music-mode">Drums</label><select id="music-mode"><option value="beats">On</option><option value="ambient">Off</option></select></div>
```

In `src/main.ts`, take this branch's version, then port Kyle's additions with the new ids:

```ts
import {isStyleId,type StyleId} from './music/styles';
const styleError='That music couldn’t load. Your current style is still here. Choose the style again to retry.';
interface Preferences { volume:number; ambience:number; mode:'beats'|'ambient'; style:StyleId }
let preferences:Preferences={volume:DEFAULT_MIX.music,ambience:DEFAULT_MIX.ambience,mode:'beats',style:'lofi'};
// in the saved-preferences block, after the mode line:
    if(isStyleId(saved.style))preferences.style=saved.style;else if(saved.style==='synthwave')preferences.style='dreamy';
// after audio.setMode(preferences.mode):
void audio.setStyle(preferences.style);
$<HTMLSelectElement>('music-style').value=preferences.style;
let styleRequest=0,switchingStyle=false;
```

- Delete the `options[0].text=audio.labels.drums` line.
- In `updateEdition`, add `$<HTMLSelectElement>('music-style').disabled=SCENES[current.scene].music.style!=='lofi';`. This interim line is removed in Task 3. If `SCENES` entries lack `music`, use `placeById(current.scene)`, imported from `./places`.
- In `visit`, write `void audio.setEdition(current.seed,current.scene).catch(()=>say(styleError,true));`.
- In `updatePlayer`, make the track detail `switchingStyle?'Tuning into your music…':starting?audio.labels.preparing:!listened?'An hour, unfolding here':\`${track.label} · ${session.chapter}\``.
- Add Kyle's change handler:

```ts
$<HTMLSelectElement>('music-style').addEventListener('change',async e=>{
  const select=e.target as HTMLSelectElement;if(!isStyleId(select.value))return;
  const style=select.value,request=++styleRequest;switchingStyle=true;updatePlayer();
  try {
    await audio.setStyle(style);
    if(request!==styleRequest)return;
    preferences.style=style;savePreferences();
  } catch {
    if(request!==styleRequest)return;
    select.value=audio.current.style;say(styleError,true);
  } finally {if(request===styleRequest){switchingStyle=false;updatePlayer();}}
});
```

- [ ] **Step 11: Resolve the scripts**

Make these changes:
- `scripts/render-music-preview.mjs`: keep Kyle's version, which passes `style` as argv[7]. Our values are `dreamy` and `synthwave`.
- `scripts/verify-mix.mjs`: take this branch's version.
  - Read `const style=process.argv[2]==='dreamy'?'dreamy':undefined;`.
  - Replace `prepareBanks(graph,Object.values(STYLES))` with `await prepareBank(graph,STYLES[track.style??'lofi'])` (after composing the track).
  - Pass the style into `createSession(seed,mood,runStyle)`.
  - Run this list of `[place, style, indices]`, keeping the existing loops over modes:

```js
const lofiPlaces=['rain','meadow','snow','coast'];
const runs=style==='dreamy'
  ?[...lofiPlaces,'deck'].map(mood=>[mood,'dreamy',[0,1,2,3,16,17,18]])
  :[...lofiPlaces.map(mood=>[mood,'lofi',[0,1,3,6,9,10,17]]),['deck','synthwave',[0,1,3,6,7,9,10,16,17]]];
```

  - Use Kyle's chunked `suspend`/`resume` scheduling for dreamy renders only (`runStyle==='dreamy'`), so both calibrations keep their method.
  - `synth` means `runStyle==='synthwave'`.
  - Compute the lofi median from lofi runs at the lofi places only.
  - Write to `captures-synthwave/mix-balance.json` for dreamy, and to `captures-music/` otherwise, as on `main`.
- `scripts/verify-synthwave.mjs`: replace every `'synthwave'` with `'dreamy'`, except the legacy `localStorage.setItem(... style: 'synthwave' ...)` value, which stays to test the migration.
- `scripts/verify-ios-audio.mjs`: change `selectOption('#music-style', 'synthwave')` to `'dreamy'`.
- `scripts/verify-synthwave-sound.mjs`: move from the graph API to the bank.
  - Import `{createGraph,prepareBank,stopVoices,disposeGraph}` and `{STYLES}` from `/src/music/styles/index.ts`.
  - Replace each `createGraph(context, new Map(), seed)` with `createGraph(context, seed)`, followed by `const bank = await prepareBank(graph, STYLES.dreamy);`.
  - Replace each `scheduleNote(graph, event, at, spb)` with `bank.schedule(event, at, spb, {})`.
  - Replace each `graph.synth` with `bank.synth`.
  - Replace `createSession(..., 'synthwave')` with `'dreamy'`.
- `scripts/verify-scenes.mjs`: rewrite the deck piano check. Top deck no longer needs the piano, so Listen succeeds while the piano is blocked, and moving to rain keeps the synths playing with the message:

```js
  const piano=await browser.newPage({reducedMotion:'reduce'});
  piano.on('pageerror',error=>errors.push(error.message));
  await piano.route('**/audio/piano/*.mp3',route=>route.abort());await piano.goto(`${base}/?debug&scene=deck`);await ready(piano);
  await piano.click('#listen');await piano.waitForFunction(()=>window.__motes.radio.playing);
  assert.ok(['Analog synths','Soft pulse','Glass bells','Darksynth'].includes(await piano.evaluate(()=>window.__motes.track.label)));
  // A lofi place keeps the synths playing and says why.
  await piano.click('#scenes-toggle');await piano.click('[data-place="rain"]');
  await piano.waitForFunction(()=>!document.querySelector('#status').hidden);
  assert.equal(await piano.evaluate(()=>window.__motes.radio.playing),true);
  await piano.unroute('**/audio/piano/*.mp3');report.pianoRetryAtTheDeck=true;
```

- [ ] **Step 12: Merge the docs**

Make these changes:
- **CLAUDE.md:** keep both sides. In Kyle's paragraph:
  - change `src/music/synthwave/` to `src/music/styles/dreamy/`;
  - change `scripts/verify-mix.mjs synthwave` to `scripts/verify-mix.mjs dreamy`;
  - add after "Piano is loaded only when lofi needs it": "Banks load on demand, one per style."
- **AGENTS.md:** run `cp CLAUDE.md AGENTS.md`.
- **README.md:**
  - Keep Kyle's Warm lofi / Dreamy synthwave paragraphs, his iOS paragraph and his verify command list, with `verify-mix.mjs dreamy` replacing `verify-mix.mjs synthwave`.
  - Keep this branch's Top deck and synthwave paragraphs and the "Adding a place" guide.
  - The file table row becomes `src/music/styles/dreamy/`.
  - The preview example's style argument becomes `dreamy`.
  - In "Adding a place", `planHour` becomes `planHour(random, place, seed)`. The last sentence ("Listen waits for every registered bank, so moving between places never waits on a download.") becomes: "Banks load on demand: Listen prepares only the playing style's bank, a switch or a place change prepares the next one, and only Warm lofi downloads anything."
- **PRODUCT.md:** keep both user-direction paragraphs.
- **DESIGN.md:** in the Sound & motion component entry, replace "Warm lofi beats / Without drums, and Scene motion On / Still. The rhythm labels belong to the place's music style: Top deck offers Drum machine / Without drums." with "the Music style and Drums selects, and Scene motion On / Still." Keep Kyle's paragraph describing the two selects.
- Check for em dashes: `git diff --cached -U0 | grep -c "$(printf '\342\200\224')"` must print 0.

- [ ] **Step 13: Update the tests**

In `tests/dreamy.test.ts`, replace each `'synthwave'` with `'dreamy'`. In the last test, change `for (const mood of ['rain', 'meadow', 'snow', 'coast'] as const)` to include `'deck'`.

In `tests/music.test.ts`, below `LOFI_FINGERPRINT`, add the projection from Task 1 Step 4 and the recorded values:

```ts
/** Every event field too: dreamy must match main, and Top deck's driving hour the reviewed branch. */
const styleFingerprint=(style:string|undefined,moods:readonly Mood[])=>Object.fromEntries(moods.flatMap(mood=>[1,4242,20260917].map(seed=>{
  const plan=createSession(seed,mood,style);
  const scores=[0,9,17,18].map(i=>{const t=composeSessionTrack(plan,i);return JSON.stringify([t.title,t.bpm,t.bars,t.key,t.events,t.harmony,t.sections]);});
  const states=[0,600,1800,3300,5000].map(s=>{const {elapsed,progress,chapter,dusk,warmth,weather,lamps,events}=sessionAt(plan,s);return JSON.stringify({elapsed,progress,chapter,dusk,warmth,weather,lamps,events});});
  const slots=plan.slots.map(s=>[s.start,s.duration,s.chapter].join(',')),events=plan.events.map(e=>[e.kind,e.start,e.duration].join(','));
  return [`${mood}/${seed}`,fnv([...scores,...states,...slots,...events].join('|'))];
})));
const DREAMY_FINGERPRINT:Record<string,string>=/* paste Task 1 Step 5, first output */;
const DRIVING_FINGERPRINT:Record<string,string>=/* paste Task 1 Step 5, second output */;
```

Then add, inside the existing `describe` and next to the lofi fingerprint test:

```ts
  it('keeps dreamy synthwave identical to main and Top deck identical to the reviewed branch',()=>{
    expect(styleFingerprint('dreamy',['rain','meadow','snow','coast'])).toEqual(DREAMY_FINGERPRINT);
    expect(styleFingerprint(undefined,['deck'])).toEqual(DRIVING_FINGERPRINT);
  });
```

The two `/* paste */` markers are the only values you fill in. They are the literal JSON printed in Task 1 Step 5.

- [ ] **Step 14: Run the fast checks**

```bash
npm test && npx tsc --noEmit -p . && npm run build
```

Expected: everything passes, and the test count is 82, plus Kyle's 6 in `dreamy.test.ts`, plus 1 fingerprint test. If `DREAMY_FINGERPRINT` fails, the port changed dreamy. Diff one track's events against `.worktrees/baseline-main` before touching anything else.

- [ ] **Step 15: Run the audio and browser checks**

```bash
node scripts/render-music-preview.mjs 60 captures-after/dreamy-rain.wav 20260917 rain 3 dreamy
node scripts/render-music-preview.mjs 60 captures-after/driving-deck.wav 20260917 deck 3
for p in rain meadow snow coast; do node scripts/render-music-preview.mjs 60 captures-after/$p.wav 20260917 $p 3; done
node -e "const fs=require('fs');for(const n of ['dreamy-rain','driving-deck','rain','meadow','snow','coast']){const a=fs.readFileSync('captures-baseline/'+n+'.wav'),b=fs.readFileSync('captures-after/'+n+'.wav');let m=0;for(let i=44;i<Math.min(a.length,b.length);i+=2)m=Math.max(m,Math.abs(a.readInt16LE(i)-b.readInt16LE(i)));console.log(n,a.length===b.length,m);}"
node scripts/verify-music.mjs && node scripts/verify-mix.mjs && node scripts/verify-mix.mjs dreamy
node scripts/verify-synthwave.mjs && node scripts/verify-synthwave-sound.mjs && node scripts/verify-ios-audio.mjs
MOTES_URL=http://127.0.0.1:5175 node scripts/verify-scenes.mjs && MOTES_URL=http://127.0.0.1:5175 node scripts/verify-sessions.mjs
```

Run the last line against a dev server you start in the background (`npx vite --host 127.0.0.1 --port 5175 --strictPort`; pick another port and set `MOTES_URL` to match if 5175 is taken). Wait until it answers, and stop it afterwards.

Expected: every size check prints `true`. The maximum difference is at most 4 for the lofi places and at most 16 for dreamy and driving. Every script exits 0.

- [ ] **Step 16: Commit the resolution and finish the rebase**

```bash
git add -A
git status --short   # only intended files; no captures, no fingerprint scripts
git commit -F - <<'EOF'
feat: add Top deck, pluggable places and a driving synthwave

Places and music styles become pluggable: each place owns its painting,
scenery and music style, and each style plans its hour, writes its songs,
names its instruments and voices them in its own bank. Top deck, a fifth
place above the city, plays a synthwave night drive through six chapters
with four synth voices.

On main, Kyle's dreamy synthwave moves into the style system unchanged as
the dreamy style, with its own bank for his chorus, hall, gated room and
voices. Banks load on demand, so only Warm lofi waits for the piano. Lofi
and dreamy scores match main, and Top deck's hour matches the reviewed
branch.

<trailer>
EOF
GIT_EDITOR=true git rebase --continue
git log --oneline origin/main..HEAD   # 12 commits, the squashed one rewritten
```

---

### Task 3: Offer all three music styles in every place

This is the integration commit. It renames the style id `synthwave` to `driving`, adds Driving synthwave to the select, applies the memory rule and Top deck's default, and updates the docs.

**Files:**
- Move: `src/music/styles/synthwave/` to `src/music/styles/driving/`
- Modify: `src/music/styles/index.ts`, `src/music/styles/driving/index.ts`, `src/music/styles/driving/song.ts`, `src/places/deck.ts`, `src/music/audio.ts`, `src/main.ts`, `index.html`, `tests/session.test.ts`, `scripts/verify-mix.mjs`, `scripts/verify-music.mjs`, `scripts/verify-synthwave.mjs`, `scripts/verify-scenes.mjs`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `PRODUCT.md`, `DESIGN.md`

**Interfaces:**
- Consumes: everything that Task 2 produces.
- Produces: `playingStyle(place:Place,chosen?:StyleId):StyleId` in `src/music/styles/index.ts`, and the `styleChoice` preference field.

- [ ] **Step 1: Write the failing contract test**

In `tests/session.test.ts`, import `playingStyle` and `type StyleId` alongside `STYLES` and `styleOf`. Then add, inside the first `describe`:

```ts
  it('plays every style in every place without moving the scenery',()=>{
    expect(playingStyle(placeById('deck'))).toBe('driving');expect(playingStyle(placeById('rain'))).toBe('lofi');
    expect(playingStyle(placeById('deck'),'lofi')).toBe('lofi');
    for(const mood of ids){
      const home=createSession(913,mood);
      for(const id of Object.keys(STYLES) as StyleId[]){
        const plan=createSession(913,mood,id),limits=STYLES[id].limits;
        expect(plan.style).toBe(id);expect(plan.events).toEqual(home.events);
        // The chapter follows the music; light, weather and events follow the place.
        for(const s of [0,600,1800,3300,5000]){const {chapter:_a,...here}=sessionAt(plan,s),{chapter:_b,...there}=sessionAt(home,s);expect(here).toEqual(there);}
        for(const index of [0,9,17,18]){
          const track=composeSessionTrack(plan,index);
          expect(track.style,`${id} at ${mood}`).toBe(id);
          expect(track.bpm).toBeGreaterThanOrEqual(limits.bpm[0]);expect(track.bpm).toBeLessThanOrEqual(limits.bpm[1]);
          expect(track.events.length).toBeLessThan(limits.perTrack);
        }
      }
    }
  });
```

Run `npx vitest run tests/session.test.ts -t "every style in every place"`. Expected: FAIL, because `playingStyle` is not exported yet.

- [ ] **Step 2: Rename the style to `driving`**

```bash
git mv src/music/styles/synthwave src/music/styles/driving
grep -rln "styles/synthwave" src tests scripts | xargs sed -i '' 's#styles/synthwave#styles/driving#g'
```

Then make these id changes:
- `driving/index.ts`: `id:'driving'`.
- `driving/song.ts`: `style:'driving'`.
- `src/places/deck.ts`: `music:{style:'driving',...}`.
- `src/music/styles/index.ts`: import `driving` from `./driving`, and `STYLES={lofi,dreamy,driving}`.
- `src/music/audio.ts` diagnostics: `banks.get('driving')`.
- `tests/session.test.ts`: `styleOf('driving')`.
- `scripts/verify-mix.mjs`: `'synthwave'` becomes `'driving'` in `runs` and in the `synth` test.

Run `grep -rn "'synthwave'" src tests scripts`. The only hits left should be `main.ts`'s legacy preference check and `verify-synthwave.mjs`'s legacy `localStorage` value.

- [ ] **Step 3: Add `playingStyle` and use it**

In `src/music/styles/index.ts`:

```ts
/** What plays here: the listener's pick if they made one, otherwise the place's own music. */
export const playingStyle=(place:Place,chosen?:StyleId):StyleId=>chosen??(isStyleId(place.music.style)?place.music.style:'lofi');
```

In `src/music/audio.ts`, replace `styleFor` and its interim comment with `private styleFor(mood:Mood):StyleId {return playingStyle(placeById(mood),this.chosen);}`. Then run `npx vitest run tests/session.test.ts`. Expected: PASS.

- [ ] **Step 4: Apply the memory rule in `src/main.ts` and `index.html`**

In `index.html`, add `<option value="driving">Driving synthwave</option>` after Dreamy synthwave.

In `src/main.ts`:

```ts
interface Preferences { volume:number; ambience:number; mode:'beats'|'ambient'; styleChoice?:StyleId }
let preferences:Preferences={volume:DEFAULT_MIX.music,ambience:DEFAULT_MIX.ambience,mode:'beats'};
// in the saved-preferences block:
    if(isStyleId(saved.styleChoice))preferences.styleChoice=saved.styleChoice;
    // Main saved `style` with every change, so only its synthwave value records a real pick.
    else if(saved.style==='synthwave')preferences.styleChoice='dreamy';
// replacing Task 2's `void audio.setStyle(preferences.style);`:
if(preferences.styleChoice)void audio.setStyle(preferences.styleChoice);
```

- Delete `$<HTMLSelectElement>('music-style').value=preferences.style;` and the Task 2 `disabled` line in `updateEdition`.
- In the change handler, save `preferences.styleChoice=style;`.
- In `updatePlayer`, keep the select showing the playing style: `const styleSelect=$<HTMLSelectElement>('music-style');if(!switchingStyle&&styleSelect.value!==audio.current.style)styleSelect.value=audio.current.style;`.

- [ ] **Step 5: Extend Kyle's preferences and switching checks**

In `scripts/verify-synthwave.mjs`:
- The rapid-switch loop becomes `for (let i = 0; i < 9; i++) await page.evaluate(i => window.radio.setStyle(['lofi', 'dreamy', 'driving'][i % 3]), i);`.
- Every `JSON.parse(localStorage.getItem('motes-listening')).style === X` becomes `.styleChoice === X`.
- Append these checks before the phone section:

```js
  assert.deepEqual(await page.locator('#music-style option').evaluateAll(o => o.map(x => x.value)), ['lofi', 'dreamy', 'driving']);
  // Main saved `style: 'lofi'` with any change; Top deck still opens on its own music and keeps the volume.
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ volume: .5, style: 'lofi' })));
  await page.goto(server.resolvedUrls.local[0] + '?scene=deck');
  assert.equal(await page.locator('#music-style').inputValue(), 'driving');
  assert.equal(await page.locator('#music-volume').inputValue(), '50');
  // A pick applies in every place and survives a reload.
  await page.click('#mix-toggle'); await page.selectOption('#music-style', 'dreamy');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).styleChoice === 'dreamy');
  await page.goto(server.resolvedUrls.local[0] + '?scene=rain');
  assert.equal(await page.locator('#music-style').inputValue(), 'dreamy');
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ styleChoice: 'bogus' })));
  await page.goto(server.resolvedUrls.local[0] + '?scene=deck');
  assert.equal(await page.locator('#music-style').inputValue(), 'driving');
```

In `scripts/verify-scenes.mjs`, in the deck piano check, after the status check add `assert.equal(await piano.locator('#music-style').inputValue(),'driving');`. Then add the retry:

```js
  await piano.click('#mix-toggle');await piano.selectOption('#music-style','lofi');
  await piano.waitForFunction(()=>window.__motes.track.style==='lofi');
```

In `scripts/verify-mix.mjs`, add `['deck','lofi',[0,1,3,6,9,10,17]]` and `['rain','driving',[0,16,17]]` to the default `runs`. Apply the ±1.5 dB theme check to every driving run at songs 0, 16 and 17.

- [ ] **Step 6: Update the docs**

Make these changes:
- **CLAUDE.md:**
  - The first paragraph's opening becomes: "Motes is living scenery and warm jazzy lofi radio, with two synthwave styles offered in every place, and a synthwave place, Top deck."
  - Replace Kyle's paragraph with: "Three music styles play in every place: Warm lofi (src/music/styles/lofi/), Dreamy synthwave (src/music/styles/dreamy/) and Driving synthwave (src/music/styles/driving/). Each place declares its own style; a pick from Music style is remembered once and applies everywhere, and with no pick each place plays its own, so Top deck opens on Driving synthwave. Scenery timing always comes from the place's own style, so a style switch never moves an event. Keep Music style independent of Drums. Style switches fade the music and start a new musical hour but never reset the environment plan or clock. Banks load on demand: piano is loaded only when Warm lofi needs it; late or failed loads must not override a newer style choice or resume paused playback. Every synthesized oscillator, including detuned partners, belongs to the shared voice lifecycle. Verify dreamy via scripts/verify-synthwave.mjs and scripts/verify-mix.mjs dreamy, plus three rendered family previews."
  - Change "Top deck rotates four synth voices" to "Driving synthwave rotates four synth voices".
  - Change "Each synthwave song has one melodic focus" to "Each driving synthwave song has one melodic focus".
- **AGENTS.md:** run `cp CLAUDE.md AGENTS.md && cmp CLAUDE.md AGENTS.md`.
- **README.md:**
  - The Music style sentence becomes "Choose **Warm lofi**, **Dreamy synthwave** or **Driving synthwave** under **Sound & motion → Music style**, in any place. A pick is remembered and applies everywhere; with none, each place plays its own music, so Top deck opens on Driving synthwave."
  - Rename the driving section's style name.
  - Update the file table (`src/music/styles/driving/`).
  - Any "Adding a place" example that uses `style:'synthwave'` uses `'driving'`.
- **PRODUCT.md:**
  - After the 28 September paragraphs, add: "On 1 October they asked to keep both synthwaves and offer all three styles in every place, with Top deck opening on its own driving synthwave until the listener picks a style."
  - "At Top deck the hour is a synthwave night drive" becomes "Top deck's own hour is a driving synthwave night drive".
- **DESIGN.md:**
  - Kyle's selects paragraph lists three options and adds: "A pick is remembered and applies in every place; with none, each place plays its own music, so Top deck opens on Driving synthwave."
  - The Radio component sentence about the instrument name becomes: "the instrument name belongs to the music style that is playing: the piano voice for Warm lofi, the song family for Dreamy synthwave and the synth voice for Driving synthwave."
- Check for em dashes: `git diff -U0 | grep -c "$(printf '\342\200\224')"` must print 0.

- [ ] **Step 7: Run every check**

```bash
npm test && npx tsc --noEmit -p . && npm run build
node scripts/render-music-preview.mjs 60 captures-after/driving-deck.wav 20260917 deck 3
node -e "const fs=require('fs');const a=fs.readFileSync('captures-baseline/driving-deck.wav'),b=fs.readFileSync('captures-after/driving-deck.wav');let m=0;for(let i=44;i<a.length;i+=2)m=Math.max(m,Math.abs(a.readInt16LE(i)-b.readInt16LE(i)));console.log(a.length===b.length,m);"
node scripts/verify-music.mjs && node scripts/verify-mix.mjs && node scripts/verify-mix.mjs dreamy
node scripts/verify-synthwave.mjs && node scripts/verify-synthwave-sound.mjs && node scripts/verify-ios-audio.mjs
MOTES_URL=http://127.0.0.1:5175 node scripts/verify-scenes.mjs && MOTES_URL=http://127.0.0.1:5175 node scripts/verify-sessions.mjs   # against a background dev server, as in Task 2 Step 15
git diff --stat -M HEAD -- src | tail -1   # under 150 insertions; -M keeps the rename out of the count
```

Expected: everything passes, the fingerprints still match (they ignore style ids), and the driving PCM difference is at most 16.

- [ ] **Step 8: Commit**

```bash
git add -A && git status --short
git commit -F - <<'EOF'
feat: offer all three music styles in every place

Music style now offers Warm lofi, Dreamy synthwave and Driving synthwave
in every place. A pick is remembered once and applies everywhere; with
none, each place plays its own music, so Top deck opens on Driving
synthwave. Scenery timing always comes from the place's own style, so a
switch never moves an event. Main saved its style with every change, so
only its synthwave value carries over, as Dreamy.

<trailer>
EOF
```

---

### Task 4: Full verification and handover

**Files:**
- Modify: `.superpowers/sdd/handoff.md` (git-ignored)
- Delete: `.worktrees/baseline-main`, `.worktrees/baseline-head`

- [ ] **Step 1: Re-run the full suite at the final tip**

Run Task 3 Step 7 in full, plus the lofi PCM and capture comparisons:

```bash
for p in rain meadow snow coast; do node scripts/render-music-preview.mjs 60 captures-after/$p.wav 20260917 $p 3; done
node -e "const fs=require('fs');for(const p of ['rain','meadow','snow','coast']){const a=fs.readFileSync('captures-baseline/'+p+'.wav'),b=fs.readFileSync('captures-after/'+p+'.wav');let m=0;for(let i=44;i<a.length;i+=2)m=Math.max(m,Math.abs(a.readInt16LE(i)-b.readInt16LE(i)));console.log(p,a.length===b.length,m);}"
for p in rain meadow snow coast; do for v in desktop mobile; do cmp -s captures-baseline/scenes/$p-$v.png captures-scenes/$p-$v.png && echo "$p-$v identical" || echo "$p-$v DIFFERS"; done; done
```

Expected: lofi differences are at most 4, and all eight captures are identical.

- [ ] **Step 2: Render one preview per style for the user**

```bash
node scripts/render-music-preview.mjs 90 captures-music/three-styles-lofi-deck.wav 20260917 deck 0 lofi
node scripts/render-music-preview.mjs 90 captures-music/three-styles-dreamy-deck.wav 20260917 deck 0 dreamy
node scripts/render-music-preview.mjs 90 captures-music/three-styles-driving-rain.wav 20260917 rain 0 driving
```

Expected: `clipped: 0` for each. These are the away-from-home pairings that the user should judge by ear.

- [ ] **Step 3: Run the impeccable detector once**

```bash
~/.claude/skills/impeccable/scripts/impeccable detect --json index.html
```

Fix any finding that the change introduced. Report the others without changing them.

- [ ] **Step 4: Check the docs**

```bash
cmp CLAUDE.md AGENTS.md && git diff origin/main..HEAD | grep '^+' | grep -c "$(printf '\342\200\224')"   # expect 0
git diff origin/main..HEAD | grep -iE 'spotify|playlist' | grep '^+'   # expect nothing
```

- [ ] **Step 5: Clean up and hand over**

```bash
git worktree remove --force .worktrees/baseline-main && git worktree remove --force .worktrees/baseline-head
git status --short    # expect nothing
```

Stop any dev server you started. Then update `.superpowers/sdd/handoff.md`:
- the new commit list;
- the verification results;
- that `backup/pre-rebase` exists until the user is happy;
- the three preview paths for listening;
- that the push and the PR wait for the user's word.

Do not push.
