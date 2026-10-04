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
  // Screen readers hear each stage once: record every change to the live region's text.
  await desktop.evaluate(()=>{window.__announced=[];new MutationObserver(records=>{for(const record of records)window.__announced.push(record.type==='characterData'?record.target.textContent:[...record.addedNodes].map(node=>node.textContent).join(''));}).observe(document.querySelector('#clip-status'),{childList:true,characterData:true,subtree:true});});
  await desktop.click('#make-clip');
  await desktop.waitForFunction(()=>/^Painting the evening… \d+%$/.test(document.querySelector('.clip-status').innerText.trim()),null,{timeout:60000});
  // Working keeps focus on the action, so Space can't reach the page and pause the music.
  assert.deepEqual(await desktop.evaluate(()=>[document.activeElement?.id,document.activeElement?.getAttribute('aria-disabled')]),['make-clip','true']);
  await desktop.keyboard.press('Space');
  await finished(desktop);
  assert.ok(await desktop.evaluate(t=>window.__motes.radio.playing&&window.__motes.radio.ticks>t+8,ticks),'the radio keeps scheduling during an export');
  const announced=await desktop.evaluate(()=>window.__announced);
  assert.deepEqual(announced,['Preparing the painting…','Recording the music…','Painting the evening…','Your clip is ready.']);
  report.announcements=announced.length;
  const longest=await desktop.evaluate(()=>window.__longest);assert.ok(longest<250,`longest task during export ${longest}ms`);
  assert.equal((await desktop.textContent('#clip-deliver-label')).trim(),'Save clip');
  const [download]=await Promise.all([desktop.waitForEvent('download'),desktop.click('#clip-deliver')]);
  assert.equal(download.suggestedFilename(),`motes-neon-rain-${day}.mp4`);
  await download.saveAs(`captures/clips/panel-${download.suggestedFilename()}`);
  const saved=await inspectClip(`captures/clips/panel-${download.suggestedFilename()}`);
  assert.ok(Math.abs(saved.duration-15)<=.05&&saved.frames===450,'the panel saves a full clip');
  report.panelSave=true;report.longestTaskMs=Math.round(longest);

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
  assert.ok(shared.files[0].size>1e6);report.phoneShare=true;
  // A second tap while the sheet is still open is ignored, not turned into a download.
  await phone.evaluate(()=>{
    window.__shares=0;window.__downloads=0;const create=URL.createObjectURL;URL.createObjectURL=blob=>{window.__downloads++;return create(blob);};
    navigator.share=()=>{window.__shares++;return new Promise((_,reject)=>setTimeout(()=>reject(new DOMException('Share canceled','AbortError')),1000));};
  });
  await phone.click('#clip-deliver');await phone.click('#clip-deliver');await phone.waitForTimeout(1300);
  assert.deepEqual(await phone.evaluate(()=>[window.__shares,window.__downloads]),[1,0],'a second tap while sharing does nothing');
  report.shareTwice=true;await phone.close();

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
  await openShare(offline);await offline.focus('#make-clip');await offline.keyboard.press('Enter');
  await offline.waitForFunction(()=>document.querySelector('#clip-make-label')?.textContent==='Try again',null,{timeout:60000});
  assert.match(await offline.textContent('#clip-status'),/painting couldn’t load for the clip/);
  assert.equal(await offline.isEnabled('#make-clip'),true);
  assert.equal(await offline.evaluate(()=>document.activeElement?.id),'make-clip','focus returns to Try again');
  report.paintingFailure=true;await offline.close();

  // A tab left open across a deploy can't fetch the clip code; it asks for a reload instead of a hopeless Try again.
  const stale=await browser.newPage();stale.on('pageerror',error=>errors.push(error.message));
  await stale.route(/\/src\/clip\/export\.ts/,route=>route.abort());
  await stale.goto(`${base}/places/neon-rain/?day=${day}&debug`);await ready(stale);
  await openShare(stale);await stale.focus('#make-clip');await stale.keyboard.press('Enter');
  await stale.waitForFunction(()=>document.querySelector('#clip-make-label')?.textContent==='Try again',null,{timeout:60000});
  assert.equal((await stale.textContent('#clip-status')).trim(),'Motes has been updated. Reload the page to make a clip.');
  assert.equal(await stale.isEnabled('#make-clip'),true);
  assert.equal(await stale.evaluate(()=>document.activeElement?.id),'make-clip');
  report.updatedCode=true;await stale.close();
} finally {await browser.close();await server.close();}
report.errors=errors;
console.log(JSON.stringify(report,null,1));
assert.deepEqual(errors,[]);
