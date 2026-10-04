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
