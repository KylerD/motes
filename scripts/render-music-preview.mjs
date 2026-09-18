import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const seconds=Number(process.argv[2]||'90');
const output=resolve(process.argv[3]||'captures-music/warm-jazz-preview.wav');
const seed=Number(process.argv[4]||'20260917');
const mood=process.argv[5]||'rain';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'music-preview',configureServer(server){server.middlewares.use('/__music_preview',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Motes music preview</title>');});}}]});
await server.listen();
const browser=await chromium.launch({channel:'chromium'});
try {
  const page=await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]+'__music_preview');
  const result=await page.evaluate(async({seconds,seed,mood})=>{
    const {renderPreview}=await import('/src/music/audio.ts');
    const {buffer,track}=await renderPreview({seconds,seed,mood,mode:'beats'});
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    let peak=0,power=0,clipped=0;
    const blockRms=[];
    for(let offset=0;offset<buffer.length;offset+=buffer.sampleRate) {
      let block=0,count=0;
      for(let frame=offset;frame<Math.min(offset+buffer.sampleRate,buffer.length);frame++) {
        for(const channel of channels) {const v=channel[frame];peak=Math.max(peak,Math.abs(v));power+=v*v;block+=v*v;count++;if(Math.abs(v)>=0.999)clipped++;}
      }
      blockRms.push(Math.sqrt(block/count));
    }
    const wav=new ArrayBuffer(44+buffer.length*buffer.numberOfChannels*2),view=new DataView(wav);
    const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,buffer.numberOfChannels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*buffer.numberOfChannels*2,true);view.setUint16(32,buffer.numberOfChannels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,wav.byteLength-44,true);
    for(let frame=0;frame<buffer.length;frame++)for(let ch=0;ch<channels.length;ch++)view.setInt16(44+(frame*channels.length+ch)*2,Math.max(-32768,Math.min(32767,Math.round(channels[ch][frame]*32767))),true);
    const bytes=new Uint8Array(wav);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {wav:btoa(binary),report:{seconds,sampleRate:buffer.sampleRate,peak,rms:Math.sqrt(power/(buffer.length*channels.length)),clipped,blockRms,title:track.title,bpm:track.bpm,key:track.key,events:track.events.length}};
  },{seconds,seed,mood});
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,Buffer.from(result.wav,'base64'));
  writeFileSync(output.replace(/\.wav$/,'.json'),JSON.stringify(result.report,null,2));
  console.log(JSON.stringify({output,...result.report},null,2));
  if(result.report.clipped!==0||result.report.peak<0.03||result.report.rms<0.005)throw new Error('Preview has clipped or unexpectedly silent audio');
} finally {await browser.close();await server.close();}
