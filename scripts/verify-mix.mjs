import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const style=process.argv[2]==='synthwave'?'synthwave':'lofi';
// An optional place (`node scripts/verify-mix.mjs lofi rain`) measures just that one while calibrating.
const only=['rain','meadow','snow','coast'].includes(process.argv[3])?[process.argv[3]]:['rain','meadow','snow','coast'];

// Measure each instrumental colour, including the quieter late-session tracks.
// This catches a loud continuous texture even when the combined mix never clips.
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'mix-test',configureServer(server){server.middlewares.use('/__mix_test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Mix balance checks</title>');});}}]});
await server.listen();
const browser=await chromium.launch({channel:'chromium'});
try {
  const page=await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]+'__mix_test');
  const report=await page.evaluate(async({style,only})=>{
    const {DEFAULT_MIX,createGraph,loadPiano,scheduleNote,setSoundMode,startAmbience,disposeGraph}=await import('/src/music/sound.ts');
    const {SceneSounds}=await import('/src/music/ambience.ts');
    const {createSession,composeSessionTrack}=await import('/src/session/session.ts');
    const {edition}=await import('/src/scenes/edition.ts');
    const sampleRate=44100,seconds=48;
    const bank=style==='lofi'?await loadPiano(new OfflineAudioContext(2,1,sampleRate)):new Map();
    // Layers: the music alone; the scene sounds at arrival or in the settled evening; or their spots alone (over a longer stretch, so every family plays).
    const render=async(seed,mood,mode,layer,index=0,space='speakers')=>{
      const length=layer.startsWith('spots')?300:seconds,music=layer==='music';
      const context=new OfflineAudioContext(2,length*sampleRate,sampleRate);
      const graph=createGraph(context,bank,seed),track=composeSessionTrack(createSession(seed,mood,style),index);
      graph.output.gain.value=1;
      graph.music.gain.value=music?DEFAULT_MIX.music:0;
      // Exercise the loudest weather level the live scheduler permits.
      graph.ambience.gain.value=music?0:DEFAULT_MIX.ambience*1.12;
      setSoundMode(graph,mode);
      const sounds=new SceneSounds(graph,space);
      if(!music) {
        // Places without recordings keep their synthesised bed, as live.
        if(await sounds.prepare(mood,seed)) {
          sounds.start(mood,seed,0,layer.endsWith('evening')?3000:0,{spots:layer!=='atmosphere-beds',beds:!layer.startsWith('spots')});
          sounds.schedule(0,length);
        }else if(!layer.startsWith('spots'))startAmbience(graph,mood,0);
      }
      // Match the player's bounded look-ahead instead of allocating every echo
      // in a 48-second score before rendering its first sample.
      let cursor=0;
      const scheduleThrough=until=>{
        if(!music)return;
        while(cursor<track.events.length){
          const event=track.events[cursor],at=0.05+event.beat*60/track.bpm;
          if(at>=Math.min(until,length))break;
          scheduleNote(graph,event,at,60/track.bpm);cursor++;
        }
      };
      scheduleThrough(6);
      let suspended=context.suspend(4);
      const rendered=context.startRendering();
      for(let time=4;time<length;time+=4){
        await suspended;scheduleThrough(time+6);
        if(time+4<length)suspended=context.suspend(time+4);
        await context.resume();
      }
      const buffer=await rendered;sounds.dispose();disposeGraph(graph);
      const rms=(from,to)=>{
        let power=0,count=0;
        for(let channel=0;channel<2;channel++){
          const data=buffer.getChannelData(channel);
          for(let i=Math.floor(from*sampleRate);i<Math.floor(to*sampleRate);i++){power+=data[i]*data[i];count++;}
        }
        return Math.sqrt(power/count);
      };
      let peak=0;
      for(let channel=0;channel<2;channel++)for(const value of buffer.getChannelData(channel))peak=Math.max(peak,Math.abs(value));
      // The sparsest passage: the music's quietest six seconds after its first.
      let sparse={from:1,rms:Infinity};
      for(let from=1;from+6<=Math.min(45,length);from+=.5){const value=rms(from,from+6);if(value<sparse.rms)sparse={from,rms:value};}
      // The loudest 400 ms anywhere (for spots).
      let loudest=0;for(let from=0;from+.4<=length;from+=.1)loudest=Math.max(loudest,rms(from,from+.4));
      return {opening:rms(1,12),theme:rms(30,45),sparse,window:(from,to)=>rms(from,to),loudest,peak,voice:track.voice};
    };
    const results=[];
    const dB=(a,b)=>20*Math.log10(a/b);
    for(const mood of only){
      const seed=edition('2026-09-18',mood).seed;
      // Recorded places are measured at arrival and in the evening, through speakers and headphones; the louder counts.
      const spaces=mood==='rain'?['speakers','headphones']:['speakers'];
      const atmospheres=[];
      for(const space of spaces)for(const layer of mood==='rain'?['atmosphere','atmosphere-evening']:['atmosphere'])atmospheres.push(await render(seed,mood,'beats',layer,0,space));
      const spots=mood==='rain'?[]:undefined;
      if(spots)for(const space of spaces)for(const layer of ['spots','spots-evening'])spots.push(await render(seed,mood,'beats',layer,0,space));
      const loudestSpot=spots?Math.max(...spots.map(s=>s.loudest)):0;
      for(const mode of ['beats','ambient']){
        for(const index of style==='synthwave'?[0,1,2,3,16,17,18]:[0,1,3,6,9,10,17]){
          const music=await render(seed,mood,mode,'music',index);
          const worst=(pick)=>Math.max(...atmospheres.map(pick));
          results.push({mood,mode,index,voice:music.voice,music:{opening:music.opening,theme:music.theme,peak:music.peak,sparse:music.sparse},
            atmosphere:{opening:worst(a=>a.opening)},
            openingDb:dB(worst(a=>a.opening),music.opening),themeDb:dB(worst(a=>a.theme),music.theme),
            sparseDb:dB(worst(a=>a.window(music.sparse.from,music.sparse.from+6)),music.sparse.rms),
            spotDb:spots?dB(loudestSpot,Math.min(music.opening,music.theme)):null});
        }
      }
    }
    return results;
  },{style,only});
  const output=style==='synthwave'?'captures-synthwave':'captures-music';
  mkdirSync(output,{recursive:true});
  writeFileSync(`${output}/mix-balance.json`,JSON.stringify(report,null,2));
  console.table(report.map(({mood,mode,index,voice,openingDb,themeDb,sparseDb,spotDb,music})=>({mood,mode,index,voice,openingDb:openingDb.toFixed(1),themeDb:themeDb.toFixed(1),sparseDb:sparseDb.toFixed(1),spotDb:spotDb===null?'—':spotDb.toFixed(1),peak:music.peak.toFixed(3)})));
  for(const result of report){
    assert.ok(result.openingDb<=-18,`${result.mood}/${result.mode}: atmosphere must sit at least 18 dB below the quiet opening (${result.openingDb.toFixed(1)} dB)`);
    assert.ok(result.themeDb<=-18,`${result.mood}/${result.mode}: atmosphere must sit at least 18 dB below the theme (${result.themeDb.toFixed(1)} dB)`);
    assert.ok(result.sparseDb<=-18,`${result.mood}/${result.mode}/${result.index}: atmosphere must sit at least 18 dB below the sparsest passage (${result.sparseDb.toFixed(1)} dB)`);
    // A drip, the gutter or a passing car should never startle: its loudest 400 ms stays 10 dB under the music.
    if(result.spotDb!==null)assert.ok(result.spotDb<=-10,`${result.mood}/${result.mode}/${result.index}: a scene sound spot rises to ${result.spotDb.toFixed(1)} dB of the music`);
    assert.ok(result.atmosphere.opening>0.00005,'The atmosphere should still be audible, not muted.');
    assert.ok(result.music.peak<0.9,`${result.mood}/${result.voice}: music needs headroom.`);
  }
}finally{await browser.close();await server.close();}
