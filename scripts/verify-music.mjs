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
  assert.ok(await page.evaluate(()=>window.radio.session.elapsed>0));
  await page.evaluate(()=>window.radio.setEdition(71,'snow'));
  assert.equal(await page.evaluate(()=>window.radio.current.title),title);
  assert.equal(await page.evaluate(()=>window.radio.session.elapsed),0,'A newly visited place waits for its own first arrangement.');
  results.push({name:'scene edition preserves current track',playing});
  await page.evaluate(()=>window.radio.pause());await page.waitForTimeout(300);
  const paused=await page.evaluate(()=>({current:window.radio.current,diagnostics:window.radio.diagnostics}));
  assert.equal(paused.diagnostics.playing,false);assert.equal(paused.diagnostics.contextState,'suspended');assert.equal(paused.diagnostics.voices,0);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.radio.current.progress),paused.current.progress);
  const sessionPaused=await page.evaluate(()=>window.radio.session.elapsed);
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.radio.session.elapsed),sessionPaused);
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
  await page.evaluate(()=>window.radio.pause());await page.waitForTimeout(200);
  await page.click('#play');assert.equal((await page.evaluate(()=>window.activation)).ok,true);
  assert.equal(await page.evaluate(()=>window.radio.segments[1]?.track.index),1,'Resuming near a song boundary must restore the prepared successor.');
  results.push({name:'pause near a boundary preserves the session sequence'});
  await page.evaluate(()=>window.radio.next());
  const skipped=await page.evaluate(()=>({index:window.radio.segments[0].track.index,elapsed:window.radio.session.elapsed}));
  assert.equal(skipped.index,1,'Next must choose the prepared successor instead of skipping two songs.');
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(()=>window.radio.session.elapsed>200));
  // Exercise the whole score sequence quickly; each switch releases the prior scheduled voices.
  for(let index=2;index<=18;index++){
    await page.evaluate(()=>window.radio.next());await page.waitForTimeout(230);
    assert.equal(await page.evaluate(()=>window.radio.segments[0].track.index),index);
    assert.ok(await page.evaluate(()=>window.radio.diagnostics.voices<200));
  }
  assert.ok(await page.evaluate(()=>window.radio.session.elapsed>=3600));
  assert.equal(await page.evaluate(()=>window.radio.session.chapter),'After hours');
  results.push({name:'pause, exact-one-song skips, eighteen arrangements and after-hours continuity'});
  // Revisiting A while its old song is audible must not revive the old session, even with A0 queued.
  const handovers=[];
  for(const action of ['natural','next','pause-resume']){
    await page.evaluate(()=>{
      const radio=window.radio;
      radio.pause();radio.setEdition(71,'snow');radio.setEdition(20260917,'rain');
      for(let index=0;index<8;index++)radio.next();
    });
    await page.click('#play');assert.equal((await page.evaluate(()=>window.activation)).ok,true);
    const revisited=await page.evaluate(()=>{
      const radio=window.radio,active=radio.segments[0];
      active.start=radio.context.currentTime-active.track.bars*4*60/active.track.bpm+2;
      active.cursor=active.track.events.length;radio.tick();
      const before={index:active.track.index,elapsed:radio.session.elapsed,successor:radio.segments[1]?.track.index};
      radio.setEdition(71,'snow');radio.tick();
      const away={elapsed:radio.session.elapsed,successor:radio.segments[1]?.track.index};
      radio.setEdition(20260917,'rain');radio.tick();
      return {before,away,returned:{elapsed:radio.session.elapsed,sameTrack:radio.position().track===active.track,
        successor:radio.segments[1]?.track.index,successorSeed:radio.segments[1]?.track.session.seed}};
    });
    assert.equal(revisited.before.index,8);assert.ok(revisited.before.elapsed>1500);assert.equal(revisited.before.successor,9);
    assert.deepEqual(revisited.away,{elapsed:0,successor:0});
    assert.equal(revisited.returned.sameTrack,true,'Edition visits must let the audible song finish.');
    assert.equal(revisited.returned.successor,0);assert.equal(revisited.returned.successorSeed,20260917);
    const handover={action,revisited};
    if(action==='next')await page.evaluate(()=>window.radio.next());
    if(action==='pause-resume'){
      await page.evaluate(()=>window.radio.pause());await page.waitForTimeout(200);
      handover.paused=await page.evaluate(()=>({elapsed:window.radio.session.elapsed,progress:window.radio.current.progress}));
      assert.equal(await page.evaluate(()=>window.radio.diagnostics.contextState),'suspended');
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>window.radio.current.progress),handover.paused.progress);
      await page.click('#play');assert.equal((await page.evaluate(()=>window.activation)).ok,true);
      await page.waitForTimeout(150);
      handover.resumed=await page.evaluate(()=>({elapsed:window.radio.session.elapsed,index:window.radio.position().track.index,
        progress:window.radio.current.progress,successor:window.radio.segments[1]?.track.index}));
      assert.equal(handover.resumed.index,8);assert.ok(handover.resumed.progress>=handover.paused.progress);
    }
    await page.waitForFunction(()=>window.radio.position().track.index!==8&&window.radio.session.elapsed>0);
    handover.after=await page.evaluate(()=>({index:window.radio.position().track.index,elapsed:window.radio.session.elapsed}));
    handovers.push(handover);
  }
  console.log(JSON.stringify({name:'A to B to A handover regression',handovers},null,2));
  assert.deepEqual(handovers.map(({action,revisited,paused,resumed,after})=>({action,returnedElapsed:revisited.returned.elapsed,
    pausedElapsed:paused?.elapsed??0,resumedElapsed:resumed?.elapsed??0,resumedSuccessor:resumed?.successor??0,
    nextIndex:after.index,startsAtBeginning:after.elapsed<2})),[
    {action:'natural',returnedElapsed:0,pausedElapsed:0,resumedElapsed:0,resumedSuccessor:0,nextIndex:0,startsAtBeginning:true},
    {action:'next',returnedElapsed:0,pausedElapsed:0,resumedElapsed:0,resumedSuccessor:0,nextIndex:0,startsAtBeginning:true},
    {action:'pause-resume',returnedElapsed:0,pausedElapsed:0,resumedElapsed:0,resumedSuccessor:0,nextIndex:0,startsAtBeginning:true},
  ],'Each edition visit starts a fresh session, including a return to the seed of the still-audible song.');
  results.push({name:'A to B to A resets the session through natural, Next and pause/resume handovers',handovers});
  await page.evaluate(()=>window.radio.dispose());await page.waitForTimeout(200);
  assert.deepEqual(errors,[]);
  mkdirSync('captures-music',{recursive:true});writeFileSync('captures-music/lifecycle-results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await server.close();}
