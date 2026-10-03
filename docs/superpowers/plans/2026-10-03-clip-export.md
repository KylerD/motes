# Clip Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a listener (and us, by script) make a 15-second vertical arrival-to-evening MP4 of the current place with its music, from a new Share panel, closing gate G6.

**Architecture:** A pure timeline (`src/clip/plan.ts`) drives a second, fixed-size `SceneRenderer` on a detached 1080×1920 canvas, with a slow pan and overlays. The opening song is rendered offline through the radio's own `renderPreview`, and both are encoded to H.264/AAC MP4 by Mediabunny. Everything that renders or encodes is dynamically imported when a clip is requested. The Share header button becomes a panel toggle with "Send a link" and "Make a 15-second clip".

**Tech Stack:** TypeScript, Vite 6, Canvas 2D, Web Audio (`OfflineAudioContext`), WebCodecs via Mediabunny 1.61 (MPL-2.0) and `@mediabunny/aac-encoder` (MPL-2.0, FFmpeg AAC in WASM), Vitest, Playwright with installed Chrome, ffprobe/ffmpeg 8.1.

**Spec:** `docs/superpowers/specs/2026-10-03-clip-export-design.md`

## Global Constraints

- Clip: 15.0 s, 1080×1920, 30 fps (450 frames); H.264 at about 4 Mbps, keyframe every 2 s; AAC-LC stereo, 48 kHz, 160 kbps; MP4 with fast start (moov before mdat).
- File name: `motes-<place slug>-<day>.mp4`.
- Scene lays out as a 405×720 viewport at 1080/405 (2.667×) pixel ratio.
- Listening time eases (smoothstep) 0 → 3,420 s over the first 13 s, then holds; picture time = clip time; session events omitted.
- Pan: horizontal crop position eases (smoothstep) from 0.15 to 0.85 over the full 15 s, left to right.
- Overlays: logo `public/brand/motes-logo.svg`, 300 px wide, centred, top edge at 220 px, 85% opacity, soft dark shadow; from 12 s, fading in over 0.8 s, the place's title in `500 72px "EB Garamond"` and `motes.sh` in `600 34px "Nunito Sans"`, centred around 36% of the height; nothing in the bottom 25% or right 12%.
- Sound: session track index 0 in the chosen style and drums mode, starting at the first `head` section; default music and ambience levels; fade in 0.3 s, fade out 1.5 s; normalised towards −18 dBFS RMS, with peaks ≤ −1.5 dBFS.
- Panel copy, verbatim: title "Pass this place on."; actions "Send a link" and "Make a 15-second clip"; description "Arrival to evening, with its music. Vertical, for Reels, TikTok and Shorts."; progress "Painting the evening… 40%"; unsupported "Clips need a browser that can make video, such as Chrome, Edge or Safari."; failure button "Try again".
- Only `src/clip/plan.ts`, `src/clip/support.ts` and the panel wiring load with the page; `src/clip/export.ts` (and everything it imports) is a dynamic import.
- Closing the Share panel cancels a clip in progress. Making a clip never changes the live picture, clocks or preferences, and music keeps playing.
- Analytics: one new event, `clip`, with `method` (`sheet` | `download`), `place`, `style`.
- Delivery: phones and tablets (coarse pointer) whose browser can share files get "Share clip"; everyone else gets "Save clip" (download). Delivery is a second tap, because share sheets need a fresh user gesture.
- Code style: match the repo. Dense single-line statements, `const`/arrow helpers, sparse one-line comments that explain why.

## Review Focus

1. **Share sheet after a long export.** `navigator.share` needs transient user activation, which a 10–30 s export outlives. Expect the second tap ("Share clip") to carry fresh activation. Pinned in Task 4 (the phone flow asserts `navigator.userActivation.isActive` inside the share call).
2. **Music and page starving during export.** A tight 450-frame loop could freeze the page or starve the radio's scheduler. Expect playback to continue and no long task over 250 ms. Pinned in Task 4 (radio ticks advance during export; long tasks measured).
3. **Closing mid-export.** Escape, the close button, a tap outside or opening another panel must stop the work and leave a clean panel. Pinned in Task 4 (cancel flow).
4. **Changing place after a clip is ready.** Must not deliver the previous place's clip. Pinned in Task 4 (stale flow).
5. **Several clips in one visit.** Must not leak renderers or composites; the second clip must work. Pinned in Task 4 (repeat flow: second export succeeds, live renderer still reports one composite).

---

### Task 1: Clip timeline

**Files:**
- Create: `src/clip/plan.ts`
- Test: `tests/clip-plan.test.ts`

**Interfaces:**
- Consumes: `Track` from `src/music/composer` (only `sections`); `createSession`, `composeSessionTrack` from `src/session/session` (tests only).
- Produces:
  - `CLIP` (readonly constants: `seconds`, `fps`, `width`, `height`, `viewport:{width,height}`, `evening`, `settleBy`, `pan:[from,to]`, `titleFrom`, `titleFade`, `fadeIn`, `fadeOut`, `videoBitrate`, `audioBitrate`, `sampleRate`)
  - `FRAMES: number` (450)
  - `interface ClipFrame {time:number;listening:number;pan:number;title:number}`
  - `clipFrame(index:number):ClipFrame`
  - `musicStartBeat(track:Pick<Track,'sections'>):number`
  - `clipName(slug:string,day:string):string`
  - `loudnessGain(rms:number,peak:number):number`

- [ ] **Step 1: Write the failing test**

Create `tests/clip-plan.test.ts`:

```ts
import {describe,expect,it} from 'vitest';
import {CLIP,FRAMES,clipFrame,clipName,loudnessGain,musicStartBeat} from '../src/clip/plan';
import {createSession,composeSessionTrack} from '../src/session/session';

describe('the clip timeline',()=>{
  it('is 450 frames at 30 fps, ending just before 15 s',()=>{
    expect(FRAMES).toBe(450);
    expect(clipFrame(0).time).toBe(0);
    expect(clipFrame(FRAMES-1).time).toBeCloseTo(14.967,3);
  });
  it('eases from arrival to the settled evening by 13 s, then holds',()=>{
    expect(CLIP.evening).toBe(3420);
    expect(clipFrame(0).listening).toBe(0);
    expect(clipFrame(13*30).listening).toBe(CLIP.evening);
    expect(clipFrame(FRAMES-1).listening).toBe(CLIP.evening);
    for(let i=1;i<FRAMES;i++)expect(clipFrame(i).listening).toBeGreaterThanOrEqual(clipFrame(i-1).listening);
  });
  it('drifts left to right across the middle 70% of the painting',()=>{
    expect(clipFrame(0).pan).toBeCloseTo(.15,6);
    expect(clipFrame(FRAMES-1).pan).toBeCloseTo(.85,3);
    for(let i=1;i<FRAMES;i++)expect(clipFrame(i).pan).toBeGreaterThan(clipFrame(i-1).pan);
  });
  it('fades the title in from 12 s over 0.8 s',()=>{
    expect(clipFrame(12*30-1).title).toBe(0);
    expect(clipFrame(12*30).title).toBe(0);
    expect(clipFrame(12*30+12).title).toBeGreaterThan(0);
    expect(clipFrame(12*30+12).title).toBeLessThan(1);
    expect(clipFrame(13*30).title).toBe(1);
  });
});

describe('clip music and files',()=>{
  it.each(['lofi','synthwave'] as const)('starts %s at the opening song\'s first theme section',style=>{
    const track=composeSessionTrack(createSession(20261003,'rain',style),0);
    const head=track.sections.find(section=>section.role==='head')!;
    expect(musicStartBeat(track)).toBe(head.startBar*4);
    expect(musicStartBeat(track)).toBeGreaterThan(0);
  });
  it('starts at the top when a song has no theme section',()=>{
    expect(musicStartBeat({sections:[{name:'Tag',role:'tag',startBar:0,endBar:8}]})).toBe(0);
  });
  it('names a clip after its place and day',()=>{
    expect(clipName('neon-rain','2026-10-03')).toBe('motes-neon-rain-2026-10-03.mp4');
  });
  it('lifts quiet music towards −18 dBFS without letting peaks pass −1.5 dBFS',()=>{
    expect(loudnessGain(.02,.1)).toBeCloseTo(10**(-18/20)/.02,6);
    expect(loudnessGain(.02,.3)).toBeCloseTo(10**(-1.5/20)/.3,6);
    expect(loudnessGain(.2,.9)).toBeLessThan(1);
    expect(loudnessGain(0,0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/clip-plan.test.ts`
Expected: FAIL, "Failed to resolve import ../src/clip/plan".

- [ ] **Step 3: Write the implementation**

Create `src/clip/plan.ts`:

```ts
import type {Track} from '../music/composer';

/** Everything that defines a Motes clip (docs/superpowers/specs/2026-10-03-clip-export-design.md). */
export const CLIP={
  seconds:15,fps:30,width:1080,height:1920,
  /** The scene lays out as a phone viewport, so rain and lamps keep their phone proportions. */
  viewport:{width:405,height:720},
  /** Painted light settles at 3,000 s and the dusk grade at 95% of the hour. */
  evening:3420,settleBy:13,
  pan:[.15,.85],
  titleFrom:12,titleFade:.8,
  fadeIn:.3,fadeOut:1.5,
  videoBitrate:4e6,audioBitrate:160e3,sampleRate:48000,
} as const;
export const FRAMES=CLIP.seconds*CLIP.fps;

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};

export interface ClipFrame {time:number;listening:number;pan:number;title:number}

/** What frame `index` shows: picture time, listening time, horizontal crop position and title opacity. */
export function clipFrame(index:number):ClipFrame {
  const time=index/CLIP.fps,[from,to]=CLIP.pan;
  return {time,listening:CLIP.evening*smooth(time/CLIP.settleBy),pan:from+(to-from)*smooth(time/CLIP.seconds),
    title:smooth((time-CLIP.titleFrom)/CLIP.titleFade)};
}

/** The clip's music starts where the song first states its theme, not in the sparse intro. */
export function musicStartBeat(track:Pick<Track,'sections'>):number {
  return (track.sections.find(section=>section.role==='head')?.startBar??0)*4;
}

export const clipName=(slug:string,day:string)=>`motes-${slug}-${day}.mp4`;

/** Gain towards −18 dBFS RMS, limited so peaks stay at or below −1.5 dBFS for AAC's true-peak overshoot. */
export function loudnessGain(rms:number,peak:number):number {
  if(!(rms>0)||!(peak>0))return 1;
  return Math.min(10**(-18/20)/rms,10**(-1.5/20)/peak);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/clip-plan.test.ts && npx tsc --noEmit`
Expected: 9 tests pass; no type errors. If the lofi `head` assertion fails because the opening form has no `head` section, check `src/music/composer/form.ts` `FORMS` and pick a seed whose opening form has one; don't weaken the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/clip/plan.ts tests/clip-plan.test.ts
git commit -m "feat: plan the clip's timeline, music start and loudness"
```

---

### Task 2: Fixed-size, panning scene renderer

**Files:**
- Create: `src/scenes/cover.ts`
- Modify: `src/scenes/renderer.ts` (constructor, `resize()`, `layout()`, the `performance.mark` in `draw()`, plus a new `setPan()`)
- Test: `tests/cover.test.ts`

**Interfaces:**
- Produces:
  - `coverLayout(width:number,height:number,aspect:number,anchor:number):{iw:number;ih:number;ox:number;oy:number}`
  - `new SceneRenderer(canvas,edition,{size?:{width:number;height:number;ratio:number}})`
  - `SceneRenderer.setPan(value?:number):void`, where 0 is the left edge and 1 the right edge, and `undefined` restores the place's anchor
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

Create `tests/cover.test.ts`:

```ts
import {describe,expect,it} from 'vitest';
import {coverLayout} from '../src/scenes/cover';

const aspect=1672/941;
describe('cover crops',()=>{
  it('fills a portrait view and slides from the left edge to the right edge',()=>{
    const left=coverLayout(405,720,aspect,0),right=coverLayout(405,720,aspect,1);
    expect(left.ih).toBeCloseTo(720,6);expect(left.oy).toBeCloseTo(0,6);
    expect(left.ox).toBe(0);
    expect(right.ox+right.iw).toBeCloseTo(405,6);
  });
  it('keeps a landscape view covered at the place anchor',()=>{
    const layout=coverLayout(1280,720,aspect,.43);
    expect(layout.iw).toBeGreaterThanOrEqual(1280);expect(layout.ih).toBeGreaterThanOrEqual(720);
    expect(layout.ox).toBeLessThanOrEqual(0);expect(layout.ox+layout.iw).toBeGreaterThanOrEqual(1280);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/cover.test.ts`
Expected: FAIL, "Failed to resolve import ../src/scenes/cover".

- [ ] **Step 3: Implement `coverLayout` and use it in the renderer**

Create `src/scenes/cover.ts`:

```ts
/** A cover crop in CSS pixels: the painting fills the view; `anchor` places it horizontally (0 shows the left edge, 1 the right). */
export function coverLayout(width:number,height:number,aspect:number,anchor:number) {
  const iw=Math.max(width,height*aspect),ih=iw/aspect;
  return {iw,ih,ox:(width-iw)*anchor,oy:(height-ih)*.5};
}
```

In `src/scenes/renderer.ts`:

1. Add the import: `import {coverLayout} from './cover';`
2. Add fields beside `motion = true;`:
   ```ts
   /** A clip renders at a fixed size instead of measuring the page. */
   private size?:{width:number;height:number;ratio:number};
   private pan?:number;
   ```
3. Replace the constructor with:
   ```ts
   constructor(private canvas: HTMLCanvasElement, public edition: Edition, options:{size?:{width:number;height:number;ratio:number}}={}) {
     const ctx = canvas.getContext('2d',{alpha:false});
     if (!ctx) throw new Error('This browser could not open the scene. Try reloading the page.');
     this.ctx = ctx; this.size = options.size; this.load(edition.scene); this.resize();
   }
   ```
4. Replace the first two lines of `resize()` with:
   ```ts
   const box = this.size ?? this.canvas.getBoundingClientRect(); this.width = Math.max(1,box.width); this.height = Math.max(1,box.height);
   this.ratio = this.size?.ratio ?? Math.min(devicePixelRatio || 1,2,2560/this.width);
   ```
5. Replace the body of `layout()` with:
   ```ts
   const image = this.images.get(this.edition.scene), aspect = image?.naturalWidth ? image.naturalWidth/image.naturalHeight : 16/9;
   ({iw:this.iw,ih:this.ih,ox:this.ox,oy:this.oy}=coverLayout(this.width,this.height,aspect,this.pan??SCENES[this.edition.scene].anchor));
   ```
6. Add after `point(...)`:
   ```ts
   /** Moves a cover crop across the painting (0 left edge, 1 right edge); undefined restores the place's own framing. */
   setPan(value?:number):void { this.pan=value; this.layout(); }
   ```
7. In `draw()`, change `if(!this.painted){this.painted=true;performance.mark('motes:painting');}` to `if(!this.painted){this.painted=true;if(!this.size)performance.mark('motes:painting');}`, so a clip never adds a first-paint mark.

- [ ] **Step 4: Run the tests and the live-scene regression**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass.

Then start a dev server and run the scene checks:
```bash
npx vite --host 127.0.0.1 --port 5175 --strictPort &
node scripts/verify-scenes.mjs && node scripts/verify-sessions.mjs
```
Expected: both print JSON ending in `"errors":[]` and exit 0. Stop the dev server afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/cover.ts src/scenes/renderer.ts tests/cover.test.ts
git commit -m "feat: let the scene renderer draw at a fixed size and pan"
```

---

### Task 3: Clip pipeline (music, encoder, overlay, export) with a file check

**Files:**
- Modify: `package.json`, `package-lock.json` (dependencies `mediabunny`, `@mediabunny/aac-encoder`)
- Modify: `src/music/audio.ts` (`renderPreview` gains `fromBeat` and `fadeOut`)
- Create: `src/clip/music.ts`, `src/clip/support.ts`, `src/clip/encode.ts`, `src/clip/overlay.ts`, `src/clip/export.ts`
- Create: `scripts/clip-tools.mjs`, `scripts/verify-clip.mjs`

**Interfaces:**
- Consumes: Task 1 (`CLIP`, `FRAMES`, `clipFrame`, `clipName`, `loudnessGain`, `musicStartBeat`, `ClipFrame`); Task 2 (`SceneRenderer` options and `setPan`); `renderPreview` from `src/music/audio.ts`; `createSession`, `sessionAt`, `composeSessionTrack` from `src/session/session.ts`; `SCENES`, `Edition` from `src/scenes/edition.ts`.
- Produces:
  - `renderClipMusic(edition:Edition,style:MusicStyle,mode:MusicMode):Promise<AudioBuffer>`
  - `canMakeClips():Promise<boolean>`
  - `encodeClip(canvas:HTMLCanvasElement,music:AudioBuffer,drawFrame:(index:number)=>void,options?:{signal?:AbortSignal;onProgress?:(fraction:number)=>void}):Promise<Blob>`
  - `drawOverlay(ctx:CanvasRenderingContext2D,frame:ClipFrame,art:{logo?:HTMLImageElement;title:string}):void`
  - `type ClipStage='painting'|'music'|'frames'`
  - `class ClipPaintingError extends Error` (its `name` is `'ClipPaintingError'`)
  - `makeClip(edition:Edition,style:MusicStyle,mode:MusicMode,options?:{signal?:AbortSignal;onProgress?:(stage:ClipStage,fraction:number)=>void}):Promise<File>`
  - `scripts/clip-tools.mjs`: `clipFromPage(page,scene,day,style)` returning `Promise<{name:string;bytes:Buffer}>`, and `inspectClip(path)` returning `Promise<{duration,video,audio,frames,fastStart,luminance:{start,middle,end},truePeak,loudness,stills:string[]}>`

- [ ] **Step 1: Write the failing file check**

Create `scripts/clip-tools.mjs`:

```js
// Shared by verify-clip.mjs and render-clip.mjs: make a clip inside a Motes page and inspect the MP4 with ffprobe/ffmpeg.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';

/** Makes a clip through src/clip/export.ts in the page and returns its bytes. */
export async function clipFromPage(page,scene,day,style='lofi') {
  const {name,base64}=await page.evaluate(async({scene,day,style})=>{
    const {makeClip}=await import('/src/clip/export.ts');
    const {edition}=await import('/src/scenes/edition.ts');
    const file=await makeClip(edition(day,scene),style,'beats');
    const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
    for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return {name:file.name,base64:btoa(binary)};
  },{scene,day,style});
  return {name,bytes:Buffer.from(base64,'base64')};
}

const run=(command,args)=>spawnSync(command,args,{encoding:'utf8',maxBuffer:64*1024*1024});
const luminance=async png=>{const {channels:[r,g,b]}=await sharp(png).stats();return .2126*r.mean+.7152*g.mean+.0722*b.mean;};

/** Duration, streams, frame count, fast start, light at 0/7.5/14.5 s, true peak and loudness. */
export async function inspectClip(path) {
  const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,codec_name,width,height,sample_rate,channels,nb_read_frames:format=duration','-of','json',path]).stdout);
  const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
  const data=readFileSync(path),stills=[],light=[];
  for(const at of [0,7.5,14.5]) {
    const still=path.replace(/\.mp4$/,`-${String(at).replace('.','_')}s.png`);
    run('ffmpeg',['-v','error','-y','-ss',String(at),'-i',path,'-frames:v','1',still]);
    stills.push(still);light.push(await luminance(still));
  }
  const loud=run('ffmpeg',['-nostats','-i',path,'-filter_complex','ebur128=peak=true','-f','null','-']).stderr;
  const summary=loud.slice(loud.lastIndexOf('Summary:'));
  const number=pattern=>{const value=pattern.exec(summary)?.[1];return value===undefined||value==='-inf'?-Infinity:Number(value);};
  return {duration:Number(probe.format.duration),video,audio,frames:Number(video?.nb_read_frames),
    fastStart:data.indexOf('moov')>-1&&data.indexOf('moov')<data.indexOf('mdat'),
    luminance:{start:light[0],middle:light[1],end:light[2]},
    truePeak:number(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)/),loudness:number(/Integrated loudness:\s+I:\s+(-?[\d.]+|-inf)/),stills};
}
```

Create `scripts/verify-clip.mjs`:

```js
// Clips: a valid 15 s vertical H.264/AAC MP4 for every place, reaching evening, with healthy sound.
// Installed Chrome carries the H.264 and AAC encoders that open-source Chromium builds leave out.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {clipFromPage,inspectClip} from './clip-tools.mjs';

const day='2026-09-17',server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
const errors=[],report={clips:{}};
mkdirSync('captures/clips',{recursive:true});
try {
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/?day=${day}`);
  for(const scene of ['rain','meadow','snow','coast']) {
    const {name,bytes}=await clipFromPage(page,scene,day);
    const path=`captures/clips/${name}`;writeFileSync(path,bytes);
    const clip=await inspectClip(path);
    assert.match(name,new RegExp(`^motes-[a-z-]+-${day}\\.mp4$`));
    assert.ok(Math.abs(clip.duration-15)<=.05,`${scene} lasts ${clip.duration}s`);
    assert.equal(clip.video?.codec_name,'h264');assert.equal(clip.video.width,1080);assert.equal(clip.video.height,1920);
    assert.equal(clip.frames,450,`${scene} has ${clip.frames} frames`);
    assert.equal(clip.audio?.codec_name,'aac');assert.equal(Number(clip.audio.sample_rate),48000);assert.equal(clip.audio.channels,2);
    assert.ok(clip.fastStart,`${scene} must put its index first`);
    assert.ok(clip.luminance.end<clip.luminance.start,`${scene} should reach evening (${clip.luminance.start.toFixed(1)} → ${clip.luminance.end.toFixed(1)})`);
    assert.ok(clip.truePeak<=-1,`${scene} true peak ${clip.truePeak} dBTP`);
    assert.ok(clip.loudness>-30,`${scene} is too quiet (${clip.loudness} LUFS)`);
    report.clips[scene]={name,kb:Math.round(bytes.length/1024),...clip};
  }
} finally {await browser.close();await server.close();}
report.errors=errors;
console.log(JSON.stringify(report,null,1));
assert.deepEqual(errors,[]);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/verify-clip.mjs`
Expected: FAIL with an error loading `/src/clip/export.ts` (the module doesn't exist yet).

- [ ] **Step 3: Install the encoder and extend `renderPreview`**

Run: `npm install mediabunny@1.61.0 @mediabunny/aac-encoder@1.61.0`

In `src/music/audio.ts`, change the `renderPreview` options type to add `fromBeat?:number;fadeOut?:number`, and change its body:

1. Replace the two fade-out lines
   `graph.output.gain.setValueAtTime(1,seconds-0.3);graph.output.gain.linearRampToValueAtTime(0,seconds);`
   with
   ```ts
   const fadeOut=Math.max(.05,options.fadeOut??.3);
   graph.output.gain.setValueAtTime(1,seconds-fadeOut);graph.output.gain.linearRampToValueAtTime(0,seconds);
   ```
2. Replace the scheduling loop
   ```ts
   let song=track,start=0.05,index=options.index??0;
   while(start<seconds) {
     for(const event of song.events) {
       const at=start+event.beat*60/song.bpm;if(at>=seconds)break;
       scheduleNote(graph,event,at,60/song.bpm);
     }
     start+=song.bars*4*60/song.bpm;
     song=score(++index);
   }
   ```
   with
   ```ts
   // `fromBeat` starts the first song partway in, as a clip starts at its theme.
   let song=track,start=0.05,index=options.index??0,from=Math.max(0,options.fromBeat??0);
   while(start<seconds) {
     for(const event of song.events) {
       if(event.beat<from)continue;
       const at=start+(event.beat-from)*60/song.bpm;if(at>=seconds)break;
       scheduleNote(graph,event,at,60/song.bpm);
     }
     start+=(song.bars*4-from)*60/song.bpm;from=0;
     song=score(++index);
   }
   ```

- [ ] **Step 4: Write the clip modules**

Create `src/clip/music.ts`:

```ts
import {renderPreview} from '../music/audio';
import type {MusicMode,MusicStyle} from '../music/composer';
import type {Edition} from '../scenes/edition';
import {createSession,composeSessionTrack} from '../session/session';
import {CLIP,loudnessGain,musicStartBeat} from './plan';

/** The edition's opening song from its first theme, rendered offline exactly as the radio plays it. */
export async function renderClipMusic(edition:Edition,style:MusicStyle,mode:MusicMode):Promise<AudioBuffer> {
  const track=composeSessionTrack(createSession(edition.seed,edition.scene,style),0);
  const {buffer}=await renderPreview({seed:edition.seed,mood:edition.scene,style,mode,index:0,seconds:CLIP.seconds,
    sampleRate:CLIP.sampleRate,fromBeat:musicStartBeat(track),fadeOut:CLIP.fadeOut});
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  let power=0,peak=0,count=0;
  for(const data of channels)for(const value of data){power+=value*value;peak=Math.max(peak,Math.abs(value));count++;}
  const gain=loudnessGain(Math.sqrt(power/Math.max(1,count)),peak);
  for(const data of channels)for(let i=0;i<data.length;i++)data[i]*=gain;
  return buffer;
}
```

Create `src/clip/support.ts`:

```ts
import {CLIP} from './plan';

/** Whether this browser can encode the clip's H.264 video, checked without loading the encoder. */
export async function canMakeClips():Promise<boolean> {
  if(typeof VideoEncoder==='undefined')return false;
  try {
    const {supported}=await VideoEncoder.isConfigSupported({codec:'avc1.640028',width:CLIP.width,height:CLIP.height,bitrate:CLIP.videoBitrate,framerate:CLIP.fps});
    return !!supported;
  } catch {return false;}
}
```

Create `src/clip/encode.ts`:

```ts
import {AudioBufferSource,BufferTarget,CanvasSource,Mp4OutputFormat,Output,Quality,canEncodeAudio} from 'mediabunny';
import {CLIP,FRAMES} from './plan';

/** Draws and encodes every frame, plus the music, into a fast-start MP4. */
export async function encodeClip(canvas:HTMLCanvasElement,music:AudioBuffer,drawFrame:(index:number)=>void,
  {signal,onProgress}:{signal?:AbortSignal;onProgress?:(fraction:number)=>void}={}):Promise<Blob> {
  // Firefox and Linux Chromium can't encode AAC natively; a WebAssembly build of FFmpeg's encoder fills in.
  if(!await canEncodeAudio('aac')){const {registerAacEncoder}=await import('@mediabunny/aac-encoder');registerAacEncoder();}
  const output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target:new BufferTarget()});
  const video=new CanvasSource(canvas,{codec:'avc',quality:new Quality({bitrate:CLIP.videoBitrate}),keyFrameInterval:2});
  const audio=new AudioBufferSource({codec:'aac',quality:new Quality({bitrate:CLIP.audioBitrate})});
  output.addVideoTrack(video,{frameRate:CLIP.fps});output.addAudioTrack(audio);
  const stop=()=>{if(output.state==='started'||output.state==='pending')void output.cancel();};
  signal?.addEventListener('abort',stop,{once:true});
  try {
    await output.start();
    await audio.add(music);
    for(let i=0;i<FRAMES;i++) {
      signal?.throwIfAborted();
      drawFrame(i);
      await video.add(i/CLIP.fps,1/CLIP.fps);
      // Let the page, its music and the player breathe between small batches.
      if(i%6===5)await new Promise(resolve=>setTimeout(resolve,0));
      onProgress?.((i+1)/FRAMES);
    }
    signal?.throwIfAborted();
    await output.finalize();
    return new Blob([output.target.buffer!],{type:'video/mp4'});
  } catch(error) {
    if(output.state!=='canceled'&&output.state!=='finalized')await output.cancel().catch(()=>undefined);
    throw error;
  } finally {signal?.removeEventListener('abort',stop);}
}
```

Create `src/clip/overlay.ts`:

```ts
import {CLIP,type ClipFrame} from './plan';

const LOGO_WIDTH=300,LOGO_HEIGHT=LOGO_WIDTH*114/486,LOGO_TOP=220,TITLE_Y=Math.round(CLIP.height*.36);

/** The wordmark throughout and the place's title at the end, clear of the apps' own controls. */
export function drawOverlay(ctx:CanvasRenderingContext2D,frame:ClipFrame,art:{logo?:HTMLImageElement;title:string}):void {
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.shadowColor='#110e0b99';ctx.shadowBlur=24;ctx.shadowOffsetY=3;
  if(art.logo){ctx.globalAlpha=.85;ctx.drawImage(art.logo,(CLIP.width-LOGO_WIDTH)/2,LOGO_TOP,LOGO_WIDTH,LOGO_HEIGHT);}
  if(frame.title>0) {
    ctx.fillStyle='#fff1da';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.globalAlpha=frame.title;ctx.font='500 72px "EB Garamond", Georgia, serif';
    // The width limit keeps the title out of the right-hand 12%, where the apps draw their buttons.
    ctx.fillText(art.title,CLIP.width/2,TITLE_Y,CLIP.width*.76);
    ctx.globalAlpha=frame.title*.9;ctx.font='600 34px "Nunito Sans", Arial, sans-serif';
    ctx.fillText('motes.sh',CLIP.width/2,TITLE_Y+70);
  }
  ctx.restore();
}
```

Create `src/clip/export.ts`:

```ts
import type {MusicMode,MusicStyle} from '../music/composer';
import {SCENES,type Edition} from '../scenes/edition';
import {SceneRenderer} from '../scenes/renderer';
import {createSession,sessionAt} from '../session/session';
import {encodeClip} from './encode';
import {renderClipMusic} from './music';
import {drawOverlay} from './overlay';
import {CLIP,clipFrame,clipName} from './plan';

export type ClipStage='painting'|'music'|'frames';
export class ClipPaintingError extends Error {name='ClipPaintingError';}

/** Resolves once both paintings are ready to composite; rejects if either fails or the clip is cancelled. */
function paintingsReady(renderer:SceneRenderer,signal?:AbortSignal):Promise<void> {
  return new Promise((resolve,reject)=>{
    const check=()=>{
      if(signal?.aborted)reject(signal.reason);
      else if(renderer.failed)reject(new ClipPaintingError('The painting could not load for the clip.'));
      else if(renderer.ready&&renderer.diagnostics.lightingReady)resolve();
    };
    renderer.onChange=check;signal?.addEventListener('abort',check,{once:true});check();
  });
}

async function loadLogo():Promise<HTMLImageElement|undefined> {
  const image=new Image();image.src='/brand/motes-logo.svg';
  // A missing wordmark shouldn't cost someone their clip.
  try{await image.decode();return image;}catch{return undefined;}
}

/** Renders a place's arrival-to-evening clip with its music. Nothing on the live page changes. */
export async function makeClip(edition:Edition,style:MusicStyle,mode:MusicMode,
  {signal,onProgress}:{signal?:AbortSignal;onProgress?:(stage:ClipStage,fraction:number)=>void}={}):Promise<File> {
  const canvas=document.createElement('canvas');canvas.width=CLIP.width;canvas.height=CLIP.height;
  const renderer=new SceneRenderer(canvas,edition,{size:{...CLIP.viewport,ratio:CLIP.width/CLIP.viewport.width}});
  try {
    onProgress?.('painting',0);
    const [logo]=await Promise.all([loadLogo(),paintingsReady(renderer,signal),
      document.fonts.load('500 72px "EB Garamond"'),document.fonts.load('600 34px "Nunito Sans"')]);
    signal?.throwIfAborted();
    onProgress?.('music',0);
    const music=await renderClipMusic(edition,style,mode);
    signal?.throwIfAborted();
    const plan=createSession(edition.seed,edition.scene),ctx=canvas.getContext('2d',{alpha:false})!,title=SCENES[edition.scene].title;
    const blob=await encodeClip(canvas,music,index=>{
      const frame=clipFrame(index);
      renderer.setPan(frame.pan);
      // Session events would flicker past at 200×, so the clip leaves them out.
      renderer.draw(frame.time,performance.now(),{...sessionAt(plan,frame.listening),events:[]});
      drawOverlay(ctx,frame,{logo,title});
    },{signal,onProgress:fraction=>onProgress?.('frames',fraction)});
    return new File([blob],clipName(SCENES[edition.scene].slug,edition.day),{type:'video/mp4'});
  } finally {renderer.dispose();canvas.width=canvas.height=1;}
}
```

- [ ] **Step 5: Run the type check and the file check**

Run: `npx tsc --noEmit && node scripts/verify-clip.mjs`
Expected: no type errors; JSON for four clips, each about 15 s, 1080×1920 h264, 450 frames, aac 48 kHz stereo, `fastStart: true`, `luminance.end < luminance.start`, `truePeak ≤ -1`, `loudness > -30`, and `"errors":[]`. Exit code 0.

If `tsc` rejects a Mediabunny option name, read `node_modules/mediabunny/dist/mediabunny.d.ts` for the 1.61 name and fix the call. Don't cast to `any`.

- [ ] **Step 6: Look at the stills**

Open `captures/clips/motes-neon-rain-2026-09-17-0s.png`, `-7_5s.png` and `-14_5s.png` (and the other places'). Check that:
- the logo sits top-centre, clear and soft;
- the pan has visibly moved across the painting;
- 14.5 s shows the evening with the title and `motes.sh`;
- nothing is clipped at the right or in the bottom quarter.

Fix overlay or pan constants in `plan.ts`/`overlay.ts` only if something is wrong, then re-run Step 5.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/music/audio.ts src/clip scripts/clip-tools.mjs scripts/verify-clip.mjs
git commit -m "feat: render arrival-to-evening clips with their music as MP4"
```

---

### Task 4: Share panel

**Files:**
- Modify: `index.html` (header Share button becomes a panel toggle; new `#share-panel`)
- Modify: `src/style.css` (share panel and actions; phone header selector)
- Modify: `src/main.ts` (panel ids, share link, clip wiring, debug hook)
- Modify: `scripts/verify-scenes.mjs` (panel loops include `share`)
- Modify: `scripts/score.mjs` (G5 panel list includes `share`)
- Modify: `scripts/verify-clip.mjs` (UI flows)

**Interfaces:**
- Consumes: Task 3's `canMakeClips()` (static import) and `makeClip`/`ClipStage` (dynamic import of `./clip/export`); the existing `share()`, `shareMessage()`, `track()`, `closePanels()`, `togglePanel()`, `text()`.
- Produces:
  - DOM ids:
    - `share-toggle` and `share-panel`;
    - `share-link` (carries `data-share`) and `make-clip` (carries `data-clip`);
    - `clip-make-label`, `clip-progress`, `clip-bar`, `clip-deliver`, `clip-deliver-label`, `clip-status`, `clip-unsupported`.
  - Debug hook `window.__motes.clip`, which reads `'idle'`, `'working'` or `'ready'`.

- [ ] **Step 1: Extend verify-clip with the panel flows (failing)**

In `scripts/verify-clip.mjs`, insert the following block immediately before the line `} finally {await browser.close();await server.close();}`, so it runs inside the same `try` with the same browser and server:

```js
// The Share panel: save on desktop, share on phones with a fresh gesture, cancel, stale and repeated clips, unsupported browsers.
const ready=page=>page.waitForFunction(()=>window.__motes?.ready&&window.__motes.rendering.lightingReady,null,{timeout:60000});
const openShare=async page=>{await page.click('#share-toggle');await page.waitForSelector('#share-panel:not([hidden])');};
const finished=page=>page.waitForFunction(()=>window.__motes.clip==='ready',null,{timeout:180000});
const desktop=await browser.newPage({viewport:{width:1280,height:800}});desktop.on('pageerror',error=>errors.push(error.message));
await desktop.addInitScript(()=>{window.__longest=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__longest=Math.max(window.__longest,entry.duration);}).observe({type:'longtask',buffered:false});});
await desktop.goto(`${base}/places/neon-rain/?day=${day}&debug`);await ready(desktop);
await desktop.click('#listen');await desktop.waitForFunction(()=>window.__motes.radio.playing);
await openShare(desktop);
assert.equal(await desktop.isEnabled('#make-clip'),true);assert.equal(await desktop.isHidden('#clip-unsupported'),true);
const ticks=await desktop.evaluate(()=>window.__motes.radio.ticks);
await desktop.evaluate(()=>{window.__longest=0;});
await desktop.click('#make-clip');await finished(desktop);
assert.ok(await desktop.evaluate(t=>window.__motes.radio.playing&&window.__motes.radio.ticks>t+8,ticks),'the radio keeps scheduling during an export');
const longest=await desktop.evaluate(()=>window.__longest);assert.ok(longest<250,`longest task during export ${longest}ms`);
assert.equal((await desktop.textContent('#clip-deliver-label')).trim(),'Save clip');
const [download]=await Promise.all([desktop.waitForEvent('download'),desktop.click('#clip-deliver')]);
assert.equal(download.suggestedFilename(),`motes-neon-rain-${day}.mp4`);
await download.saveAs(`captures/clips/panel-${download.suggestedFilename()}`);
const saved=await inspectClip(`captures/clips/panel-${download.suggestedFilename()}`);
assert.ok(Math.abs(saved.duration-15)<=.05&&saved.frames===450,'the panel saves a full clip');
report.panelSave=true;

// Repeat: a second clip in the same visit works, and the live picture keeps one composite.
await desktop.keyboard.press('Escape');await openShare(desktop);
await desktop.click('#make-clip');await finished(desktop);
assert.equal(await desktop.evaluate(()=>window.__motes.rendering.composites),1);report.repeat=true;

// Cancel: Escape mid-export stops the work and returns focus to Share.
await desktop.keyboard.press('Escape');await openShare(desktop);
await desktop.click('#make-clip');
await desktop.waitForFunction(()=>Number(document.querySelector('#clip-bar').value)>5,null,{timeout:60000});
await desktop.keyboard.press('Escape');
assert.equal(await desktop.evaluate(()=>document.activeElement?.id),'share-toggle');
assert.equal(await desktop.evaluate(()=>window.__motes.clip),'idle');
await desktop.waitForTimeout(1500);
await openShare(desktop);
assert.equal(await desktop.isVisible('#make-clip'),true);assert.equal(await desktop.isHidden('#clip-deliver'),true);
assert.equal((await desktop.textContent('#clip-status')).trim(),'');report.cancel=true;

// Stale: a ready clip doesn't survive a change of place.
await desktop.click('#make-clip');await finished(desktop);
await desktop.click('#scenes-toggle');await desktop.click('[data-place="snow"]');await ready(desktop);
await openShare(desktop);
assert.equal(await desktop.evaluate(()=>window.__motes.clip),'idle');assert.equal(await desktop.isHidden('#clip-deliver'),true);
report.stale=true;await desktop.close();

// Phone: share the file itself, from a fresh tap.
const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
phone.on('pageerror',error=>errors.push(error.message));
// Touch emulation alone doesn't always report a coarse pointer; set it explicitly.
await (await phone.context().newCDPSession(phone)).send('Emulation.setEmulatedMedia',{features:[{name:'pointer',value:'coarse'}]});
await phone.addInitScript(()=>{navigator.canShare=()=>true;navigator.share=async data=>{window.__sharedClip={active:navigator.userActivation.isActive,files:(data.files??[]).map(f=>({name:f.name,type:f.type,size:f.size}))};};});
await phone.goto(`${base}/places/the-last-chapter/?day=${day}&debug`);await ready(phone);
await openShare(phone);
const box=await phone.locator('#share-panel').boundingBox();
assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=391&&box.y+box.height<=845,'the panel fits the phone');
await phone.click('#make-clip');await finished(phone);
assert.equal((await phone.textContent('#clip-deliver-label')).trim(),'Share clip');
await phone.click('#clip-deliver');
const shared=await phone.evaluate(()=>window.__sharedClip);
assert.equal(shared.active,true,'the share sheet opens from a fresh gesture');
assert.deepEqual(shared.files.map(f=>[f.name,f.type]),[[`motes-the-last-chapter-${day}.mp4`,'video/mp4']]);
assert.ok(shared.files[0].size>1e6);report.phoneShare=true;await phone.close();

// Unsupported: no H.264 encoder means a clear, disabled action.
const old=await browser.newPage();old.on('pageerror',error=>errors.push(error.message));
await old.addInitScript(()=>{delete window.VideoEncoder;});
await old.goto(`${base}/?day=${day}&debug`);await ready(old);await openShare(old);
await old.waitForSelector('#clip-unsupported:not([hidden])');
assert.equal(await old.isDisabled('#make-clip'),true);
assert.match(await old.textContent('#clip-unsupported'),/Clips need a browser that can make video, such as Chrome, Edge or Safari\./);
report.unsupported=true;await old.close();

// A failed evening painting says so and offers Try again.
const offline=await browser.newPage();offline.on('pageerror',error=>errors.push(error.message));
await offline.route(/neon-rain-night\.(avif|webp|png)$/,route=>route.fulfill({status:503,body:''}));
await offline.goto(`${base}/places/neon-rain/?day=${day}&debug`);
await offline.waitForFunction(()=>window.__motes?.ready&&window.__motes.rendering.lightingFailed,null,{timeout:60000});
await openShare(offline);await offline.click('#make-clip');
await offline.waitForFunction(()=>document.querySelector('#clip-make-label')?.textContent==='Try again',null,{timeout:60000});
assert.match(await offline.textContent('#clip-status'),/painting couldn’t load for the clip/);
assert.equal(await offline.isEnabled('#make-clip'),true);
report.paintingFailure=true;await offline.close();
```

Run: `node scripts/verify-clip.mjs`
Expected: FAIL at `#share-toggle` (no such element yet).

- [ ] **Step 2: Add the panel markup**

In `index.html`, replace the header Share button line (`<button id="share" ... data-share ...>…</button>`) with:

```html
        <button id="share-toggle" class="text-button header-button" aria-expanded="false" aria-controls="share-panel" aria-label="Share this place" title="Share this place"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg><span>Share</span></button>
```

After the closing `</aside>` of `#edition-panel`, add:

```html
    <aside id="share-panel" class="panel share-panel" aria-labelledby="share-title" hidden>
      <div class="panel-heading"><h2 id="share-title">Pass this place on.</h2><button class="icon-button close-panel" aria-label="Close sharing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
      <p class="panel-intro">Send someone a quiet corner of their own.</p>
      <button id="share-link" class="share-action" data-share><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg><span>Send a link<small>To this place, just as it is today.</small></span></button>
      <button id="make-clip" class="share-action" data-clip><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="m10 9 5 3-5 3Z"/></svg><span><span id="clip-make-label">Make a 15-second clip</span><small>Arrival to evening, with its music. Vertical, for Reels, TikTok and Shorts.</small></span></button>
      <div id="clip-progress" class="clip-progress" hidden><progress id="clip-bar" max="100" value="0" aria-label="Clip progress"></progress></div>
      <button id="clip-deliver" class="clip-deliver" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg><span id="clip-deliver-label">Save clip</span></button>
      <p id="clip-status" class="clip-status" role="status" aria-live="polite"></p>
      <p id="clip-unsupported" class="panel-note" hidden>Clips need a browser that can make video, such as Chrome, Edge or Safari.</p>
    </aside>
```

- [ ] **Step 3: Style it**

In `src/style.css`:

1. After the `.edition-panel{...}` line (desktop), add:
   ```css
   .share-panel{right:var(--inset);top:98px;width:366px}
   .share-action{display:flex;align-items:center;gap:14px;width:calc(100% + 20px);min-height:66px;margin-inline:-10px;padding:10px;border-radius:10px;text-align:left;font-size:14px;font-weight:600}
   .share-action>svg{width:22px;height:22px;flex-shrink:0;color:#8b623e}
   .share-action small{display:block;color:var(--paper-muted);font-size:12px;font-weight:400;margin-top:3px}
   .share-action:hover:not(:disabled){background:var(--paper-hover)}.share-action:disabled{opacity:.4;cursor:default}
   .clip-progress progress{display:block;width:100%;height:6px;margin-top:12px;appearance:none;border:0;border-radius:3px;background:#d8c9b5;overflow:hidden}
   .clip-progress progress::-webkit-progress-bar{background:#d8c9b5}.clip-progress progress::-webkit-progress-value{background:#9b633b}
   .clip-progress progress::-moz-progress-bar{background:#9b633b}
   .clip-deliver{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:48px;margin-top:12px;border-radius:24px;background:var(--amber);color:var(--ink);font-weight:700}
   .clip-deliver:hover{background:var(--amber-hover)}
   .clip-status{margin:10px 0 0;font-size:12px;color:var(--paper-muted)}.clip-status:empty{margin:0}
   ```
2. In the `@media(max-width:700px)` block, change `.edition-panel{right:18px;top:99px;width:350px;max-height:calc(100dvh - 135px)}` to `.edition-panel,.share-panel{right:18px;top:99px;width:350px;max-height:calc(100dvh - 135px)}`.
3. In the same block, change `#fullscreen,#quiet span,#share span{display:none}#quiet,#share{width:42px;padding:10px}` to `#fullscreen,#quiet span,#share-toggle span{display:none}#quiet,#share-toggle{width:42px;padding:10px}`.

- [ ] **Step 4: Wire it in `src/main.ts`**

1. Add the import beside the other share import: `import {canMakeClips} from './clip/support';`
2. Change `const panelIds=['mix','scenes','edition'] as const;` to `const panelIds=['mix','scenes','edition','share'] as const;`
3. In `closePanels`, add `cancelClip();` as the first statement. `cancelClip` is a function declaration, so it's hoisted.
4. In `togglePanel`, after the line that opens the panel (`if(shouldOpen){…}`), add: `if(shouldOpen&&id==='share')void checkClipSupport();`
5. Replace the `share()` helper's `shared` line and the listener:
   ```ts
   const shared=(method:string)=>{track('share',{method,place:current.scene});closePanels();};
   ```
   and change `$('share').addEventListener('click',()=>void share());` to `$('share-link').addEventListener('click',()=>void share());`
6. Below the share listener, add the clip wiring:
   ```ts
   // Clips: the renderer and encoder (src/clip/export.ts) load only when someone makes one.
   let clipJob:AbortController|undefined,readyClip:File|undefined,clipSupport:Promise<boolean>|undefined;
   function clipState(state:'idle'|'working'|'ready'|'failed',message='') {
     $('clip-progress').hidden=state!=='working';$('make-clip').hidden=state==='ready';$('clip-deliver').hidden=state!=='ready';
     // Never re-enable the action in a browser that can't encode video.
     if(state==='working')$<HTMLButtonElement>('make-clip').disabled=true;
     else if(clipSupport)void clipSupport.then(supported=>{$<HTMLButtonElement>('make-clip').disabled=!supported;});
     text('clip-make-label',state==='failed'?'Try again':'Make a 15-second clip');text('clip-status',message);
   }
   /** Closing the panel, or anything that closes it, abandons the clip. */
   function cancelClip() {clipJob?.abort();clipJob=undefined;readyClip=undefined;clipState('idle');}
   async function checkClipSupport() {
     clipSupport??=canMakeClips();const supported=await clipSupport;
     $<HTMLButtonElement>('make-clip').disabled=!supported;$('clip-unsupported').hidden=supported;
   }
   const sharesClip=(file:File)=>matchMedia('(pointer: coarse)').matches&&!!navigator.canShare?.({files:[file]});
   async function startClip() {
     if(clipJob)return;
     const job=new AbortController(),place=current,style=preferences.style;clipJob=job;readyClip=undefined;
     clipState('working','Preparing the painting…');$<HTMLProgressElement>('clip-bar').value=0;
     try {
       const {makeClip}=await import('./clip/export');
       const file=await makeClip(place,style,preferences.mode,{signal:job.signal,onProgress:(stage,fraction)=>{
         if(job.signal.aborted)return;
         const overall=stage==='frames'?.1+.9*fraction:stage==='music'?.05:0;
         $<HTMLProgressElement>('clip-bar').value=Math.round(overall*100);
         text('clip-status',stage==='frames'?`Painting the evening… ${Math.round(overall*100)}%`:stage==='music'?'Recording the music…':'Preparing the painting…');
       }});
       if(job.signal.aborted)return;
       readyClip=file;clipState('ready','Your clip is ready.');
       text('clip-deliver-label',sharesClip(file)?'Share clip':'Save clip');$('clip-deliver').focus();
     } catch(error) {
       if(job.signal.aborted)return;
       clipState('failed',error instanceof Error&&error.name==='ClipPaintingError'?'The painting couldn’t load for the clip. Check your connection and try again.':'The clip couldn’t be made this time.');
     } finally {if(clipJob===job)clipJob=undefined;}
   }
   /** A second tap: share sheets need a fresh gesture, which a long export outlives. */
   async function deliverClip() {
     const file=readyClip;if(!file)return;
     const done=(method:'sheet'|'download',message:string)=>{track('clip',{method,place:current.scene,style:preferences.style});text('clip-status',message);};
     if(sharesClip(file)) {
       try{await navigator.share({files:[file],...shareMessage(current.scene)});done('sheet','Shared. Thank you for passing it on.');return;}
       catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;}
     }
     const url=URL.createObjectURL(file),link=document.createElement('a');
     link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();
     setTimeout(()=>URL.revokeObjectURL(url),60000);
     done('download','Saved to your downloads.');
   }
   $('make-clip').addEventListener('click',()=>void startClip());
   $('clip-deliver').addEventListener('click',()=>void deliverClip());
   ```
7. In the `params.has('debug')` hook object, add after `get environment(){return audio.environment;},`:
   `get clip(){return clipJob?'working':readyClip?'ready':'idle';},`

- [ ] **Step 5: Include the panel in the existing checks**

- `scripts/verify-scenes.mjs`: change both `for(const panel of ['mix','scenes','edition'])` loops to `for(const panel of ['mix','scenes','edition','share'])`.
- `scripts/score.mjs`: in G5, change `for(const panel of [null,'mix','scenes','edition'])` to `for(const panel of [null,'mix','scenes','edition','share'])`.

- [ ] **Step 6: Run everything that touches the page**

Run:
```bash
npx tsc --noEmit && npx vitest run && npm run build
npx vite --host 127.0.0.1 --port 5175 --strictPort &
node scripts/verify-scenes.mjs && node scripts/verify-sessions.mjs && node scripts/verify-clip.mjs
```
Expected: type check, tests and build pass. `verify-scenes` and `verify-sessions` end with `"errors":[]`. `verify-clip` reports `panelSave`, `repeat`, `cancel`, `stale`, `phoneShare`, `unsupported` and `paintingFailure` all `true`, with `"errors":[]`. Stop the dev server.

Look at `captures-scenes/share-mobile.png`, `share-320.png` and `share-844.png`: the panel should fit, be readable and scroll on the short landscape view.

- [ ] **Step 7: Commit**

```bash
git add index.html src/style.css src/main.ts scripts/verify-scenes.mjs scripts/score.mjs scripts/verify-clip.mjs
git commit -m "feat: make clips from a Share panel"
```

---

### Task 5: Daily clip script and G6 in the score

**Files:**
- Create: `scripts/render-clip.mjs`
- Modify: `scripts/score.mjs` (suite gains `sharing`; G6 uses it under `--full`)

**Interfaces:**
- Consumes: `clipFromPage`, `inspectClip` from `scripts/clip-tools.mjs`.
- Produces: `node scripts/render-clip.mjs [day] [place] [style]`, which writes `captures/clips/<name>` and prints its inspection.

- [ ] **Step 1: Write the daily clip script**

Create `scripts/render-clip.mjs`:

```js
// The daily clip for posting: node scripts/render-clip.mjs [day] [place] [style]
// Day defaults to today (local), place to that day's edition, style to lofi. Writes captures/clips/.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {clipFromPage,inspectClip} from './clip-tools.mjs';

const today=new Date(),day=process.argv[2]??`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const place=process.argv[3],style=process.argv[4]??'lofi';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const browser=await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]+`?day=${day}`);
  // No place given: today's edition picks it, exactly as the home page does.
  const scene=place??await page.evaluate(async day=>(await import('/src/scenes/edition.ts')).edition(day).scene,day);
  const {name,bytes}=await clipFromPage(page,scene,day,style);
  mkdirSync('captures/clips',{recursive:true});writeFileSync(`captures/clips/${name}`,bytes);
  console.log(JSON.stringify({path:`captures/clips/${name}`,kb:Math.round(bytes.length/1024),...await inspectClip(`captures/clips/${name}`)},null,1));
} finally {await browser.close();await server.close();}
```

- [ ] **Step 2: Run it**

Run: `node scripts/render-clip.mjs 2026-10-03`
Expected: JSON with `path: captures/clips/motes-<today's place slug>-2026-10-03.mp4`, about 15 s, 450 frames.

- [ ] **Step 3: Make G6 use the real check under `--full`**

In `scripts/score.mjs`:

1. Change the suite and its tallies:
   ```js
   const suite={correctness:['verify-scenes.mjs','verify-sessions.mjs','verify-ios-audio.mjs'],audio:['verify-music.mjs','verify-mix.mjs','verify-mix.mjs synthwave','verify-synthwave.mjs','verify-synthwave-sound.mjs'],sharing:['verify-clip.mjs']};
   const passed={correctness:[],audio:[],sharing:[]},failed={correctness:[],audio:[],sharing:[]};
   ```
2. Replace the G6 `gate(...)` call with:
   ```js
   const clipChecked=full?failed.sharing.length===0:undefined;
   gate('G6','Shareable',cards.length===pages.length&&pages.length===5&&share&&clip&&clipChecked!==false,
     `preview cards ${cards.length}/${pages.length} pages, share action ${share?'present':'not built yet'}, clip export ${!clip?'not built yet':clipChecked===undefined?'present (clip files checked with --full)':clipChecked?'makes valid clips for every place':'FAILS verify-clip.mjs'}`,{cards,share,clip,clipChecked});
   ```
3. Update the header comment line `npm run score -- --full` to read `also the whole browser, audio and clip verify suite (G1, G4, G6 clips)`.

- [ ] **Step 4: Run the score**

Run: `npm run score -- --full`
Expected: G1–G6 all PASS; G6's detail reads "makes valid clips for every place"; the summary ends with "All measured gates pass."

- [ ] **Step 5: Commit**

```bash
git add scripts/render-clip.mjs scripts/score.mjs
git commit -m "feat: render the daily clip and check clips in the score"
```

---

### Task 6: Documentation

**Files:**
- Modify: `README.md`, `PRODUCT.md`, `DESIGN.md`, `CLAUDE.md`, `GOAL.md`, `docs/superpowers/specs/2026-10-03-clip-export-design.md`

- [ ] **Step 1: Update the docs**

- `README.md`:
  - In the controls paragraph, replace `**Share** passes the current place on, through the system share sheet or a copied link.` with `**Share** passes the current place on: send a link, or make a 15-second vertical clip of its arrival-to-evening light with its music.`
  - In "Run", replace `There is no backend, account, runtime npm dependency or daily content-generation job.` with `There is no backend, account or daily content-generation job. The one runtime dependency, Mediabunny (MPL-2.0), loads only when someone makes a clip.`
  - In the module table, add `| \`src/clip/\` | Clip timeline, offline music, overlays, H.264/AAC encoding and the export job |`.
  - In the Verify command list, add `node scripts/verify-clip.mjs` and `node scripts/render-clip.mjs [day] [place] [style]`, with one sentence explaining that both need installed Chrome and ffmpeg/ffprobe on the PATH, and that clips land in `captures/clips/`.
- `PRODUCT.md`: replace `and a short arrival-to-evening clip export comes next.` with `and Make a 15-second clip renders the place's arrival-to-evening light with its music as a vertical video, in the browser.`
- `DESIGN.md`: replace the **Share** bullet with:
  > **Share:** a header action labelled Share this place opens the "Pass this place on." panel. **Send a link** opens the system share sheet with the place's name, its two-line caption and a link to its place page (a revisited day keeps its date; links carry `ref=share`). Without a share sheet it copies the link; if copying fails, the status shows the link. **Make a 15-second clip** shows a slim amber progress bar and "Painting the evening… 40%", then an amber "Share clip" (phones that can share files) or "Save clip" button. That second tap gives the share sheet a fresh gesture. Closing the panel cancels a clip in progress. Browsers that can't encode video see the action disabled with a short explanation.
- `CLAUDE.md`: replace `Keep just one full-size composite for the active place,` with `Keep just one full-size composite for the active place (plus one while a clip is being made),`. After the sentence on share links, add: `Clips (src/clip/) load only on request, never touch the live clocks, picture or preferences, and must pass scripts/verify-clip.mjs.`
- `GOAL.md`: in the G6 row, change the "Now" cell to `Preview cards 5/5 pages, a share action, and clip export (15 s vertical H.264/AAC, checked for every place): **pass**`. In the Phase 1 build list, change `<li>Arrival-to-evening clip export</li>` to `<li>Arrival-to-evening clip export ✓</li>`.
- Spec: in "Experience", replace `When the clip is ready, a browser that can share files opens the share sheet with the video; otherwise the MP4 downloads.` with `When the clip is ready, a second tap shares it: phones and tablets that can share files get "Share clip" (a share sheet needs a fresh gesture, which a long export outlives); everyone else gets "Save clip", which downloads the MP4.`

- [ ] **Step 2: Final verification**

Run:
```bash
npx vitest run && npm run build && npm run score -- --full
```
Expected: all tests pass; G1–G6 PASS. Then look at the four places' 14.5 s stills in `captures/clips/`. Open one clip in a video player to confirm it plays with sound.

- [ ] **Step 3: Commit**

```bash
git add README.md PRODUCT.md DESIGN.md CLAUDE.md GOAL.md docs/superpowers/specs/2026-10-03-clip-export-design.md
git commit -m "docs: describe clip export and record G6 passing"
```
