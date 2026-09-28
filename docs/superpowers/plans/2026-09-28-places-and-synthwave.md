# Places and synthwave: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make places and music styles pluggable without changing anything a listener hears or sees, then add a synthwave style and a fifth place, Top deck, built on those seams.

**Architecture:** `src/places/` holds one file per place plus a registry; shared scene, session and sound code reads place fields instead of branching on ids. `src/music/styles/` defines `MusicStyle` and `SoundBank`; lofi wraps today's composer, planner and instruments, and synthwave adds its own library, songs, hour and synthesized bank. The radio schedules each segment to its own style's look-ahead.

**Tech Stack:** TypeScript (strict, `tsc` checks `src` only), Vitest, Vite dev server, Playwright scripts, Web Audio. No runtime npm dependencies.

**Spec:** `docs/superpowers/specs/2026-09-28-places-and-synthwave-design.md`

## Global Constraints

- Work only on branch `feat/places-and-synthwave`. Three commits in total (end of Tasks 3, 6 and 8). The old song always finishes after a visit, across styles too (user decision, 2026-09-28). Never push unless the user asks.
- The four lofi places must stay byte-identical in score (the Task 1 fingerprint), within 1e-4 per sample in PCM, and byte-identical in reduced-motion canvas captures, through Tasks 2 and 3.
- Pure composers: no `Math.random`, no wall time; the same inputs give `toEqual` output. Scenery randomness never reads the audio clock.
- Lofi limits: bpm 68–88, grid 2 per beat (swung), at most 34 events in a bar, mean 19, fewer than 2,600 per track, look-ahead 6 s.
- Synthwave limits: bpm 88–150, grid 4 per beat (straight), at most 64 events in a bar, mean 44, fewer than 6,000 per track, look-ahead 3 s.
- Every hour is eighteen contiguous slots summing to exactly 3,600 s, with `slot.duration === bars*4*60/bpm`.
- `DAILY_PLACES` is exactly `['rain','meadow','snow','coast']` forever. New places join `PLACES` only.
- Every kick lands within 0.015 beats of a bass onset, in both styles.
- Envelopes end at 0.0001, never 0 (exponential ramps to zero throw).
- Atmosphere at least 18 dB below music in every measured window; garage theme-window music RMS within 1.5 dB of the lofi places' median.
- Lightning: at most two flickers per 20 s window, never three flashes within 1 s, alpha at most 0.12, sky only, none when motion is off, none after 3,600 s.
- Paintings are 1672×941 PNGs with `.png.json` sidecars and an `ARTWORK.md` section. No placeholder art is committed.
- Copy: sentence case, short, in the Motes voice, no em dashes. Never name the user's reference playlist or its artists in any committed file, and reuse none of their track titles.
- No new audio sample files; no second `ConvolverNode`; no new interface colours, fonts or components.

## Review Focus

1. **Switching places across styles quickly** (rain, then deck, then rain, each within a second): pending voices stay under 200, no more than two segments are queued, and no pump or echo automation leaks into the next song. Test in Task 6 (`verify-music`).
2. **Pause or Without drums in the middle of a synth chorus:** pumping stops at once (pump gain reads 1 within 100 ms), no echo tail resumes after Pause, and voices reach 0. Test in Task 6 (`verify-music`).
3. **Still or reduced motion during the storm:** no lightning is ever drawn, and a still frame does not freeze mid-flash. Test in Task 6 (`lightningAt` unit check) and Task 7 (`verify-sessions` still frame at the storm).
4. **The piano fails to download while the listener is at Top deck:** Listen shows the retry message, and a second Listen plays synthwave. Test in Task 7 (`verify-scenes`).
5. **Sharing and daily links:** `?scene=deck&day=…` pins Top deck and survives reload; every existing daily date keeps its place and seed. Test in Task 7 (`edition.test.ts` and `verify-scenes`).

---

## Commit 1: Structure (no audible or visible change)

### Task 1: Safety net

**Files:**
- Modify: `tests/music.test.ts` (add one check)
- Create (untracked, gitignored by `captures-*/`): `captures-baseline/`

**Interfaces:**
- Produces: `LOFI_FINGERPRINT` constant in `tests/music.test.ts`; baseline WAVs `captures-baseline/<place>.wav`; baseline PNGs `captures-baseline/scenes/<place>-{desktop,mobile}.png`.

- [ ] **Step 1: Add the fingerprint check** to `tests/music.test.ts`, below the existing imports:

```ts
import {createSession,composeSessionTrack,sessionAt} from '../src/session/session';

const fnv=(text:string)=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),0x01000193)>>>0;return h.toString(16);};
/** A fixed projection of every lofi hour: scores, sampled environment (without the unused caption), slots and events. */
const lofiFingerprint=()=>Object.fromEntries((['rain','meadow','snow','coast'] as Mood[]).flatMap(mood=>[1,4242,20260917].map(seed=>{
  const plan=createSession(seed,mood);
  const scores=[0,9,17,18].map(i=>{const t=composeSessionTrack(plan,i);return [t.title,t.bpm,t.bars,t.key,...t.events.map(e=>[e.beat,e.duration,e.note,e.velocity,e.pan,e.instrument,e.voice??''].join(','))].join(';');});
  const states=[0,600,1800,3300,5000].map(s=>{const {elapsed,progress,chapter,dusk,warmth,weather,lamps,events}=sessionAt(plan,s);return JSON.stringify({elapsed,progress,chapter,dusk,warmth,weather,lamps,events});});
  const slots=plan.slots.map(s=>[s.start,s.duration,s.chapter].join(',')),events=plan.events.map(e=>[e.kind,e.start,e.duration].join(','));
  return [`${mood}/${seed}`,fnv([...scores,...states,...slots,...events].join('|'))];
})));
const LOFI_FINGERPRINT:Record<string,string>={};
```

and inside `describe('daily radio composition', …)`:

```ts
  it('keeps every lofi hour identical through the places and styles refactor',()=>{
    expect(lofiFingerprint()).toEqual(LOFI_FINGERPRINT);
  });
```

- [ ] **Step 2: Record the fingerprint from today's code.** Temporarily add `console.log(JSON.stringify(lofiFingerprint()));` as the first line of that `it`, run `npx vitest run tests/music.test.ts -t "identical through"`, paste the printed object as the value of `LOFI_FINGERPRINT`, remove the `console.log`, and run again.
  Expected: PASS with twelve entries.

- [ ] **Step 3: Record PCM baselines.** For each place, render the fourth song for 60 s:

```bash
for p in rain meadow snow coast; do node scripts/render-music-preview.mjs 60 captures-baseline/$p.wav 20260917 $p 3; done
```

Expected: four WAVs, each report with `clipped: 0`.

- [ ] **Step 4: Record reduced-motion scene captures.** Start `npm run dev -- --host 127.0.0.1 --port 5175` in the background, run `node scripts/verify-scenes.mjs`, then copy them:

```bash
mkdir -p captures-baseline/scenes && for p in rain meadow snow coast; do cp captures-scenes/$p-desktop.png captures-scenes/$p-mobile.png captures-baseline/scenes/; done
```

- [ ] **Step 5:** `npm test` and `npm run build` pass. No commit yet (Commit 1 lands at the end of Task 3).

### Task 2: Place registry

**Files:**
- Create: `src/places/index.ts`, `src/places/light.ts`, `src/places/rain.ts`, `src/places/meadow.ts`, `src/places/snow.ts`, `src/places/coast.ts`
- Modify: `src/scenes/edition.ts`, `src/scenes/scene-light.ts`, `src/scenes/renderer.ts`, `src/scenes/session-effects.ts`, `src/session/session.ts`, `src/main.ts`
- Modify tests: `tests/edition.test.ts`, `tests/session.test.ts`
- Modify scripts: `scripts/verify-scenes.mjs`, `scripts/verify-sessions.mjs`

**Interfaces:**
- Produces (from `src/places/index.ts`): `Point`, `LightState`, `Space`, `LayerInput`, `Layer`, `EventPlan`, `WeatherInput`, `AmbienceTexture`, `Place`, `PLACES`, `DRAFTS`, `DAILY_PLACES`, `PlaceId`, `placeById(id: string): Place`.
- Produces (from `src/places/light.ts`): `clamp`, `smooth`, `Arc`, `arc(a: Arc): (t: number) => LightState`.
- Produces (from `src/scenes/session-effects.ts`): `polygon`, `glow`, `windows(spots, fixtures): Layer`, `birds(colour): (ctx, event, input) => void`, `during(kind, draw): Layer`, `drawSessionEffects(ctx, place, state, time, space, authoredLight, light, motion, seed)`.
- Keeps: `SCENE_IDS`, `SCENES`, `SceneId`, `isScene`, `edition`, `sceneLightAt(scene, seconds)`, `sceneLightWeights(scene, u, v)`, `createSession`, `sessionAt`, `composeSessionTrack` with today's signatures.

Import rule (no runtime cycles): `light.ts` and `session-effects.ts` import nothing from `places/` or `scene-light.ts` except with `import type`. Place files import `light.ts`, `session-effects.ts` and `meadow-light.ts`.

- [ ] **Step 1: Write `src/places/light.ts`:**

```ts
import type {LightState} from './index';

export const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
type Timing=readonly [start:number,duration:number];
export interface Arc {timing:readonly [sky:Timing,distance:Timing,foreground:Timing,water:Timing];lamps:Timing;captions:readonly string[];subtitles:readonly string[]}

/** A written lighting arc, held at its final state after an hour. */
export function arc(a:Arc):(t:number)=>LightState {
  return t=>{
    const [sky,distance,foreground,water]=a.timing.map(([start,duration])=>smooth((t-start)/duration));
    return {sky,distance,foreground,water,lamps:smooth((t-a.lamps[0])/a.lamps[1]),
      caption:a.captions[Math.min(3,Math.floor(t/900))],subtitle:a.subtitles[Math.min(2,Math.floor(t/1200))]};
  };
}
```

- [ ] **Step 2: Write `src/places/index.ts`:**

```ts
import type {ActiveEvent,SessionState} from '../session/session';
import rain from './rain';
import meadow from './meadow';
import snow from './snow';
import coast from './coast';

export type Point=readonly [number,number];
export interface LightState {sky:number;distance:number;foreground:number;water:number;lamps:number;caption:string;subtitle:string}
export interface Space {width:number;height:number;iw:number;point:(u:number,v:number)=>{x:number;y:number}}
export interface LayerInput {state:SessionState;time:number;space:Space;light:LightState;motion:boolean;seed:number}
export type Layer=((ctx:CanvasRenderingContext2D,input:LayerInput)=>void)&{kind?:string};
export interface EventPlan {kind:string;slot:number;duration:number;beats?:number}
export interface WeatherInput {progress:number;dusk:number;events:readonly ActiveEvent[]}
export type AmbienceTexture=(white:number,brown:number,soft:number,phase:number,channel:number)=>number;
export interface Place {
  id:string;name:string;title:string;weather:string;lights:readonly [string,string,string];
  image:string;eveningImage:string;anchor:number;color:string;
  water?:{outline:readonly Point[];from?:number;shimmer?:number;tint?:string};
  lamps:readonly Point[];steam?:Point;birds?:string;
  effect?:'rain'|'snow'|'pollen';
  fallback?:{tint:string;depth:number};
  light(seconds:number):LightState;
  regions(u:number,v:number):readonly [sky:number,distance:number,foreground:number];
  environment:{events:readonly EventPlan[];weather(input:WeatherInput):number};
  draw:readonly Layer[];
  ambience:{trim:number;texture:AmbienceTexture};
  music:{style:string;salt:number;titles:readonly string[];tempo:number};
}

/** Shown in Find a place, in this order. */
export const PLACES=[rain,meadow,snow,coast] as const;
/** Reachable by id for music work and tests before their paintings exist; never shown. */
export const DRAFTS:readonly Place[]=[];
export type PlaceId=typeof PLACES[number]['id'];
/** Frozen: adding a place here would reshuffle every existing daily link. */
export const DAILY_PLACES=['rain','meadow','snow','coast'] as const;
export const placeById=(id:string):Place=>PLACES.find(p=>p.id===id)??DRAFTS.find(p=>p.id===id)??PLACES[0];
```

- [ ] **Step 3: Write the four place files** by moving today's values verbatim. Each file is `export default {…} as const satisfies Place` with `id` as a literal. Sources, field by field:

| Field | Source today |
| --- | --- |
| `name`, `title`, `image`, `eveningImage`, `anchor`, `color`, `weather`, `water.outline` | `SCENES` in `edition.ts:8-16` (drop `subtitle`; it equals `light(0).subtitle`) |
| `lights` | `lights` table in `edition()` (`edition.ts:42-47`) |
| `water.from`, `water.shimmer` | coast only: `.38` and `1.5` (`renderer.ts:114,117`); others use the defaults `.6` and `1` |
| `water.tint` | rain only: `'#bcecff'` (`renderer.ts:149`) |
| `lamps` | `spots` in `renderer.ts:206` |
| `steam` | coast `[.084,.587]`, snow `[.13,.525]` (`renderer.ts:215`) |
| `birds` | coast `'#223148'`, meadow `'#34515a'` (`renderer.ts:196`) |
| `effect` | rain `'rain'`, snow `'snow'`, meadow `'pollen'` (`renderer.ts:131-133`) |
| `fallback` | rain `{tint:'#e7a1bf',depth:.085}`, snow and coast `{tint:'#ffbe76',depth:.13}`, meadow none (`session-effects.ts:31,34`; the meadow's `.15` never ran) |
| `light` | rain, snow, coast: `arc({...})` from `evenings` in `scene-light.ts:8-31`; meadow: `t=>{const l=meadowLightAt(t);return {...l,foreground:l.clearing};}` |
| `regions` | the per-scene `near`/`sky` branches in `scene-light.ts:57-70`, returning `[sky,Math.max(0,1-near-sky),near]` |
| `environment.events` | `createSession`'s per-mood list (`session.ts:66-69`): rain `shower` slot 5 for 280 s and `windows` slot 12 for 120 s; meadow `butterflies` 1 and 4 (65 s), `birds` 6 (38 s); snow `train` 8 (110 s, `beats:96`), `windows` 13 (100 s); coast `birds` 2 (38 s), `boat` 7 (150 s), `birds` 14 (35 s) |
| `environment.weather` | `sessionAt` (`session.ts:99-100`): rain `.88+.38*Math.sin(Math.PI*p)-.28*dusk+.36*shower` where `shower` is the `shower` event's strength or 0; snow `.7+.62*smooth(p/.7)`; meadow and coast `.82+.16*Math.sin(Math.PI*p)-.15*dusk` |
| `draw` | rain `[windows(rainSpots,rainFixtures)]`; meadow `[lantern,fireflies,during('butterflies',butterflies),during('birds',birds('#435146'))]`; snow `[windows(snowSpots,snowFixtures),during('train',train)]`; coast `[during('boat',boat),during('birds',birds('#343348'))]` |
| `ambience` | trim from `ambienceTrim` (`sound.ts:7`); texture from the per-mood expression in `startAmbience` (`sound.ts:171`), as `(white,brown,soft,phase)=>…` |
| `music` | `{style:'lofi',salt:n,titles:words[mood],tempo}` with salt rain 1, meadow 2, snow 3, coast 4 (`composer/index.ts:28`), titles from `composer/index.ts:18-23`, tempo snow 69, meadow 76, rain and coast 72 (`plan.ts:27`) |

`train`, `carriage`, `rail` move to `snow.ts`; `boat` to `coast.ts`; `butterflies`, `fireflies`, `meadowLantern` (renamed `lantern`) to `meadow.ts`. Each keeps its body; `meadowLightAt(state.elapsed)` calls stay.

- [ ] **Step 4: Make `session-effects.ts` generic.** Export `polygon` and `glow`. Replace `evening(ctx,scene,…)` with `evening(ctx,fallback,…)` reading `fallback.tint` and `fallback.depth`. Replace `windows(ctx,scene,…)` with a factory, and add `birds` and `during`:

```ts
export function windows(spots:readonly Point[],fixtures:readonly Point[]):Layer {
  return Object.assign((ctx:CanvasRenderingContext2D,{state,space,light}:LayerInput)=>{
    let event=0;
    for(let i=0;i<Math.min(6,state.events.length);i++)if(state.events[i].kind==='windows')event=Math.max(event,state.events[i].strength);
    const amount=light.lamps*.32+clamp(event)*.22;
    if(amount<=0)return;
    // body of today's windows() from ctx.save() to ctx.restore(), using spots and fixtures and light.lamps
  },{kind:'windows'});
}
export const birds=(colour:string)=>(ctx:CanvasRenderingContext2D,event:ActiveEvent,{time,space}:LayerInput)=>{/* today's birds() body with strokeStyle=colour */};
/** Draws one event kind; keeps today's bound of six simultaneous events. */
export function during(kind:string,draw:(ctx:CanvasRenderingContext2D,event:ActiveEvent,input:LayerInput)=>void):Layer {
  return Object.assign((ctx:CanvasRenderingContext2D,input:LayerInput)=>{
    for(let i=0;i<Math.min(6,input.state.events.length);i++)if(input.state.events[i].kind===kind)draw(ctx,input.state.events[i],input);
  },{kind});
}
export function drawSessionEffects(ctx:CanvasRenderingContext2D,place:Place,state:SessionState,time:number,space:Space,authoredLight:boolean,light:LightState,motion:boolean,seed:number):void {
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(!authoredLight&&place.fallback)evening(ctx,place.fallback,state,space);
  for(const layer of place.draw)layer(ctx,{state,time,space,light,motion,seed});
  ctx.restore();
}
```

The two comment lines above are instructions to paste today's code unchanged, not code to leave in. Today's single event loop draws kinds in event order; per-kind layers draw in layer order, which is identical because no plan overlaps two drawn events.

- [ ] **Step 5: Point the renderer at the place.** In `renderer.ts`, `const place=placeById(scene)` inside `draw`, `water`, `lights`, `steam`, `birds`, `layout`, `waterPath`, `ripple`, `load`, `loadEvening`. Replace each branch:
  - water block: `if(place.water)`, `start=place.water.from??.6`, shimmer factor `place.water.shimmer??1`;
  - cloud grade: `if(!this.sceneLight&&place.fallback)`;
  - `if(place.effect==='rain')this.rain(…)`, `snow`, `pollen` (today's `meadow()`);
  - idle birds: `if(!this.journey&&place.birds)this.birds(time,place.birds)`;
  - steam: `if(place.steam)this.steam(time,place.steam)`;
  - lamps: `for(const [u,v] of place.lamps)`, size `this.iw*.033`;
  - ripple colour: `place.water.tint??\`rgb(…)\``; rain rings: `if(place.effect==='rain')`;
  - effects call: `drawSessionEffects(ctx,place,this.journey,time,space,!!this.sceneLight,sceneLightAt(scene,this.journey.elapsed),this.motion,this.edition.seed)`.

- [ ] **Step 6: Point lighting, editions and sessions at the place.**
  - `scene-light.ts`: `sceneLightAt(scene,seconds)` clamps `t` as today, then `return placeById(scene).light(t)`. `sceneLightWeights` keeps its water test on `place.water?.outline??[]`, then `const [sky,distance,near]=place.regions(u,v);return [sky,distance,near,0];`.
  - `edition.ts`: `SCENE_IDS=PLACES.map(p=>p.id)`, `SceneId=PlaceId`, `SCENES=Object.fromEntries(PLACES.map(p=>[p.id,p]))`, `Scene=Place`. Daily choice: `DAILY_PLACES[((ordinal%DAILY_PLACES.length)+DAILY_PLACES.length)%DAILY_PLACES.length]`; `light: placeById(place).lights[Math.floor(rng()*3)]`.
  - `session.ts`: events from `place.environment.events.map(({kind,slot,duration,beats})=>({kind,start:slots[slot].start+(beats!==undefined?beats*60/slots[slot].arrangement.bpm:35)+random()*(beats!==undefined?5:25),duration}))`, drawn after the slots from the same `random`. `sessionAt` computes `weather` with `place.environment.weather({progress,dusk,events})`. Remove `caption` from `SessionState` and the `captions` table. `EventKind` becomes `string`.
  - `main.ts`: build the place list from `PLACES`; set `scene-subtitle` from `sceneLightAt(current.scene,0).subtitle` in `updateEdition`.

- [ ] **Step 7: Loop the tests and scripts over the registry.**
  - `tests/edition.test.ts`: import `DAILY_PLACES`; the rotation test expects `DAILY_PLACES.length` scenes; add `expect(DAILY_PLACES).toEqual(['rain','meadow','snow','coast'])`.
  - `tests/session.test.ts`: replace the literal mood lists with `SCENE_IDS` where the check is general (the hour, continuity, after hours).
  - `scripts/verify-scenes.mjs` and `scripts/verify-sessions.mjs`: read the list in the page with `await page.evaluate(async()=>(await import('/src/places/index.ts')).PLACES.map(p=>({id:p.id,evening:p.eveningImage.split('/').pop(),kinds:p.draw.map(l=>l.kind).filter(k=>k&&k!=='windows')})))`, loop scenes over it, derive `eveningFiles` from it, capture the midpoint of each place's first drawn kind (today: train, boat, butterflies), and replace `<=4` image bounds with `<=places.length`.

- [ ] **Step 8: Verify.** `npm test` (the fingerprint passes unchanged) and `npm run build`. With the dev server running, `node scripts/verify-scenes.mjs` and `node scripts/verify-sessions.mjs` pass, then:

```bash
for p in rain meadow snow coast; do for v in desktop mobile; do cmp captures-baseline/scenes/$p-$v.png captures-scenes/$p-$v.png || echo "DIFF $p-$v"; done; done
```

Expected: no `DIFF` lines.

### Task 3: Music styles, with lofi behind the interface (Commit 1)

**Files:**
- Create: `src/music/styles/index.ts`, `src/music/styles/lofi/index.ts`, `src/music/styles/lofi/sound.ts`
- Modify: `src/music/sound.ts`, `src/music/audio.ts`, `src/session/session.ts`, `src/music/composer/index.ts`, `src/music/composer/plan.ts`, `src/music/composer/perform.ts`, `src/music/composer/types.ts`, `src/music/composer/harmony.ts` (type only), `src/main.ts`
- Modify tests: `tests/session.test.ts`, `tests/music.test.ts`
- Modify scripts: `scripts/verify-mix.mjs`, `scripts/verify-music.mjs`
- Modify docs: `README.md` (Adding a place, Adding a music style)

**Interfaces:**
- Consumes: `Place`, `placeById`, `PLACES`, `DRAFTS` (Task 2).
- Produces (from `src/music/styles/index.ts`):

```ts
export interface Slot {index:number;start:number;duration:number;chapter:string;arrangement:{bpm:number}}
export interface SoundBank {schedule(event:ScoreEvent,time:number,secondsPerBeat:number,track:Track):void;setMode(mode:MusicMode):void;stop(at:number,from:number):void}
export interface MusicStyle {
  id:string;lookahead:number;
  limits:{bpm:readonly [number,number];grid:2|4;perBar:number;meanPerBar:number;perTrack:number};
  planHour(random:()=>number,place:Place):Slot[];
  compose(seed:number,place:Place,slot:Slot,index:number):Track;
  labels:{drums:string;preparing:string;voice(track:Pick<Track,'voice'|'darkness'>):string};
  bank(graph:SoundGraph,signal?:AbortSignal):Promise<SoundBank>;
}
export const STYLES={lofi} satisfies Record<string,MusicStyle>;
export type StyleId=keyof typeof STYLES;
export const styleOf=(style:string|undefined):MusicStyle=>(STYLES as Record<string,MusicStyle>)[style??'lofi']??STYLES.lofi;
```

- Produces (from `src/music/sound.ts`): `createGraph(context,seed):SoundGraph` (shared nodes only, plus `banks:Map<string,SoundBank>`), `prepareBanks(graph,styles:readonly MusicStyle[],signal?):Promise<void>`, `schedule(graph,event,time,secondsPerBeat,track)`, `setSoundMode(graph,mode)` (every bank), `stopVoices(graph,at,fade,from)` (voices, then every bank's `stop`), `startAmbience(graph,place,at)`, `trackVoice` (now exported), `holdParameter`, `disposeGraph`, `DEFAULT_MIX`. `SoundGraph` keeps `context, output, music, ambience, reverb (ConvolverNode input), voices, ambienceSources, nodes, seed, banks`.
- Produces (types): `Track` gains `style?: string` and `darkness?: number`; `Track.voice` and `Track.form` become `string`; `Track.harmony` becomes `TrackChord[][]` with `interface TrackChord {root:number;quality:string;notes:number[];beat:number}`; `ScoreEvent` gains `legato?: boolean`; `Instrument` adds `'pad'|'arp'|'lead'|'stab'|'clap'|'tom'|'open'|'crash'`; `Mood` becomes `export type {PlaceId as Mood} from '../../places'`. `chordAt` becomes generic `<C extends {beat:number}>(harmony:C[][],beat:number,anticipate?:boolean):C` with the same body.
- Produces (`performer`): options gain `tight?: boolean` and `voice` becomes optional (default `'upright'`).

- [ ] **Step 1: Add `tight` to `performer`** (`composer/perform.ts`). The lofi path is untouched; only tight mode draws an extra random number:

```ts
const performed=options.tight
  ? beat+(instrument==='hat'||instrument==='open'?(random()-.5)*.008:0)+roll
  : beat+(eighth%2?swing:0)+pocket+phraseDrift+backbeat+roll;
```

- [ ] **Step 2: Take lofi's per-place tables from the place.** `composeTrack(seed,mood,index,arrangement)` keeps its signature and reads `const music=placeById(mood).music`: `music.salt` replaces `['rain','meadow','snow','coast'].indexOf(mood)+1`, `music.titles` replaces `words[mood]`, and `standaloneArrangement(random,music.tempo)` replaces the mood tempo branch in `plan.ts:27` (`bpm:tempo+Math.floor(random()*10)`). Delete the `words` table.

- [ ] **Step 3: Write `styles/lofi/index.ts`.** Move from `session.ts`: `chapters`, `voices`, `tempos`, `energy`, `keySteps`, `FORM_SEQUENCES`, `compsFor`, `grooves`, `pick`, and the slot-building body of `createSession` (from `const tonic=…` to the `slots` map) into `planHour(random,place)`, adding each slot's `chapter`. Move the after-hours arrangement from `composeSessionTrack` into `compose(seed,place,slot,index)`, which returns `{...composeTrack(seed,place.id,index,arrangement),style:'lofi'}`. Set `id:'lofi'`, `lookahead:6`, `limits:{bpm:[68,88],grid:2,perBar:34,meanPerBar:19,perTrack:2600}`, and `labels:{drums:'Warm lofi beats',preparing:'Preparing the piano…',voice:t=>({upright:'Upright piano',felt:'Felt piano',electric:'Electric keys',vibes:'Soft mallets'} as Record<string,string>)[t.voice]??'Upright piano'}`. `session.ts` re-exports `FORM_SEQUENCES` so tests keep their import.

- [ ] **Step 4: Write `styles/lofi/sound.ts`.** Move from `sound.ts`: `sampleNotes`, `loadPiano`, `noiseBuffer`, the piano, melody and highpass filters, echo delay and gain, bass and drum gains, drum buffers, the body of `scheduleNote`, and the body of `setSoundMode`. The bank connects `pianoHP` to `graph.music` and to `graph.reverb`, and `bass` and `drums` to `graph.music`. Its `stop(at,from)` is today's echo reset: `delay.delayTime.cancelScheduledValues(Math.max(at,from));echoBeat=0;`. Decoded pianos are memoised per sample rate and evicted on failure, so `verify-mix` does not refetch:

```ts
const pianos=new Map<number,Promise<PianoBank>>();
const piano=(context:BaseAudioContext,signal?:AbortSignal)=>{
  const rate=context.sampleRate,known=pianos.get(rate);if(known)return known;
  const loading=loadPiano(context,signal).catch(error=>{pianos.delete(rate);throw error;});
  pianos.set(rate,loading);return loading;
};
```

- [ ] **Step 5: Slim `sound.ts` to the shared graph.** `createGraph(context,seed)` keeps output, compressor, ceiling, music, ambience, the convolver (`impulse(context,seed)`) and its `wet` gain (0.20) into `music`, and `banks:new Map()`. Add:

```ts
export async function prepareBanks(graph:SoundGraph,styles:readonly MusicStyle[],signal?:AbortSignal):Promise<void> {
  for(const style of styles)if(!graph.banks.has(style.id))graph.banks.set(style.id,await style.bank(graph,signal));
}
export function schedule(graph:SoundGraph,event:ScoreEvent,time:number,secondsPerBeat:number,track:Track):void {
  graph.banks.get(track.style??'lofi')?.schedule(event,time,secondsPerBeat,track);
}
```

`startAmbience(graph,place,at)` uses `place.ambience.texture` and `place.ambience.trim`, and seeds from `graph.seed^place.id.charCodeAt(0)` as today. `import type {MusicStyle}` only; `sound.ts` never imports `styles/` at runtime.

- [ ] **Step 6: Schedule each segment to its own style's horizon** (`audio.ts:180-208`):

```ts
const lookahead=(track:PlaybackTrack)=>styleOf(track.style).lookahead;
// …
let segment=this.segments[this.segments.length-1];
if(!segment)return;
const end=segment.start+segment.track.bars*4*60/segment.track.bpm;
if(end<now+lookahead(segment.track)) {
  const next=this.makeTrack();
  segment=this.segment(next,Math.max(end,now+0.05),0);this.segments.push(segment);
}
for(const part of this.segments) {
  const secondsPerBeat=60/part.track.bpm,horizon=now+lookahead(part.track);
  while(part.cursor<part.track.events.length) {
    const event=part.track.events[part.cursor],at=part.start+event.beat*secondsPerBeat;
    if(at>horizon)break;
    part.cursor++;
    if(at<now-0.03)continue;
    schedule(graph,event,Math.max(now+0.005,at),secondsPerBeat,part.track);
  }
}
```

Also in `audio.ts`: `enable` creates the graph with `createGraph(context,this.seed)` then `await prepareBanks(graph,Object.values(STYLES),this.abort.signal)` inside today's try block; `startAmbience(graph,placeById(this.mood),…)`; `current` adds `label:styleOf(track.style).labels.voice(track)`; add `get labels(){return styleOf(placeById(this.mood).music.style).labels;}`; `diagnostics` adds `scheduledAhead` (the latest scheduled note time minus `currentTime`, tracked in `tick`). `renderPreview` uses `createGraph`, `prepareBanks`, `schedule(…,song)` and `startAmbience(graph,placeById(mood),0)`.

- [ ] **Step 7: Make `session.ts` style-driven.** `createSession(seed,mood)` resolves `place=placeById(mood)` and `style=styleOf(place.music.style)`, draws `slots=style.planHour(random,place)` from `randomSource(seed^0x527a91)`, then the events (Task 2). `composeSessionTrack(plan,index)` calls `style.compose(plan.seed,place,slot,safeIndex)` and sets `track.session` as today.

- [ ] **Step 8: Labels in `main.ts`.** Replace the voice map with `track.label` in both the `track-detail` text and its `title` attribute (`main.ts:126-127`), `'Preparing the piano…'` with `audio.labels.preparing`, and in `updateEdition` set `$<HTMLSelectElement>('music-mode').options[0].text=audio.labels.drums`.

- [ ] **Step 9: Tests read style limits.** In `tests/session.test.ts`, the general checks loop `const ids=[...PLACES,...DRAFTS].map(p=>p.id)`. The groove test becomes general: for each id, `const style=styleOf(placeById(mood).music.style)`; bpm within `style.limits.bpm`; events per track below `style.limits.perTrack`; the grid check uses `const n=Math.round(event.beat*g),grid=n/g+(n%2?track.swing:0)` with `g=style.limits.grid`. Keep the voices-count, form-sequence and loop-assignment checks for lofi places only (`filter(id=>placeById(id).music.style==='lofi')`). `scripts/verify-mix.mjs` and `scripts/verify-music.mjs` switch to `createGraph`, `prepareBanks`, `schedule` and `startAmbience(graph,placeById(mood),0)`, and loop places from `[...PLACES,...DRAFTS]`.

- [ ] **Step 10: README guide.** Under "Code", add "Adding a place" (create `src/places/<id>.ts` exporting a `Place`, add it to `PLACES`, never to `DAILY_PLACES`; make the two paintings by generating a sunset or arrival painting and then a composition-matched lighting edit at 1672×941, with sidecars and an `ARTWORK.md` section; trace the water outline, lamps and windows; `npm test` and the browser scripts then check it) and "Adding a music style" (implement `MusicStyle` in `src/music/styles/<id>/`, register it in `STYLES`, declare `limits`). Update the module table with `src/places/` and `src/music/styles/`.

- [ ] **Step 11: Verify and commit.**
  - `npm test` (the fingerprint passes unchanged) and `npm run build`.
  - Scripts pass: `verify-scenes`, `verify-sessions`, `verify-music`, `verify-mix`.
  - The PCM matches: render the four previews to `captures-after/` as in Task 1, then compare:

```bash
node -e 'const fs=require("fs");for(const p of ["rain","meadow","snow","coast"]){const a=fs.readFileSync(`captures-baseline/${p}.wav`),b=fs.readFileSync(`captures-after/${p}.wav`);let m=0;for(let i=44;i<a.length;i+=2)m=Math.max(m,Math.abs(a.readInt16LE(i)-b.readInt16LE(i)));console.log(p,a.length===b.length,m);if(a.length!==b.length||m>4)process.exitCode=1;}'
```

  Expected: every line `true` with a max difference ≤ 4 (1e-4 of full scale). The Task 2 capture `cmp` loop still passes.
  - Commit:

```bash
git add -A src tests scripts README.md
git commit -m "refactor: make places and music styles pluggable" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Commit 2: Synthwave music

### Task 4: Synthwave library and songs

**Files:**
- Create: `src/music/styles/synthwave/library.ts`, `src/music/styles/synthwave/song.ts`
- Test: `tests/session.test.ts` (new `describe('synthwave songs')`)

**Interfaces:**
- Consumes: `performer`, `randomSource`, `chooser`, `partSeed`, `chordAt`, `makeContour` from `src/music/composer`.
- Produces (`library.ts`): `SynthQuality`, `SynthChord`, `SynthLoop`, `SYNTH_LOOPS`, `SynthForm`, `SYNTH_FORMS`, `BassPattern`, `BASS`, `ArpCell`, `ARPS`, `LEAD_CELLS`, `INTERVALS`.
- Produces (`song.ts`): `interface SynthArrangement {bpm:number;tonic:number;darkness:number;energy:number;form:SynthForm;loop:string;arp:ArpCell;groove:BassPattern;hook:Theme;lift:boolean}`, `makeHook(random):Theme`, `composeSynthSong(a:SynthArrangement,songSeed:number,title:string):Track` returning `style:'synthwave'`, `darkness`, `voice: darkness<.6?'analog':'dark'`, `swing:0`.

- [ ] **Step 1: Write the failing tests** in `tests/session.test.ts`:

```ts
import {composeSynthSong,makeHook} from '../src/music/styles/synthwave/song';
import {SYNTH_FORMS} from '../src/music/styles/synthwave/library';
import {randomSource} from '../src/music/composer';

const synthSong=(form:string,darkness:number,seed:number)=>composeSynthSong({bpm:120,tonic:9,darkness,energy:.9,form:form as never,
  loop:darkness<.5?'horizon':'chrome',arp:'up16',groove:'sixteenths',hook:makeHook(randomSource(seed)),lift:false},seed,'Test');
describe('synthwave songs',()=>{
  it('fills every form with a straight, bounded, playable score',()=>{
    for(const form of Object.keys(SYNTH_FORMS))for(const darkness of [0,.5,1])for(let seed=0;seed<6;seed++){
      const t=synthSong(form,darkness,seed),perBar=new Array(t.bars).fill(0),bass=t.events.filter(e=>e.instrument==='bass');
      for(const e of t.events){
        perBar[Math.min(t.bars-1,Math.floor(e.beat/4))]++;
        expect(Number.isFinite(e.beat+e.duration+e.velocity+e.note)).toBe(true);
        expect(e.duration).toBeGreaterThan(0);expect(e.velocity).toBeGreaterThan(0);expect(e.velocity).toBeLessThanOrEqual(1);
        if(e.instrument!=='hat'&&e.instrument!=='open')expect(Math.abs(e.beat-Math.round(e.beat*4)/4)).toBeLessThan(.001);
        if(e.instrument==='kick')expect(bass.some(b=>Math.abs(b.beat-e.beat)<.015)).toBe(true);
      }
      expect(Math.max(...perBar)).toBeLessThanOrEqual(64);
      expect(t.events.length/t.bars).toBeLessThanOrEqual(44);
      expect(t.events.length).toBeLessThan(6000);
      expect(t.sections.at(-1)!.endBar).toBe(t.bars);
    }
  });
  it('drops the drums in breaks and states the hook on chord tones',()=>{
    const t=synthSong('drive',.3,4);
    for(const s of t.sections.filter(s=>s.role==='break'))
      expect(t.events.some(e=>['kick','snare','clap','hat','open','tom'].includes(e.instrument)&&e.beat>=s.startBar*4&&e.beat<s.endBar*4)).toBe(false);
    for(const e of t.events.filter(e=>e.instrument==='lead')){
      const within=e.beat%4,chord=chordAt(t.harmony,e.beat,false);
      if(within===0||within===2||e.duration>=1)expect(chord.notes.map(n=>n%12)).toContain(e.note%12);
    }
  });
});
```

(Import `chordAt` from `../src/music/composer/harmony`.)

- [ ] **Step 2:** Run `npx vitest run tests/session.test.ts -t "synthwave songs"`. Expected: FAIL (module not found).

- [ ] **Step 3: Write `library.ts`** with this data. Degrees are semitones above the minor tonic; `slow` loops hold each chord two bars; `pedal` loops keep the bass on the tonic.

```ts
export type SynthQuality='min'|'maj'|'sus2'|'madd9'|'add9'|'five';
export const INTERVALS:Record<SynthQuality,number[]>={min:[0,3,7],maj:[0,4,7],sus2:[0,2,7],madd9:[0,3,7,14],add9:[0,4,7,14],five:[0,7,12]};
export interface SynthChord {degree:number;quality:SynthQuality}
export interface SynthLoop {id:string;bars:readonly SynthChord[];darkness:readonly [number,number];slow?:boolean;pedal?:boolean}
const L=(id:string,darkness:[number,number],chords:[number,SynthQuality][],flags:{slow?:boolean;pedal?:boolean}={}):SynthLoop=>
  ({id,darkness,bars:chords.map(([degree,quality])=>({degree,quality})),...flags});
export const SYNTH_LOOPS:readonly SynthLoop[]=[
  L('horizon',[0,.5],[[0,'madd9'],[8,'maj'],[10,'maj'],[0,'min']]),
  L('coastline',[0,.6],[[0,'min'],[8,'add9'],[10,'maj'],[7,'min']]),
  L('overpass',[0,.5],[[8,'maj'],[10,'maj'],[0,'min'],[3,'maj']]),
  L('afterglow',[0,.7],[[0,'min'],[10,'maj'],[8,'maj'],[5,'min']]),
  L('uplift',[0,.4],[[8,'add9'],[10,'sus2'],[0,'madd9'],[0,'min']]),
  L('dorian',[.1,.6],[[0,'min'],[5,'maj'],[0,'min'],[5,'maj']]),
  L('chrome',[.4,1],[[8,'maj'],[5,'maj'],[0,'min'],[0,'min']]),
  L('riser',[.4,1],[[3,'maj'],[5,'maj'],[0,'min'],[0,'five']]),
  L('tunnel',[.5,1],[[5,'maj'],[3,'maj'],[0,'min'],[7,'maj']]),
  L('undertow',[.5,1],[[0,'five'],[8,'maj'],[10,'maj'],[8,'maj']],{pedal:true}),
  L('descent',[.6,1],[[0,'five'],[10,'five'],[8,'five'],[7,'maj']]),
  L('longroad',[.6,1],[[0,'five'],[8,'five'],[3,'five'],[10,'five']],{slow:true}),
];
export type SynthRole='intro'|'verse'|'build'|'chorus'|'break'|'outro';
export type SynthForm='cruise'|'drive'|'descent'|'slowburn';
const S=(...parts:[SynthRole,number][])=>parts;
export const SYNTH_FORMS:Record<SynthForm,readonly [SynthRole,number][]>={
  cruise:S(['intro',8],['verse',16],['build',8],['chorus',16],['break',8],['chorus',16],['outro',16]),
  drive:S(['intro',8],['verse',16],['build',8],['chorus',16],['break',8],['verse',16],['build',8],['chorus',16],['outro',16]),
  descent:S(['intro',16],['build',16],['chorus',32],['break',16],['chorus',32],['outro',16]),
  slowburn:S(['intro',8],['verse',16],['chorus',16],['break',8],['chorus',8],['outro',8]),
};
export type BassPattern='sixteenths'|'octaves'|'gallop'|'pulse';
/** Onsets within a bar, and whether the note is the octave above. */
export const BASS:Record<BassPattern,readonly [at:number,octave:boolean][]>={
  sixteenths:Array.from({length:16},(_,i)=>[i/4,false] as [number,boolean]),
  octaves:Array.from({length:8},(_,i)=>[i/2,i%2===1] as [number,boolean]),
  gallop:[0,1,2,3].flatMap(b=>[[b,false],[b+.5,false],[b+.75,false]] as [number,boolean][]),
  pulse:[[0,false],[1,false],[2,false],[3,false]],
};
export type ArpCell='eighth'|'up16'|'updown16'|'octave16'|'broken16';
/** Chord-tone indices per step; 'eighth' steps every half beat, the rest every quarter beat. */
export const ARPS:Record<ArpCell,readonly number[]>={
  eighth:[0,1,2,3,4,3,2,1],
  up16:[0,1,2,3,0,1,2,3,0,1,2,3,0,1,2,3],
  updown16:[0,1,2,3,4,3,2,1,0,1,2,3,4,3,2,1],
  octave16:[0,3,1,4,2,5,1,4,0,3,1,4,2,5,1,4],
  broken16:[0,2,1,3,2,4,3,5,0,2,1,3,2,4,3,5],
};
/** Two-bar straight lead rhythms: [beat, duration]. Each leaves air and ends on a held note. */
export const LEAD_CELLS:readonly (readonly [number,number][])[]=[
  [[0,1.5],[1.5,.5],[2,1],[3,1],[4,3]],
  [[0,.5],[.5,.5],[1,.5],[1.5,1.5],[4,.5],[4.5,.5],[5,2]],
  [[.5,.5],[1,1],[2,.5],[2.5,1.5],[4.5,.5],[5,.5],[5.5,.5],[6,1.5]],
  [[0,.75],[.75,.75],[1.5,2.5],[4,.75],[4.75,.75],[5.5,2]],
  [[0,2],[2,.5],[2.5,.5],[3,1],[4,.5],[4.5,.5],[5,.5],[5.5,.5],[6,1.5]],
  [[1,.5],[1.5,.5],[2,1],[3,.75],[3.75,1.25],[6,1.5]],
];
```

- [ ] **Step 4: Write `song.ts`.** `makeHook(random)` returns `{cell:Math.floor(random()*LEAD_CELLS.length),contour:makeContour(random),degree:random()<.5?2:4}`. `composeSynthSong` does the following:
  - **Sections and harmony.** Sections come from `SYNTH_FORMS[a.form]` with running `startBar`. Harmony is one chord per bar from the loop (a `slow` loop holds each chord two bars), giving `{root:48+(a.tonic+degree)%12,quality,notes,beat:0}`. When `a.lift` is set, the final `chorus` turns `min`/`madd9` on degree 0 into `maj`/`add9` and degree 7 into `maj`.
  - **Voicing.** `harmony[bar][0].notes` is the loop chord voice-led in 52–76: try every rotation and octave of `INTERVALS[quality]` above the root and keep the least total motion from the previous voicing (start `[57,60,64]`). The pad plays those notes, except that above darkness 0.6 it plays only the root, fifth and octave. The lead and arp always use the loop chord's own tones, so darkness never changes a melody.
  - **Performers.** One `performer({swing:0,songSeed,random:randomSource(partSeed(songSeed,tag)),bars,tight:true})` per part tag: `pad`, `bass`, `drums`, `arp`, `lead`.
  - **Level.** Every part's velocity is multiplied by the role level (`intro .7, verse .85, build .8→1 across the section, chorus 1, break .65, outro .8→.55`) times `a.energy`.
  - **Layers by role:**

| Role | Pad | Bass | Drums | Arp | Lead | Stab and crash |
| --- | --- | --- | --- | --- | --- | --- |
| intro | yes; `descent` holds a tonic `five` | `descent` only: the pattern at velocity .35 | none | yes, except `descent` | none | none |
| verse | yes | pattern | full | none | low statement | stab at the start if darkness ≥ .75 |
| build | yes | pattern | kick and hats; snare eighths in the last two bars; tom fill in the last bar | yes | first bar of the hook at +4 bars | none |
| chorus | yes | pattern | full | yes | high statement | crash and (darkness ≥ .75) stab on each 8-bar downbeat |
| break | yes | `pulse` at velocity .5 | none | yes | none | none |
| outro | yes; the last bar holds the tonic | none for `cruise`; otherwise the pattern for 8 bars | none for `cruise`; otherwise kick and hats for 8 bars | yes | none | none |

  - **Bass.** Notes are `28+((root%12)-4+12)%12`, plus 12 for octave steps. A `pedal` loop uses the tonic, otherwise the chord root. Duration is the gap to the next onset minus 0.05. `slowburn` always uses `pulse`.
  - **Drums** (per bar):
    - kick on `[0,2]` below darkness 0.45 (plus 3.75 only when the bass has an onset there), `[0,1,2,3]` from 0.45;
    - snare on 1 and 3 (clap as well from darkness 0.45);
    - hats every quarter beat, or every half beat when both the bass (`sixteenths` or `gallop`) and the arp (any cell but `eighth`) already run sixteenths, with accents 0.9 on beats, 0.6 on eighths and 0.45 on sixteenths, and the hat at 3.5 replaced by `open`;
    - `slowburn` uses kick `[0,2]`, snare on 1 and 3, and no hats;
    - in the last bar of every 8-bar phrase of a verse or chorus, toms on 3, 3.25, 3.5 and 3.75 (notes 50, 47, 45, 43) replace hats from beat 3.
  - **Arp.** Tones of `harmony[bar][0].notes`, extended by octaves up to 88, stepping every 0.5 beat for `eighth` and 0.25 otherwise. Duration equals the step, velocity 0.35.
  - **Lead.** For each placement bar `b`:
    - cell `LEAD_CELLS[hook.cell]`, contour `hook.contour`;
    - target pitch from the aeolian scale around anchor degree `hook.degree`, in 60–74 for verses and 67–84 for choruses;
    - notes on beat 0 or 2 of a bar, or lasting at least a beat, snap to the nearest pitch class of `harmony[bar][0].notes` (the loop chord, never the thinned pad);
    - other notes snap to the nearest aeolian pitch class, and a non-chord note must step (≤ 2 semitones) to a chord-tone neighbour, otherwise it becomes a chord tone;
    - notes held over another lead note set `legato:true`.

    Placements per 8-bar phrase: hook at +0, hook shifted +1 at +2, hook at +4, and the first bar of the hook with its last note held at +6. Verses play the low statement at velocity 0.7, choruses the high one at 0.95.
  - **Title and key.** `key` as in lofi with an `m` suffix (a lifted final chorus keeps the key name).

- [ ] **Step 5:** Run `npx vitest run tests/session.test.ts -t "synthwave songs"`. Expected: PASS. Then `npm test` and `npm run build`.

### Task 5: Synthwave sound bank

**Files:**
- Create: `src/music/styles/synthwave/sound.ts`
- Test: verified audibly in Task 6 (Steps 6 to 8), once the style is registered; this task ends at a clean build

**Interfaces:**
- Consumes: `SoundGraph`, `trackVoice`, `holdParameter` (`src/music/sound.ts`); `Track`, `ScoreEvent` (composer types).
- Produces: `synthBank(graph:SoundGraph):Promise<SoundBank>` with extra read-only `pump:GainNode` (for diagnostics).

- [ ] **Step 1: Build the shared nodes on first use.** Create them when the first note is scheduled, so none run for lofi listeners:
  - `bus` gain (trim 0.5, calibrated in Task 6) into `graph.music`;
  - `pump` gain into `bus`;
  - a drums gain into `bus`;
  - a stereo chorus for the pad: two `DelayNode`s at 12 ms and 17 ms, each modulated by its own sine LFO (0.31 Hz and 0.37 Hz, depth 0.002 s) through a gain, panned −0.6 and 0.6, into `pump`;
  - the echo: `DelayNode` max 1 s, feedback gain 0.28 through a lowpass at 2,400 Hz, into `bus`;
  - a `reverbSend` gain of 0.5 into `graph.reverb`;
  - WaveShapers `soft` (`oversample:'none'`) and `heavy` (`'2x'`), both into `pump`;
  - one lead vibrato LFO (5.2 Hz, depth 6 cents).

  Curves:

```ts
const curve=(drive:number)=>Float32Array.from({length:1024},(_,i)=>{const x=i/511.5-1;return Math.tanh(x*drive)/Math.tanh(drive);});
// soft: curve(1.8); heavy: curve(5)
```

Verified via context7 (W3C Web Audio spec): `createPeriodicWave` needs `real` and `imag` of equal length (9 and 9 here); `createDelay()` defaults to a 1 s maximum, above the slowest dotted eighth (0.51 s at 88 BPM); WaveShaper `oversample` takes `'none'`, `'2x'` or `'4x'`; exponential ramps reject 0.

- [ ] **Step 2: Voice each instrument** with `trackVoice(graph,source,gain,nodes,start,end)` so `stopVoices` fades it. Let `v=event.velocity`, `f=440*2**((note-69)/12)`, `d=event.duration*secondsPerBeat` and `k=track.darkness??0`.

| Instrument | Sources | Filter | Envelope (gain) | Route |
| --- | --- | --- | --- | --- |
| `pad` | saws at detune −9 and +9 cents | lowpass `1200+2400*(1-k)` Hz, Q .5 | 0 → `.05*v` over .35 s, hold to `d`, `exponentialRamp` to .0001 over .9 s | chorus and `reverbSend` .35 |
| `bass` | saws at `f` and `2f` (second at gain .5) | lowpass from `220+1600*v` to 180 Hz over .25 s | 0 → `.32*v` in 5 ms, hold to `d`, ramp to .0001 over .06 s | `k<.35`: `pump`; `k<.7`: `soft`; else `heavy` |
| `arp` | saw | lowpass from 3,200 to 900 Hz over .18 s, Q 4 | 0 → `.12*v` in 3 ms, ramp to .0001 over `max(.12,d*1.6)` | `pump` and echo send .28 |
| `lead` | saw plus square (+5 cents, gain .6); on `legato`, frequency glides from the previous lead note over .06 s | lowpass 2,600 Hz (1,400 below MIDI 72) | 0 → `.1*v` over .02 s, hold to `d`, ramp to .0001 over .25 s | `bus`, echo send .3, `reverbSend` .25; vibrato into `detune` |
| `stab` | one oscillator with `context.createPeriodicWave(new Float32Array(9),Float32Array.from([0,1,.6,.45,.35,0,.2,0,.15]))`, built once | none | 0 → `.08*v` in 4 ms, ramp to .0001 over .6 s | `bus` and `reverbSend` .4 |
| `kick` | sine from 150 Hz to 45 Hz over `.08*(1+k)` s, plus a 5 ms noise click | click highpass 2 kHz | 0 → `.9*v` in 3 ms, ramp to .0001 over .35 s | drums |
| `snare` | noise buffer with the gated tail baked in (below) | bandpass 1,800 Hz, Q .7 | constant `.55*v` | drums |
| `clap` | noise: three 10 ms bursts 10 ms apart plus a 60 ms tail | bandpass 1,200 Hz | constant `.45*v` | drums |
| `hat` / `open` / `crash` | noise buffers of .05 s, .35 s and 1.6 s | highpass 7,000 / 6,500 / 5,000 Hz | constant `.22*v` / `.2*v` / `.18*v` | drums |
| `tom` | sine sweeping from `f` to `.6f` over .25 s | none | 0 → `.5*v` in 3 ms, ramp to .0001 over .35 s | drums |

Noise buffers are built once per bank with `randomSource(graph.seed^n)`, like today's drum buffers. The gated snare:

```ts
const gated=noise(0.32,seed^41,(t,n)=>{
  const body=(n*.7+Math.sin(2*Math.PI*190*t)*.3)*Math.exp(-t*38);
  const tail=t<.2?n*.28*(1-Math.exp(-t*400)):0; // dense reverb held flat, then cut: the gate
  return body+tail;
});
```

- [ ] **Step 3: Pumping and resets.**

```ts
schedule(event,time,secondsPerBeat,track){
  ensureNodes();
  if(event.instrument==='kick'&&mode==='beats'){
    const depth=.15+.45*(track.darkness??0);
    pump.gain.setValueAtTime(1-depth,time);pump.gain.setTargetAtTime(1,time+.01,secondsPerBeat*.18);
  }
  if(echoBeat!==secondsPerBeat){echo.delayTime.setValueAtTime(secondsPerBeat*.75,time);echoBeat=secondsPerBeat;}
  voice(event,time,secondsPerBeat,track);
},
setMode(next){mode=next;const t=graph.context.currentTime;drums.gain.setTargetAtTime(next==='ambient'?0:1,t,.12);
  holdParameter(pump.gain,t);pump.gain.linearRampToValueAtTime(1,t+.02);},
stop(at,from){holdParameter(pump.gain,at);pump.gain.linearRampToValueAtTime(1,at+.02);
  echo.delayTime.cancelScheduledValues(Math.max(at,from));echoBeat=0;
  holdParameter(echoReturn.gain,at);echoReturn.gain.linearRampToValueAtTime(0,at+.05);echoReturn.gain.linearRampToValueAtTime(1,at+.6);},
```

`ensureNodes` returns early once built; `setMode` and `stop` do nothing before the first note. In ambient mode the bass bus eases to 0.7.

- [ ] **Step 4:** `npm run build` passes (the bank type-checks against `SoundBank`). Audible checks follow in Task 6, where the style is registered: `verify-mix` (levels, headroom), `verify-music` (lifecycle) and the rendered previews.

### Task 6: Synthwave hour, style registration and mix calibration (Commit 2)

**Files:**
- Create: `src/music/styles/synthwave/index.ts`, `src/places/deck.ts`
- Modify: `src/music/styles/index.ts` (register), `src/places/index.ts` (`DRAFTS=[deck]`)
- Tests: `tests/session.test.ts`
- Scripts: `scripts/verify-mix.mjs`, `scripts/verify-music.mjs`, `scripts/render-music-preview.mjs` (no change needed; `deck` resolves through `placeById`)

**Interfaces:**
- Produces: `synthwave: MusicStyle` with `id:'synthwave'`, `lookahead:3`, `limits:{bpm:[88,150],grid:4,perBar:64,meanPerBar:44,perTrack:6000}`, `labels:{drums:'Drum machine',preparing:'Warming up the synths…',voice:t=>(t.darkness??0)<.6?'Analog synths':'Darksynth'}`, `bank:synthBank`; `SEQUENCES`, `NOMINAL`, `DARKNESS`, `ENERGY`, `CHAPTERS` exported for tests; `deck: Place` (draft) and `lightningAt(seed,elapsed,storm,motion):number` exported from `deck.ts`.

- [ ] **Step 1: Write the failing tests** in `tests/session.test.ts`:

```ts
import {SEQUENCES,NOMINAL,DARKNESS} from '../src/music/styles/synthwave';
import {lightningAt} from '../src/places/deck';

describe('the synthwave hour',()=>{
  it('plans every sequence inside its chapter bands and lands exactly on the hour',()=>{
    const bands=[[105,115],[105,115],[105,115],[118,128],[118,128],[118,128],[124,130],[88,96],[124,130],[126,134],[126,134],[126,134],[130,140],[88,96],[130,140],[130,145],[130,145],[130,145]];
    for(let seed=0;seed<200;seed++){
      const plan=createSession(seed,'deck'),a=plan.slots.map(s=>s.arrangement as never as {bpm:number;form:string;loop:string;arp:string;groove:string;darkness:number;hook:unknown});
      expect(plan.slots.reduce((sum,s)=>sum+s.duration,0)).toBeCloseTo(3600,6);
      a.forEach((x,i)=>{expect(x.bpm).toBeGreaterThanOrEqual(bands[i][0]);expect(x.bpm).toBeLessThanOrEqual(bands[i][1]);});
      a.slice(1).forEach((x,i)=>{for(const k of ['form','loop','arp','groove'] as const)expect(x[k]).not.toBe(a[i][k]);});
      expect(a[17].loop).toBe(a[0].loop);expect(a[17].hook).toEqual(a[0].hook);
    }
    for(const s of SEQUENCES)expect(s.reduce((sum,f)=>sum+({cruise:88,drive:112,descent:128,slowburn:64} as Record<string,number>)[f],0)).toBe(1880);
    expect(NOMINAL).toHaveLength(18);
  });
  it('darkens by chapter, stays dark after hours and restates the opening hook',()=>{
    const plan=createSession(20260917,'deck');
    for(let c=1;c<6;c++)expect(Math.min(...DARKNESS.slice(c*3,c*3+3))).toBeGreaterThan(Math.max(...DARKNESS.slice(c*3-3,c*3)));
    for(const i of [18,19,27,35])expect(composeSessionTrack(plan,i).darkness!).toBeGreaterThanOrEqual(.8);
    const first=(t:Track)=>{const c=t.sections.find(s=>s.role==='chorus')!;return t.events.filter(e=>e.instrument==='lead'&&e.beat>=c.startBar*4&&e.beat<c.endBar*4).map(e=>e.note);};
    expect(first(composeSessionTrack(plan,17))).toEqual(first(composeSessionTrack(plan,0)));
  });
  it('gives every synthwave song a hook that repeats',()=>{
    const plan=createSession(4242,'deck');
    for(const i of [0,5,9,13,17]){
      const lead=composeSessionTrack(plan,i).events.filter(e=>e.instrument==='lead');
      const steps=lead.slice(1).map((e,j)=>`${e.note-lead[j].note}:${Math.round((e.beat-lead[j].beat)*4)}`);
      const grams=steps.slice(3).map((_,j)=>steps.slice(j,j+4).join('|')),counts=new Map<string,number>();
      for(const g of grams)counts.set(g,(counts.get(g)??0)+1);
      expect(grams.filter(g=>counts.get(g)!>=2).length/grams.length).toBeGreaterThanOrEqual(.4);
    }
  });
  it('keeps pending notes bounded under a 3 s horizon',()=>{
    const plan=createSession(20260917,'deck');
    for(const i of [12,14,16]){
      const t=composeSessionTrack(plan,i),spb=60/t.bpm,starts=t.events.map(e=>e.beat*spb),ends=t.events.map(e=>(e.beat+e.duration)*spb+.9);
      let peak=0;for(let now=0;now<t.bars*4*spb;now+=.25)peak=Math.max(peak,starts.filter((s,j)=>s<=now+3&&ends[j]>=now).length);
      expect(peak).toBeLessThan(160);
    }
  });
  it('never flashes lightning without motion, after the hour, or too often',()=>{
    for(let t=0;t<7200;t+=.01){
      expect(lightningAt(7,t,1,false)).toBe(0);
      if(t>=3600)expect(lightningAt(7,t,1,true)).toBe(0);
      expect(lightningAt(7,t,1,true)).toBeLessThanOrEqual(.12);
    }
    for(let w=0;w<3600;w+=20){let flashes=0,was=false;for(let t=w;t<w+20;t+=.005){const on=lightningAt(7,t,1,true)>0;if(on&&!was)flashes++;was=on;}expect(flashes).toBeLessThanOrEqual(2);}
  });
});
```

The general hour checks from Task 3 already loop `[...PLACES,...DRAFTS]`, so the draft deck joins them automatically; after Task 7 it moves between the two lists without being counted twice.

- [ ] **Step 2:** Run `npx vitest run tests/session.test.ts -t "synthwave hour"`. Expected: FAIL.

- [ ] **Step 3: Write `styles/synthwave/index.ts`:**

```ts
export const CHAPTERS=['Sunset','The drive','Night falls','Neon','The storm','Midnight'];
const F:Record<string,SynthForm>={C:'cruise',D:'drive',E:'descent',S:'slowburn'};
export const SEQUENCES:SynthForm[][]=['CDCDCDESEDECESDEDC','CDCDEDCSEDEDCSEDEC','CDCDCDESDECEDSEDEC'].map(s=>[...s].map(c=>F[c]));
export const NOMINAL=[108,111,113,121,124,126,126,92,128,129,131,132,134,93,137,139,141,138];
export const DARKNESS=[0,.08,.16,.24,.3,.36,.44,.5,.56,.62,.68,.72,.78,.84,.88,.92,.96,1];
export const ENERGY=[.7,.75,.8,.85,.9,.95,.9,.6,.9,.9,.92,.95,.95,.65,.97,1,1,.95];
const KEY_STEPS=[0,0,0,5,5,0,0,7,7,0,0,5,5,0,0,7,0,0],TONICS=[9,1,3,11,5,4,10,2,0];
const SUBTITLES=['top floor','engine off','the long way round','low beams','after the rain','one more lap'];
const barsOf=(form:SynthForm)=>SYNTH_FORMS[form].reduce((sum,[,bars])=>sum+bars,0);

function planHour(random:()=>number,_place:Place):Slot[] {
  const tonic=TONICS[Math.floor(random()*TONICS.length)],sequence=SEQUENCES[Math.floor(random()*SEQUENCES.length)];
  const scale=sequence.reduce((sum,form,i)=>sum+barsOf(form)*240/NOMINAL[i],0)/3600;
  const hour=makeHook(random),loops:string[]=[],arps:ArpCell[]=[],grooves:BassPattern[]=[];
  sequence.forEach((form,i)=>{
    const open=SYNTH_LOOPS.filter(l=>DARKNESS[i]>=l.darkness[0]&&DARKNESS[i]<=l.darkness[1]&&(i!==0||l.bars[0].degree===0)).map(l=>l.id);
    const uses=(id:string)=>loops.filter(x=>x===id).length,fewest=Math.min(...open.filter(id=>id!==loops[i-1]).map(uses));
    loops.push(i===17?loops[0]:pick(random,open.filter(id=>uses(id)===fewest),[loops[i-1]]));
    arps.push(pick(random,form==='slowburn'?['eighth','up16']:['eighth','up16','updown16','octave16','broken16'],[arps[i-1]]));
    grooves.push(form==='slowburn'?'pulse':pick(random,['sixteenths','octaves','gallop'],[grooves[i-1]]));
  });
  let start=0;
  return sequence.map((form,index)=>{
    const bpm=NOMINAL[index]*scale,duration=barsOf(form)*240/bpm;
    const arrangement:SynthArrangement={bpm,tonic:(tonic+KEY_STEPS[index])%12,darkness:DARKNESS[index],energy:ENERGY[index],form,
      loop:loops[index],arp:arps[index],groove:grooves[index],hook:index===0||index===17?hour:makeHook(random),lift:index===17};
    const slot={index,start,duration,chapter:CHAPTERS[Math.floor(index/3)],arrangement};start+=duration;return slot;
  });
}
```

`pick` is the lofi helper from `styles/lofi/index.ts` (export it). The `index===0||index===17` hook draws `makeHook(random)` only for other slots, so the stream order is fixed. `compose(seed,place,slot,index)` derives `songSeed=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(place.music.salt,0x45d9f3b))>>>0` and the title `${choose(place.music.titles)} · ${choose(SUBTITLES)}` from `randomSource(songSeed)`. For `cycle=Math.floor(index/18)>0` it uses `{...slot.arrangement,darkness:Math.max(.8,arrangement.darkness),energy:arrangement.energy*.85,lift:false,hook:makeHook(randomSource(seed^Math.imul(index+1,0x2545f491)))}`. It returns `composeSynthSong(arrangement,songSeed,title)`.

- [ ] **Step 4: Write the draft `src/places/deck.ts`.** Geometry comes from the prompt's layout and is traced from the painting in Task 7. Import `randomSource` from `../music/composer/random` (the leaf module), never from `../music/composer`, whose index imports the place registry.

```ts
const storm=(progress:number)=>smooth((progress-.66)/.18);
export function lightningAt(seed:number,elapsed:number,strength:number,motion:boolean):number {
  if(!motion||elapsed>=3600||strength<=0)return 0;
  const window=Math.floor(elapsed/20),r=randomSource((seed^Math.imul(window+1,0x9e3779b1))>>>0);
  if(r()>strength*.8)return 0;
  const t=elapsed-window*20-(2+r()*14);
  return t>=0&&t<.08?.12*strength:t>=.22&&t<.3?.08*strength:0;
}
export default {
  id:'deck',name:'Top deck',title:'Park up. Stay a while.',weather:'Neon and a gathering storm',
  lights:['Sunset over the towers','Heat on the concrete','A storm on the horizon'],
  image:'/scenes/top-deck.png',eveningImage:'/scenes/top-deck-night.png',anchor:.43,color:'#1c1433',
  water:{outline:[[.30,.66],[.45,.62],[.62,.62],[.84,.66],[.84,.86],[.70,.90],[.46,.90],[.30,.84]]},
  lamps:[],effect:'rain',fallback:{tint:'#e79ab8',depth:.1},
  light:arc({timing:[[0,2400],[150,2550],[300,2700],[0,2400]],lamps:[600,1800],
    captions:['Sunset on the top deck','The towers light up','Neon on wet concrete','Storm light over the city'],
    subtitles:['Nowhere to be until morning.','Stay while the city lights up.','The engine can wait.']}),
  regions:(u,v)=>{const near=Math.max(1-smooth((u-.30)/.14),smooth((v-.68)/.18)),sky=(1-smooth((v-.24)/.12))*(1-near);return [sky,Math.max(0,1-near-sky),near];},
  environment:{events:[{kind:'headlights',slot:4,duration:24},{kind:'headlights',slot:10,duration:24}],weather:({progress})=>1.1*storm(progress)},
  draw:[windows([],[]),during('headlights',headlights),lightning],
  ambience:{trim:.2,texture:(_white,brown,soft,phase,channel)=>brown*.3+soft*.08*(.6+.4*Math.sin(phase*5+channel*.2))},
  music:{style:'synthwave',salt:5,titles:['Sodium Glow','Level Nine','Glass Towers','Ramp Down','Heat Haze','Violet Hour','Concrete Sunset','Low Fuel','Cabin Light','Rooftop Signal'],tempo:120},
} as const satisfies Place;
```

  The two drawings in the same file:
  - `headlights`: two warm-white cones (screen composite, alpha `.35*event.strength`) from a point moving along `u=.95→.55` at `v=.78` as `event.progress` goes 0→1, each cone `space.iw*.12` long and 14° wide.
  - `lightning`: `const a=lightningAt(seed,state.elapsed,clamp(state.weather/1.1),motion)`. If `a>0`, fill the top 35% of the canvas with a vertical gradient from `rgba(214,200,255,a)` to transparent, using screen composite.

  Add `deck` to `DRAFTS`. Register `synthwave` in `STYLES`.

- [ ] **Step 5:** Run `npx vitest run tests/session.test.ts`. Expected: PASS. If a band check fails after an edit, change `NOMINAL`, never the bands.

- [ ] **Step 6: Calibrate the mix.** In `scripts/verify-mix.mjs`, render `deck` like the lofi places (indices 0, 1, 3, 6, 9, 10, 17), and add a window inside the first `break` section of index 0 and the opening of index 7 (the slow burner), rendering long enough to reach them (at most 130 s). Assert:
  - atmosphere ≤ −18 dB in every window;
  - `|20*log10(deckTheme/lofiMedianTheme)| ≤ 1.5` using the theme-window RMS;
  - peak < 0.9.

  Adjust the bank's `bus` trim and the deck's `ambience.trim` until it passes, then record the values in the code.

- [ ] **Step 7: Lifecycle and Review Focus 1 and 2** in `scripts/verify-music.mjs`:
  - `new RadioAudio(20260917,'rain')`, `enable()`, `setEdition(71,'deck')`, `next()`.
  - Over 5 s: `diagnostics.voices<200`, `scheduledSegments<=2`, `scheduledAhead<=3.3`.
  - Then `setMode('ambient')` and, 100 ms later, `radio.graph` pump gain `value===1` (expose `diagnostics.pump`).
  - `pause()`: `voices===0`. `enable()`: playing again.
  - Rapid switching: `setEdition(1,'rain');next();setEdition(2,'deck');next();setEdition(3,'rain');next();` inside one second, then 3 s later voices < 200 and segments ≤ 2.

- [ ] **Step 8: Previews and listening.**

```bash
node scripts/render-music-preview.mjs 150 captures-music/deck-sunset.wav 20260917 deck 0
node scripts/render-music-preview.mjs 150 captures-music/deck-dark.wav 20260917 deck 14
node scripts/render-music-preview.mjs 150 captures-music/deck-slowburn.wav 20260917 deck 7
```

Prefix the dark render with `time` and report its wall-clock time against the 150 s of audio. Expected: `clipped: 0`, `peak < 0.9`. Ask the user to listen before Commit 2.

- [ ] **Step 9: Commit 2.** `npm test`, `npm run build`, `verify-music` and `verify-mix` pass, and the user has listened to the previews.

```bash
git add -A src tests scripts
git commit -m "feat: add a synthwave style for the night drive" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```


---

## Commit 3: Top deck

### Task 7: The place, from the delivered paintings

Precondition: `public/scenes/top-deck.png` and `public/scenes/top-deck-night.png` exist, are both 1672×941, and line up (spec Appendix B).

**Files:**
- Modify: `src/places/deck.ts`, `src/places/index.ts` (move `deck` from `DRAFTS` to the end of `PLACES`)
- Create: `public/scenes/top-deck.png.json`, `public/scenes/top-deck-night.png.json`; Modify `public/scenes/ARTWORK.md`
- Tests: `tests/edition.test.ts`; scripts `verify-scenes.mjs`, `verify-sessions.mjs`

- [ ] **Step 1: Write the sidecars** in the existing format (`prompt`, `tool: "image_gen.imagegen"`, `mode`, `sourceAsset`, `sourceDimensions`, `generationDate`, `generatedSource`, `outputFile`) with the spec's Appendix A prompts and the paths and date the user supplies. Add a "Top deck" section to `ARTWORK.md`.

- [ ] **Step 2: Trace the geometry** from `top-deck.png` (view it with the Read tool, estimating to ±0.01 in image coordinates):
  - `water.outline` of the puddle;
  - `lamps` (the two sodium lamps and the cabin light);
  - `windows` spots (about ten tower windows) and fixtures (the lamp heads);
  - `regions` thresholds, so the car, deck and wall read as foreground and the sky above the skyline as sky.

  Check the traces by running `verify-sessions` and looking at the deck captures at 0 s and 3,300 s. Keep the shared probes true: sky at (.57, .12), foreground at (.1, .6).

- [ ] **Step 3: Tests for Review Focus 5.** In `tests/edition.test.ts`, record `edition('2026-09-17')` and `edition('2026-09-18')` (scene and seed) on this branch before moving the deck, then assert they are unchanged afterwards, and that `edition('2026-09-17','deck').scene==='deck'`. The rotation check still counts `DAILY_PLACES`.

- [ ] **Step 4: Browser checks for Review Focus 3, 4 and 5.**
  - `verify-scenes`: `?scene=deck&day=2026-09-17` loads, reloads with `scene=deck` kept in the URL, and shows five rows in Find a place (still inside the 390×844, 320×568 and 844×390 panel bounds).
  - `verify-scenes`: route `**/audio/piano/*.mp3` to abort at the deck, press Listen and expect the retry status; unroute, press Listen, and expect `window.__motes.radio.playing` with a synthwave track (`window.__motes.track.label` is Analog synths or Darksynth).
  - `verify-sessions`: at the deck, with motion Still, `previewSession` through the storm (2,900 to 3,300 s in 5 s steps) never changes the held canvas pixels, and the capture at 3,300 s shows rain.

- [ ] **Step 5: Register and verify.** Move `deck` into `PLACES`. `npm test` (the evening coverage, light arc and region checks now include the deck) and `npm run build`. Then run `verify-scenes` and `verify-sessions`, and check the desktop and phone captures of the deck by eye.

### Task 8: Copy, docs and the finish review (Commit 3)

**Files:** `index.html`, `DESIGN.md`, `.impeccable/design.json`, `CLAUDE.md`, `AGENTS.md`, `PRODUCT.md`, `README.md`, `public/audio/README.md`.

- [ ] **Step 1: Copy.** `index.html:55` panel intro becomes "Five places, each with its own feeling." No other markup changes. The style labels already come from `audio.labels`.

- [ ] **Step 2: Docs.**
  - `DESIGN.md`: five authored places with matched paintings, the deck's .43 anchor, the Place browser's five rows, style-owned Sound & motion labels, the Top deck evening and storm in "Evenings across places", and caches of at most five arrival and five evening images.
  - `.impeccable/design.json`: the `scene-evening` and `scene-composite` purposes say five places.
  - `CLAUDE.md`: "warm jazzy lofi radio" gains "and a synthwave place, Top deck"; "four" becomes "five" where it counts places; add the lightning cap and `DAILY_PLACES` freeze. Apply the identical edit to `AGENTS.md` (Codex reads it) and confirm with `cmp CLAUDE.md AGENTS.md`.
  - `PRODUCT.md`: a dated 2026-09-28 user-direction paragraph (synthwave from melodic outrun to darksynth, reached only by choosing it), and place counts.
  - `README.md`: Top deck in the place list and the living-scenes section, the synthwave hour in "Listen", verify commands.
  - `public/audio/README.md`: synthwave sounds are synthesized locally, with no samples.

- [ ] **Step 3: Impeccable detector.** `/Users/shannonholgate/.claude/skills/impeccable/scripts/impeccable detect --json index.html src/main.ts src/style.css`. Fix anything it reports on the changed lines.

- [ ] **Step 4: Finish review.** Use superpowers:requesting-code-review on the whole branch (`git diff main...HEAD`). Fix Critical and Important findings, then rerun `npm test`, `npm run build` and all browser scripts on desktop and phone.

- [ ] **Step 5: Commit 3.**

```bash
git add -A src tests scripts public index.html DESIGN.md .impeccable/design.json CLAUDE.md AGENTS.md PRODUCT.md README.md
git commit -m "feat: add Top deck, a synthwave place above the city" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Do not push. Tell the user the branch is ready for Kyle's review.
