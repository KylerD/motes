import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const style=process.argv[2]==='dreamy'?'dreamy':undefined;
const lofiPlaces=['rain','meadow','snow','coast'];
// Each style keeps its calibration: lofi in its own places and at Top deck, driving at Top deck and on the coast (its worst place away), or the dreamy sweep with Top deck added.
const runs=style==='dreamy'
  ?[...lofiPlaces,'deck'].map(mood=>[mood,'dreamy',[0,1,2,3,16,17,18]])
  :[...lofiPlaces.map(mood=>[mood,'lofi',[0,1,3,6,9,10,17]]),['deck','lofi',[0,1,3,6,9,10,17]],['deck','driving',[0,1,3,6,7,9,10,16,17]],['coast','driving',[0,1,7,16,17]]];

// Measure each instrumental colour, including the quieter late-session tracks.
// This catches a loud continuous texture even when the combined mix never clips.
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'mix-test',configureServer(server){server.middlewares.use('/__mix_test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Mix balance checks</title>');});}}]});
await server.listen();
const browser=await chromium.launch({channel:'chromium'});
try {
  const page=await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]+'__mix_test');
  const report=await page.evaluate(async(runs)=>{
    const {DEFAULT_MIX,createGraph,prepareBank,schedule,setSoundMode,startAmbience,disposeGraph}=await import('/src/music/sound.ts');
    const {STYLES,atmosphereLevel}=await import('/src/music/styles/index.ts');
    const {placeById}=await import('/src/places/index.ts');
    const {createSession,composeSessionTrack}=await import('/src/session/session.ts');
    const {edition}=await import('/src/scenes/edition.ts');
    const sampleRate=44100;
    const render=async(seed,mood,runStyle,mode,layer,index=0,seconds=48)=>{
      const context=new OfflineAudioContext(2,seconds*sampleRate,sampleRate);
      const graph=createGraph(context,seed),track=composeSessionTrack(createSession(seed,mood,runStyle),index);
      await prepareBank(graph,STYLES[track.style??'lofi']);
      graph.output.gain.value=1;
      graph.music.gain.value=layer==='atmosphere'?0:DEFAULT_MIX.music;
      // Exercise the loudest weather level the live scheduler permits, at the player's level for this style here.
      graph.ambience.gain.value=layer==='music'?0:DEFAULT_MIX.ambience*1.12*atmosphereLevel(placeById(mood),runStyle);
      setSoundMode(graph,mode);
      if(layer!=='music')startAmbience(graph,placeById(mood),0);
      let rendered;
      if(runStyle==='dreamy'){
        // Match the player's bounded look-ahead instead of allocating every echo
        // in a 48-second score before rendering its first sample.
        let cursor=0;
        const scheduleThrough=until=>{
          if(layer==='atmosphere')return;
          while(cursor<track.events.length){
            const event=track.events[cursor],at=0.05+event.beat*60/track.bpm;
            if(at>=Math.min(until,seconds))break;
            schedule(graph,event,at,60/track.bpm,track);cursor++;
          }
        };
        scheduleThrough(6);
        let suspended=context.suspend(4);
        rendered=context.startRendering();
        for(let time=4;time<seconds;time+=4){
          await suspended;scheduleThrough(time+6);
          if(time+4<seconds)suspended=context.suspend(time+4);
          await context.resume();
        }
      }else{
        if(layer!=='atmosphere')for(const event of track.events){
          const at=0.05+event.beat*60/track.bpm;
          if(at<seconds)schedule(graph,event,at,60/track.bpm,track);
        }
        rendered=context.startRendering();
      }
      const buffer=await rendered;disposeGraph(graph);
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
      // A drumless break, where the render reaches one.
      const gap=track.sections.find(s=>s.role==='break'),at=bar=>0.05+bar*240/track.bpm;
      return {opening:rms(1,12),theme:rms(30,45),drumless:gap&&at(gap.endBar)<=seconds?rms(at(gap.startBar)+1,at(gap.endBar)-1):undefined,peak,voice:track.voice};
    };
    const results=[];
    for(const [mood,runStyle,indices] of runs){
      // A synth hour also measures its opening song's first break (about 105 s in), the slow burner at 7 and its loudest song, 16.
      const seed=edition('2026-09-18',mood).seed,synth=runStyle==='driving';
      const atmosphere=await render(seed,mood,runStyle,'beats','atmosphere',0,synth?130:48);
      for(const mode of ['beats','ambient']){
        for(const index of indices){
          const music=await render(seed,mood,runStyle,mode,'music',index,synth&&index===0?130:48);
          results.push({mood,style:runStyle,mode,index,synth,voice:music.voice,atmosphere,music,openingDb:20*Math.log10(atmosphere.opening/music.opening),themeDb:20*Math.log10(atmosphere.theme/music.theme),
            breakDb:music.drumless&&20*Math.log10(atmosphere.drumless/music.drumless)});
        }
      }
    }
    return results;
  },runs);
  const output=style==='dreamy'?'captures-synthwave':'captures-music';
  mkdirSync(output,{recursive:true});
  writeFileSync(`${output}/mix-balance.json`,JSON.stringify(report,null,2));
  console.table(report.map(({mood,mode,index,voice,openingDb,themeDb,breakDb,music})=>({mood,mode,index,voice,openingDb:openingDb.toFixed(1),themeDb:themeDb.toFixed(1),breakDb:breakDb?.toFixed(1)??'',theme:music.theme.toFixed(4),peak:music.peak.toFixed(3)})));
  assert.ok(report.filter(r=>r.synth&&r.index===0).every(r=>Number.isFinite(r.breakDb)),'Each synth hour\'s opening render must reach and measure its drumless break.');
  for(const result of report){
    assert.ok(result.openingDb<=-18,`${result.mood}/${result.mode}: atmosphere must sit at least 18 dB below the quiet opening (${result.openingDb.toFixed(1)} dB)`);
    assert.ok(result.themeDb<=-18,`${result.mood}/${result.mode}: atmosphere must sit at least 18 dB below the theme (${result.themeDb.toFixed(1)} dB)`);
    assert.ok(result.atmosphere.opening>0.00005,'The atmosphere should still be audible, not muted.');
    if(result.breakDb!==undefined)assert.ok(result.breakDb<=-18,`${result.mood}/${result.mode}: atmosphere must sit at least 18 dB below the drumless break (${result.breakDb.toFixed(1)} dB)`);
    assert.ok(result.music.peak<0.9,`${result.mood}/${result.voice}: music needs headroom.`);
  }
  // No loudness jump between places: a synth hour's sunset, loudest and darkest songs sit within 1.5 dB of the lofi places' median opening song.
  const themes=report.filter(r=>r.style==='lofi'&&lofiPlaces.includes(r.mood)&&r.mode==='beats'&&r.index===0).map(r=>r.music.theme).sort((a,b)=>a-b);
  const median=(themes[(themes.length-1)>>1]+themes[themes.length>>1])/2;
  for(const result of report.filter(r=>r.synth&&r.mode==='beats'&&[0,16,17].includes(r.index))){
    const db=20*Math.log10(result.music.theme/median);console.log(`${result.mood} ${result.index}: theme ${db.toFixed(2)} dB from the lofi median`);
    assert.ok(Math.abs(db)<=1.5,`${result.mood} ${result.index}: theme must sit within 1.5 dB of the lofi median (${db.toFixed(2)} dB)`);
  }
}finally{await browser.close();await server.close();}
