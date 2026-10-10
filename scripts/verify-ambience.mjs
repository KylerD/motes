// Scene sounds (src/music/ambience.ts): nothing before Listen, the synthesised bed until recordings arrive, failure and
// Retry, stale loads, the memory cap, seamless swaps and loops, hidden tabs, after hours and Listening on.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'ambience-test',configureServer(server){server.middlewares.use('/__ambience_test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Scene sound checks</title><link rel="icon" href="data:,"><button id="play">Play</button>');});}}]});
await server.listen();
const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch({channel:'chromium'}),results=[];
const CAP=32*1024*1024;
try {
  // Nothing loads or plays before Listen, in the app itself.
  {
    const page=await browser.newPage(),requests=[];
    page.on('request',request=>{if(request.url().includes('/audio/ambience/'))requests.push(request.url());});
    await page.goto(`${origin}/places/neon-rain/?debug`);
    await page.waitForFunction(()=>window.__motes?.ready);await page.waitForTimeout(800);
    assert.deepEqual(requests,[],'No scene recording is fetched before Listen.');
    assert.equal(await page.evaluate(()=>window.__motes.radio.contextState),'uninitialized');
    await page.click('#listen');
    await page.waitForFunction(()=>window.__motes.radio.sceneSounds.state==='recorded',null,{timeout:15000});
    assert.ok(requests.length>=6);
    // Listening on is a labelled control, remembered with the other preferences.
    await page.click('#mix-toggle');
    assert.equal(await page.locator('label[for=listening-space]').textContent(),'Listening on');
    await page.selectOption('#listening-space','headphones');
    assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('motes-listening'))).space,'headphones');
    assert.equal(await page.locator('#scene-sounds-failed').isHidden(),true);
    results.push({name:'nothing before Listen; recordings after; Listening on remembered',requests:requests.length});
    await page.close();
  }

  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/__ambience_test');
  const fresh=(seed=20260917,mood='rain')=>page.evaluate(async([seed,mood])=>{
    window.radio?.dispose();
    const {RadioAudio}=await import('/src/music/audio.ts');window.radio=new RadioAudio(seed,mood);
    document.querySelector('#play').onclick=()=>{window.activation=window.radio.enable().then(()=>({ok:true}),error=>({ok:false,error:error.message}));};
  },[seed,mood]);
  const state=()=>page.evaluate(()=>({...window.radio.diagnostics.sceneSounds,synthesised:window.radio.diagnostics.synthesisedBeds,playing:window.radio.playing}));
  const recorded=()=>page.waitForFunction(()=>window.radio.sceneSounds==='recorded',null,{timeout:15000});
  const slow=ms=>page.route('**/audio/ambience/**',async route=>{await new Promise(resolve=>setTimeout(resolve,ms));await route.continue();});

  // The synthesised bed plays until the recordings arrive, then gives way.
  await fresh();await slow(1500);
  await page.click('#play');assert.equal((await page.evaluate(()=>window.activation)).ok,true);
  await page.waitForTimeout(300);
  const waiting=await state();
  assert.equal(waiting.state,'loading');assert.equal(waiting.synthesised,1);assert.equal(waiting.sources,0);
  await recorded();await page.waitForTimeout(200);
  const arrived=await state();
  assert.equal(arrived.synthesised,0);assert.ok(arrived.sources>=3);assert.ok(arrived.panners<=8);
  assert.ok(arrived.decodedBytes>0&&arrived.decodedBytes<=CAP,`decoded ${arrived.decodedBytes}`);
  results.push({name:'synthesised bed until the recordings arrive',waiting,arrived});
  await page.unroute('**/audio/ambience/**');

  // Leaving gives the decoded sounds back once the old place has faded.
  await page.evaluate(()=>window.radio.setEdition(71,'snow'));await page.waitForTimeout(1000);
  const left=await state();
  assert.equal(left.state,'synthesised');assert.equal(left.sources,0);assert.equal(left.panners,0);assert.equal(left.decodedBytes,0);
  // Returning reuses the downloaded bytes: no request goes out.
  let refetched=0;await page.route('**/audio/ambience/**',route=>{refetched++;return route.continue();});
  await page.evaluate(()=>window.radio.setEdition(20260917,'rain'));await recorded();
  assert.equal(refetched,0);await page.unroute('**/audio/ambience/**');
  results.push({name:'handover releases decoded sounds; return reuses the downloads',left});

  // Hidden tabs keep the beds swapping on the radio's look-ahead.
  const before=await state();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(16000);
  const hidden=await state();
  assert.equal(hidden.playing,true);assert.ok(hidden.started.segments>=before.started.segments+3,`segments ${before.started.segments} → ${hidden.started.segments}`);
  assert.ok(hidden.started.spots>before.started.spots);assert.ok(hidden.panners<=8&&hidden.sources<30);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  results.push({name:'a hidden tab keeps the beds and spots going',before:before.started,hidden:hidden.started});

  // Listening on switches every live panner between equal-power and HRTF.
  const models=space=>page.evaluate(space=>{window.radio.setSpace(space);const place=window.radio.sounds.place;return [...place.beds.filter(b=>b.panner).map(b=>b.panner.panningModel),...place.pool.map(p=>p.node.panningModel)];},space);
  assert.ok((await models('headphones')).every(model=>model==='HRTF'));
  assert.ok((await models('speakers')).every(model=>model==='equalpower'));
  results.push({name:'Listening on changes every panner'});

  // Pause leaves nothing playing; resuming needs no download.
  await page.evaluate(()=>window.radio.pause());await page.waitForTimeout(300);
  const paused=await state();
  assert.equal(paused.sources,0);assert.equal(paused.panners,0);assert.equal(paused.synthesised,0);
  await page.click('#play');await page.evaluate(()=>window.activation);await page.waitForTimeout(200);
  assert.equal((await state()).state,'recorded');
  results.push({name:'pause frees every source and panner',paused});

  // A failed load keeps the synthesised bed; Retry brings the recordings.
  await fresh();await page.route('**/audio/ambience/rain/garden.mp3',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.click('#play');assert.equal((await page.evaluate(()=>window.activation)).ok,true,'Scene sounds never block the music.');
  await page.waitForFunction(()=>window.radio.sceneSounds==='failed');
  const failed=await state();assert.equal(failed.synthesised,1);assert.equal(failed.sources,0);
  await page.unroute('**/audio/ambience/rain/garden.mp3');
  await page.evaluate(()=>window.radio.retrySceneSounds());await recorded();await page.waitForTimeout(100);
  const retried=await state();assert.equal(retried.synthesised,0);assert.ok(retried.sources>=3);
  results.push({name:'failure falls back to the synthesised bed and Retry recovers',failed,retried});

  // A load that finishes after the listener has moved on prepares nothing and plays nothing.
  await fresh();await slow(1500);
  await page.click('#play');await page.evaluate(()=>window.activation);await page.waitForTimeout(200);
  await page.evaluate(()=>window.radio.setEdition(71,'snow'));await page.waitForTimeout(2500);
  const stale=await state();
  assert.equal(stale.state,'synthesised');assert.equal(stale.decodedBytes,0);assert.equal(stale.sources,0);assert.equal(stale.synthesised,1);
  results.push({name:'a stale load after a place switch never plays',stale});

  // A load that finishes during a pause stays silent until Listen.
  await fresh();
  await page.click('#play');await page.evaluate(()=>window.activation);await page.waitForTimeout(150);
  await page.evaluate(()=>window.radio.pause());await page.waitForTimeout(2500);
  const quiet=await state();
  assert.equal(quiet.playing,false);assert.equal(quiet.sources,0);assert.equal(quiet.synthesised,0);
  assert.equal(await page.evaluate(()=>window.radio.diagnostics.contextState),'suspended');
  await page.unroute('**/audio/ambience/**');
  await page.click('#play');await page.evaluate(()=>window.activation);await page.waitForTimeout(200);
  assert.equal((await state()).state,'recorded');
  results.push({name:'a load finishing during a pause stays silent',quiet});
  await page.evaluate(()=>window.radio.dispose());

  // Offline: swaps and loop seams are continuous, levels hold after hours, and decoded sounds fit the cap.
  const offline=await page.evaluate(async()=>{
    const {createGraph,disposeGraph}=await import('/src/music/sound.ts');
    const {SceneSounds}=await import('/src/music/ambience.ts');
    const {SOUND_MAPS}=await import('/src/music/ambience-maps.ts');
    const {bedSegment}=await import('/src/session/session.ts');
    const rate=48000,seconds=80,seed=20260917,map=SOUND_MAPS.rain;
    const context=new OfflineAudioContext(2,seconds*rate,rate),graph=createGraph(context,new Map(),seed);
    graph.output.gain.value=1;graph.ambience.gain.value=1;
    const sounds=new SceneSounds(graph,'speakers');await sounds.prepare('rain',seed);
    const decodedBytes=sounds.diagnostics.decodedBytes;
    sounds.start('rain',seed,0,0,{spots:false});sounds.schedule(0,seconds);
    const buffer=await context.startRendering();
    // Loop seams: the step across each bed's wrap is an ordinary step for that recording.
    const seams=map.beds.map(bed=>{
      const data=graph.scenes.get('rain').get(bed.file).getChannelData(0),steps=[];
      for(let i=1;i<data.length;i++)steps.push(Math.abs(data[i]-data[i-1]));
      steps.sort((a,b)=>a-b);
      return {bed:bed.name,seam:Math.abs(data[0]-data[data.length-1]),p999:steps[Math.floor(steps.length*.999)]};
    });
    sounds.dispose();disposeGraph(graph);
    // Clicks: with every bed replaced by a 1 kHz tone of the same length, the mix is a tone whose amplitude moves slowly, so
    // no sample may step further than its slope allows. A source starting, stopping or looping out of place would.
    const tone=new OfflineAudioContext(2,seconds*rate,rate),toneGraph=createGraph(tone,new Map(),seed),toneSounds=new SceneSounds(toneGraph,'headphones');
    toneGraph.output.gain.value=1;toneGraph.ambience.gain.value=1;
    await toneSounds.prepare('rain',seed);
    for(const [file,real] of toneGraph.scenes.get('rain')){
      const sine=tone.createBuffer(real.numberOfChannels,real.length,rate);
      for(let c=0;c<real.numberOfChannels;c++){const data=sine.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=.5*Math.sin(2*Math.PI*1000*i/rate);}
      toneGraph.scenes.get('rain').set(file,sine);
    }
    toneSounds.start('rain',seed,0,0,{spots:false});toneSounds.schedule(0,seconds);
    const toned=await tone.startRendering();toneSounds.dispose();disposeGraph(toneGraph);
    let worstStep=0;
    for(let c=0;c<2;c++){const data=toned.getChannelData(c);for(let i=rate;i<data.length;i++){
      const peak=Math.max(Math.abs(data[i]),Math.abs(data[i-1]),Math.abs(data[i-12]??0),Math.abs(data[i+12]??0));
      worstStep=Math.max(worstStep,Math.abs(data[i]-data[i-1])/(peak*2*Math.PI*1000/rate+1e-9));
    }}
    // Swaps: 50 ms levels through each crossfade stay within the bed's own range.
    const L=buffer.getChannelData(0),swaps=map.beds.flatMap(bed=>Array.from({length:6},(_,i)=>bedSegment(seed,bed.name,i+1).start)).filter(t=>t>3&&t<seconds-3);
    const level=t=>{let p=0;const a=Math.floor(t*rate),n=rate*.05;for(let i=a;i<a+n;i++)p+=L[i]*L[i];return 10*Math.log10(p/n);};
    const levels=[];for(let t=2;t<seconds-1;t+=.05)levels.push(level(t));
    const sorted=[...levels].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
    const swapLevels=swaps.flatMap(t=>Array.from({length:84},(_,k)=>level(t-2.1+k*.05)));
    // After hours: the same evening levels at 5,000 and 9,000 seconds of listening.
    const held=[];
    for(const at of [3600,5000,9000]){const c=new OfflineAudioContext(2,rate,rate),g=createGraph(c,new Map(),seed),s=new SceneSounds(g,'speakers');await s.prepare('rain',seed);s.start('rain',seed,0,at,{spots:false});held.push(s.place.beds.map(b=>+b.level.gain.value.toFixed(4)));s.dispose();disposeGraph(g);}
    return {decodedBytes,seams,worstStep,median,swapMin:Math.min(...swapLevels),swapMax:Math.max(...swapLevels),held,evening:map.beds.map(b=>b.evening)};
  });
  assert.ok(offline.decodedBytes<=CAP,`decoded ${offline.decodedBytes} bytes`);
  for(const seam of offline.seams)assert.ok(seam.seam<=seam.p999,`${seam.bed}: loop seam step ${seam.seam} exceeds its 99.9th percentile ${seam.p999}`);
  assert.ok(offline.worstStep<1.1,`a bed swap or loop clicks: a step ${offline.worstStep.toFixed(2)}× the tone's slope`);
  assert.ok(offline.swapMin>offline.median-7&&offline.swapMax<offline.median+6,`swap levels ${offline.swapMin.toFixed(1)}…${offline.swapMax.toFixed(1)} dB around ${offline.median.toFixed(1)} dB`);
  assert.deepEqual(offline.held[1],offline.held[0]);assert.deepEqual(offline.held[2],offline.held[0]);
  assert.deepEqual(offline.held[0],offline.evening);
  results.push({name:'seamless swaps and loops, the cap, and evening held after hours',offline});
  // Each sound comes from where the painting puts it: rendered alone, its louder ear is on its side, on speakers and headphones.
  const directions=await page.evaluate(async()=>{
    const {createGraph,disposeGraph}=await import('/src/music/sound.ts');
    const {SceneSounds}=await import('/src/music/ambience.ts');
    const {SOUND_MAPS}=await import('/src/music/ambience-maps.ts');
    const full=SOUND_MAPS.rain,rate=48000,found=[];
    try {
      for(const space of ['speakers','headphones'])for(const sound of [...full.beds,...full.spots]) {
        SOUND_MAPS.rain={...full,beds:full.beds.filter(b=>b===sound),spots:full.spots.filter(s=>s===sound)};
        const seconds=sound.period?Math.min(150,sound.period*6):20;
        const context=new OfflineAudioContext(2,seconds*rate,rate),graph=createGraph(context,new Map(),1);
        graph.output.gain.value=1;graph.ambience.gain.value=1;
        const sounds=new SceneSounds(graph,space);await sounds.prepare('rain',20260917);sounds.start('rain',20260917,0,0);sounds.schedule(0,seconds);
        const buffer=await context.startRendering();sounds.dispose();disposeGraph(graph);
        const L=buffer.getChannelData(0),R=buffer.getChannelData(1);let l=0,r=0,lr=0;
        for(let i=0;i<L.length;i++){l+=L[i]*L[i];r+=R[i]*R[i];lr+=L[i]*R[i];}
        found.push({space,name:sound.name,azimuth:sound.position?.azimuth??null,ild:10*Math.log10(r/l),correlation:lr/Math.sqrt(l*r)});
      }
    } finally {SOUND_MAPS.rain=full;}
    return found;
  });
  for(const d of directions) {
    if(d.azimuth===null)assert.ok(Math.abs(d.correlation)<.3&&Math.abs(d.ild)<1.5,`${d.name} should surround the listener: ${JSON.stringify(d)}`);
    else if(Math.abs(d.azimuth)>=8)assert.ok(Math.sign(d.ild)===Math.sign(d.azimuth)&&Math.abs(d.ild)>=.5,`${d.name} on ${d.space} should be heard to the ${d.azimuth<0?'left':'right'}: ${d.ild.toFixed(1)} dB`);
  }
  results.push({name:'each sound comes from its side of the painting',directions});
  assert.deepEqual(errors,[]);
  mkdirSync('captures-ambience',{recursive:true});writeFileSync('captures-ambience/ambience-results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({name})=>name),null,2));
}finally{await browser.close();await server.close();}
