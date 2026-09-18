import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

// Measure rendered stems, including the quieter opening and piano-only setting.
// This catches a loud continuous texture even when the combined mix never clips.
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({channel:'chromium'});
try {
  const page=await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);
  const report=await page.evaluate(async()=>{
    const {DEFAULT_MIX,createGraph,loadPiano,scheduleNote,setSoundMode,startAmbience,disposeGraph}=await import('/src/music/sound.ts');
    const {composeTrack}=await import('/src/music/composer.ts');
    const {edition}=await import('/src/scenes/edition.ts');
    const sampleRate=44100,seconds=48;
    const bank=await loadPiano(new OfflineAudioContext(2,1,sampleRate));
    const render=async(seed,mood,mode,layer)=>{
      const context=new OfflineAudioContext(2,seconds*sampleRate,sampleRate);
      const graph=createGraph(context,bank,seed),track=composeTrack(seed,mood);
      graph.output.gain.value=1;
      graph.music.gain.value=layer==='atmosphere'?0:DEFAULT_MIX.music;
      graph.ambience.gain.value=layer==='music'?0:DEFAULT_MIX.ambience;
      setSoundMode(graph,mode);
      if(layer!=='music')startAmbience(graph,mood,0);
      if(layer!=='atmosphere')for(const event of track.events){
        const at=0.05+event.beat*60/track.bpm;
        if(at<seconds)scheduleNote(graph,event,at,60/track.bpm);
      }
      const buffer=await context.startRendering();disposeGraph(graph);
      const rms=(from,to)=>{
        let power=0,count=0;
        for(let channel=0;channel<2;channel++){
          const data=buffer.getChannelData(channel);
          for(let i=Math.floor(from*sampleRate);i<Math.floor(to*sampleRate);i++){power+=data[i]*data[i];count++;}
        }
        return Math.sqrt(power/count);
      };
      return {opening:rms(1,12),theme:rms(30,45)};
    };
    const results=[];
    for(const mood of ['rain','meadow','snow','coast']){
      const seed=edition('2026-09-18',mood).seed;
      const atmosphere=await render(seed,mood,'beats','atmosphere');
      for(const mode of ['beats','ambient']){
        const music=await render(seed,mood,mode,'music');
        results.push({mood,mode,atmosphere,music,openingDb:20*Math.log10(atmosphere.opening/music.opening),themeDb:20*Math.log10(atmosphere.theme/music.theme)});
      }
    }
    return results;
  });
  mkdirSync('captures-music',{recursive:true});
  writeFileSync('captures-music/mix-balance.json',JSON.stringify(report,null,2));
  console.table(report.map(({mood,mode,openingDb,themeDb})=>({mood,mode,openingDb:openingDb.toFixed(1),themeDb:themeDb.toFixed(1)})));
  for(const result of report){
    assert.ok(result.openingDb<=-18,`${result.mood}/${result.mode}: atmosphere must sit at least 18 dB below the quiet opening (${result.openingDb.toFixed(1)} dB)`);
    assert.ok(result.themeDb<=-18,`${result.mood}/${result.mode}: atmosphere must sit at least 18 dB below the theme (${result.themeDb.toFixed(1)} dB)`);
    assert.ok(result.atmosphere.opening>0.00005,'The atmosphere should still be audible, not muted.');
  }
}finally{await browser.close();await server.close();}
