import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';

const base=process.env.MOTES_URL||'http://127.0.0.1:5175';
const browser=await chromium.launch(),errors=[],report={};
mkdirSync('captures-scenes',{recursive:true});
const ready=page=>page.waitForFunction(()=>window.__motes?.ready);
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const thumbnails=page=>page.locator('#scene-list img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
try {
  const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/?debug&day=2026-09-17&scene=rain&seed=2766115161&habitat=reef`);await ready(page);
  assert.equal(await page.evaluate(()=>window.__motes.radio.contextState),'uninitialized');
  await page.evaluate(()=>{window.__listenMutations=0;new MutationObserver(records=>{window.__listenMutations+=records.length;}).observe(document.querySelector('#listen'),{subtree:true,childList:true,characterData:true});});
  await page.waitForTimeout(850);
  assert.equal(await page.evaluate(()=>window.__listenMutations),0,'The idle player must not continually replace its label/icon.');
  assert.ok(!page.url().includes('habitat='));
  assert.equal(await page.getByRole('button',{name:'Explore',exact:true}).count(),0);
  for(const scene of ['rain','meadow','snow','coast']) {
    await page.evaluate(scene=>window.__motes.visit('2026-09-17',scene),scene);await ready(page);await settle(page);
    await page.screenshot({path:`captures-scenes/${scene}-desktop.png`});
  }
  report.fourScenes=true;
  const frozen=await page.locator('#scene').screenshot();await page.waitForTimeout(150);
  assert.ok(frozen.equals(await page.locator('#scene').screenshot()));report.reducedMotion=true;
  await page.click('#mix-toggle');await page.click('#motion');await page.keyboard.press('Escape');
  const moving=await page.locator('#scene').screenshot();await page.waitForTimeout(500);
  assert.ok(!moving.equals(await page.locator('#scene').screenshot()));report.livingScene=true;
  await page.click('#listen');await page.waitForFunction(()=>window.__motes.radio.playing);
  const song=await page.locator('#track-title').textContent();
  await page.click('#scenes-toggle');await page.click('[data-place="snow"]');await ready(page);
  assert.equal(await page.locator('#track-title').textContent(),song);report.sceneChangePreservesSong=true;
  await page.click('#next-track');assert.notEqual(await page.locator('#track-title').textContent(),song);
  await page.click('#mix-toggle');
  await page.locator('#music-volume').fill('42');await page.locator('#music-volume').dispatchEvent('input');
  await page.locator('#ambience-volume').fill('21');await page.locator('#ambience-volume').dispatchEvent('input');
  await page.selectOption('#music-mode','ambient');await page.waitForTimeout(1700);await page.screenshot({path:'captures-scenes/mix-desktop.png'});await page.keyboard.press('Escape');
  await page.click('#listen');await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__motes.radio.playing),false);
  await page.click('#listen');await page.waitForFunction(()=>window.__motes.radio.playing);
  const progress=await page.evaluate(()=>window.__motes.track.progress);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(()=>window.__motes.radio.playing),true);assert.ok(await page.evaluate(p=>window.__motes.track.progress>p,progress));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  report.radioContinuesThroughVisibilityEvent=true;
  await page.click('#quiet');assert.equal(await page.locator('#listen').isVisible(),false);assert.equal(await page.locator('#return-controls').isVisible(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#listen').isVisible(),true);report.immersiveMode=true;
  await page.click('#listen');await page.reload();await ready(page);
  await page.click('#mix-toggle');assert.equal(await page.inputValue('#music-volume'),'42');assert.equal(await page.inputValue('#music-mode'),'ambient');await page.keyboard.press('Escape');report.preferences=true;
  await page.click('#edition-toggle');await page.locator('#edition-date').fill('2026-09-18');await page.locator('#edition-date').dispatchEvent('change');await ready(page);
  const edition=await page.evaluate(()=>window.__motes.edition);await page.reload();await ready(page);
  assert.equal(new URL(page.url()).searchParams.has('scene'),false,'Daily editions must not pin yesterday’s scene in the URL.');
  assert.deepEqual(await page.evaluate(()=>window.__motes.edition),edition);report.revisitableDates=true;
  await page.click('#scenes-toggle');await thumbnails(page);await settle(page);await page.screenshot({path:'captures-scenes/places-desktop.png'});await page.keyboard.press('Escape');
  assert.ok((await page.evaluate(()=>window.__motes.rendering)).images<=4);

  const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  phone.on('pageerror',error=>errors.push(error.message));
  await phone.goto(`${base}/?debug&day=2026-09-17`);await ready(phone);
  for(const scene of ['rain','meadow','snow','coast']) {
    await phone.evaluate(scene=>window.__motes.visit('2026-09-17',scene),scene);await ready(phone);await settle(phone);
    assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await phone.screenshot({path:`captures-scenes/${scene}-mobile.png`});
  }
  for(const panel of ['mix','scenes','edition']) {
    await phone.click(`#${panel}-toggle`);const box=await phone.locator(`#${panel}-panel`).boundingBox();
    if(panel==='scenes'){await thumbnails(phone);await settle(phone);}
    assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=391&&box.y+box.height<=845);
    await phone.screenshot({path:`captures-scenes/${panel}-mobile.png`});await phone.keyboard.press('Escape');
  }report.mobile=true;

  const fallback=await browser.newPage({reducedMotion:'reduce'});
  fallback.on('pageerror',error=>errors.push(error.message));
  await fallback.route('**/scenes/*.png',route=>route.abort());await fallback.goto(`${base}/?debug`);
  await fallback.waitForFunction(()=>window.__motes?.failed);assert.equal(await fallback.locator('#retry-art').isVisible(),true);
  await fallback.unroute('**/scenes/*.png');await fallback.click('#retry-art');await ready(fallback);await settle(fallback);
  assert.equal(await fallback.locator('#art-status').isVisible(),false);report.artRetry=true;
  const rejected=await browser.newPage({reducedMotion:'reduce'});
  await rejected.addInitScript(()=>{const resume=AudioContext.prototype.resume;let failed=false;AudioContext.prototype.resume=function(){if(!failed){failed=true;return Promise.reject(new Error('Blocked playback'));}return resume.call(this);};});
  await rejected.goto(`${base}/?debug`);await ready(rejected);await rejected.click('#listen');await rejected.waitForFunction(()=>!document.querySelector('#status').hidden);
  assert.equal(await rejected.evaluate(()=>window.__motes.radio.playing),false);await rejected.click('#listen');await rejected.waitForFunction(()=>window.__motes.radio.playing);report.audioRetry=true;
  const calendar=await browser.newPage({reducedMotion:'reduce'});
  await calendar.addInitScript(()=>{
    const OriginalDate=Date;window.__calendarNow=new OriginalDate(2026,8,17,23,59).getTime();
    window.Date=class extends OriginalDate {constructor(...args){if(args.length)super(...args);else super(window.__calendarNow);}static now(){return window.__calendarNow;}};
  });
  await calendar.goto(`${base}/?debug`);await ready(calendar);await calendar.click('#listen');await calendar.waitForFunction(()=>window.__motes.radio.playing);
  const beforeMidnight=await calendar.evaluate(()=>({edition:window.__motes.edition,track:window.__motes.track.title}));
  await calendar.evaluate(()=>{window.__calendarNow+=86400000;});await calendar.locator('#new-day').waitFor({state:'visible'});
  assert.deepEqual(await calendar.evaluate(()=>window.__motes.edition),beforeMidnight.edition);
  assert.equal(await calendar.evaluate(()=>window.__motes.radio.playing),true);
  await calendar.click('#new-day');await ready(calendar);
  assert.equal(await calendar.evaluate(()=>window.__motes.edition.day),'2026-09-18');
  assert.notEqual(await calendar.evaluate(()=>window.__motes.edition.scene),beforeMidnight.edition.scene);
  assert.equal(await calendar.evaluate(()=>window.__motes.track.title),beforeMidnight.track);
  assert.equal(new URL(calendar.url()).searchParams.has('scene'),false);assert.equal(new URL(calendar.url()).searchParams.has('day'),false);
  report.midnightKeepsSessionUntilInvited=true;
  assert.deepEqual(errors,[]);report.errors=errors;
  writeFileSync('captures-scenes/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
