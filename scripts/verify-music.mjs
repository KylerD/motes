import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';

const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'music-test',configureServer(server){server.middlewares.use('/__music_test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Music lifecycle checks</title><button id="play">Play</button>');});}}]});
await server.listen();
const browser=await chromium.launch({channel:'chromium'}),results=[];
try {
  const page=await browser.newPage(),errors=[];
  // Exercise the Firefox-compatible path throughout every lifecycle check.
  await page.addInitScript(()=>{AudioParam.prototype.cancelAndHoldAtTime=undefined;});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'__music_test');
  await page.evaluate(async()=>{
    const {RadioAudio}=await import('/src/music/audio.ts');
    window.radio=new RadioAudio(20260917,'rain');
    document.querySelector('#play').onclick=()=>{window.activation=window.radio.enable().then(()=>({ok:true}),error=>({ok:false,error:error.message}));};
  });
  assert.equal(await page.evaluate(()=>window.radio.diagnostics.contextState),'uninitialized');
  let block=true;
  await page.route('**/audio/piano/60.mp3',async route=>block?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.click('#play');
  const failure=await page.evaluate(()=>window.activation);assert.equal(failure.ok,false);assert.match(failure.error,/piano could not load/);
  assert.equal(await page.evaluate(()=>window.radio.playing),false);
  block=false;await page.click('#play');assert.equal((await page.evaluate(()=>window.activation)).ok,true);
  results.push({name:'failed sample fetch is retryable',failure});
  await page.waitForTimeout(1200);
  const playing=await page.evaluate(()=>({current:window.radio.current,diagnostics:window.radio.diagnostics}));
  assert.ok(playing.current.progress>0);assert.ok(playing.diagnostics.voices>0&&playing.diagnostics.voices<200);
  const title=playing.current.title;
  await page.evaluate(()=>window.radio.setEdition(71,'snow'));
  assert.equal(await page.evaluate(()=>window.radio.current.title),title);
  results.push({name:'scene edition preserves current track',playing});
  await page.evaluate(()=>window.radio.pause());await page.waitForTimeout(300);
  const paused=await page.evaluate(()=>({current:window.radio.current,diagnostics:window.radio.diagnostics}));
  assert.equal(paused.diagnostics.playing,false);assert.equal(paused.diagnostics.contextState,'suspended');assert.equal(paused.diagnostics.voices,0);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.radio.current.progress),paused.current.progress);
  await page.click('#play');assert.equal((await page.evaluate(()=>window.activation)).ok,true);
  await page.waitForTimeout(350);
  assert.ok(await page.evaluate(progress=>window.radio.current.progress>progress,paused.current.progress));
  results.push({name:'pause fades, releases notes, suspends, and resumes position',paused});
  // Rapid UI changes must leave just one clock and a bounded collection of active/scheduled notes.
  for(let i=0;i<12;i++) {await page.evaluate(i=>{window.radio.next();window.radio.setMode(i%2?'beats':'ambient');window.radio.setVolume(i%3?0.7:0);window.radio.setAmbience(i%3?0.25:0);},i);await page.waitForTimeout(90);}
  await page.waitForTimeout(450);
  const settled=await page.evaluate(()=>window.radio.diagnostics);
  assert.ok(settled.voices>0&&settled.voices<200);assert.equal(settled.scheduledSegments,1);assert.ok(settled.compositions>=13);
  results.push({name:'rapid track/mode/volume changes remain bounded',settled});
  const before=await page.evaluate(()=>window.radio.diagnostics);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(1500);
  const hidden=await page.evaluate(()=>window.radio.diagnostics);
  assert.equal(hidden.playing,true);assert.ok(hidden.ticks>before.ticks);assert.ok(hidden.currentTime>before.currentTime+1);
  results.push({name:'visibility event does not pause or replace audio clock',hidden});
  // Cancellation while loading must not unexpectedly begin playing once the requests finish.
  await page.evaluate(()=>{window.radio.dispose();window.radio.dispose();});
  await page.waitForTimeout(220);
  const disposed=await page.evaluate(()=>window.radio.diagnostics);assert.equal(disposed.playing,false);assert.equal(disposed.voices,0);
  await page.unroute('**/audio/piano/60.mp3');
  await page.route('**/audio/piano/*.mp3',async route=>{await new Promise(resolve=>setTimeout(resolve,120));await route.continue();});
  await page.evaluate(async()=>{const {RadioAudio}=await import('/src/music/audio.ts');window.radio=new RadioAudio(1,'coast');});
  await page.click('#play');await page.evaluate(()=>window.radio.pause());await page.evaluate(()=>window.activation);
  assert.equal(await page.evaluate(()=>window.radio.playing),false);
  assert.equal(await page.evaluate(()=>window.radio.diagnostics.contextState),'suspended');
  await page.unroute('**/audio/piano/*.mp3');
  await page.click('#play');assert.equal((await page.evaluate(()=>window.activation)).ok,true);
  results.push({name:'pause during loading cancels activation and permits restart'});
  // Jump to a track ending to verify the next arrangement is scheduled before the current one ends.
  const transition=await page.evaluate(()=>{
    const radio=window.radio,now=radio.context.currentTime,active=radio.segments[0];
    active.start=now-active.track.bars*4*60/active.track.bpm+2;
    active.cursor=active.track.events.length;radio.tick();
    return radio.segments.map(segment=>({start:segment.start,duration:segment.track.bars*4*60/segment.track.bpm,index:segment.track.index}));
  });
  assert.equal(transition.length,2);assert.equal(transition[1].start,transition[0].start+transition[0].duration);
  results.push({name:'next arrangement is scheduled at the exact end of the current track',transition});
  await page.evaluate(()=>window.radio.dispose());await page.waitForTimeout(200);
  assert.deepEqual(errors,[]);
  mkdirSync('captures-music',{recursive:true});writeFileSync('captures-music/lifecycle-results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await server.close();}
