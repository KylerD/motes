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
