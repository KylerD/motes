import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

// The small window (Document Picture-in-Picture) holds the scene's own canvas: it opens from the
// header, keeps painting while the page is hidden, plays and pauses, and always gives the canvas back.
const base=process.env.MOTES_URL||'http://127.0.0.1:5175';
const browser=await chromium.launch(),errors=[],report={};
mkdirSync('captures-small-window',{recursive:true});
const url=`${base}/?debug&day=2026-09-17&scene=rain`;
const ready=page=>page.waitForFunction(()=>window.__motes?.ready);
const inSmallWindow=page=>page.waitForFunction(()=>documentPictureInPicture.window?.document.getElementById('scene'));
const onPage=page=>page.waitForFunction(()=>!documentPictureInPicture.window&&document.querySelector('#experience > #scene')&&document.querySelector('#experience').dataset.away==='false');
const advancing=async(page,ms=700)=>{const before=await page.evaluate(()=>window.__motes.time);await page.waitForTimeout(ms);return await page.evaluate(()=>window.__motes.time)>before;};
// Playwright keeps every page visible, so a hidden tab is simulated where the page reads it.
const setHidden=(page,hidden)=>page.evaluate(hidden=>{
  if(hidden)Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});else delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));
},hidden);
const smallListen=(page,action)=>page.evaluate(action=>{const button=documentPictureInPicture.window.document.querySelector('.small-window-listen');return action==='click'?button.click():button.getAttribute(action);},action);
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await ready(page);
  const toggle=page.locator('#small-window-toggle');
  assert.ok(await toggle.isVisible());
  assert.equal(await toggle.getAttribute('aria-label'),'Keep this place in a small window');
  await page.screenshot({path:'captures-small-window/header-desktop.png',clip:{x:840,y:0,width:600,height:110}});
  await setHidden(page,true);assert.ok(!await advancing(page),'A hidden tab paints nothing while the place is on the page.');
  await setHidden(page,false);report.headerAction=true;

  await toggle.click();await inSmallWindow(page);
  const opened=await page.evaluate(()=>{const small=documentPictureInPicture.window;return {title:small.document.title,lang:small.document.documentElement.lang,onPage:!!document.getElementById('scene')};});
  assert.deepEqual(opened,{title:'Neon rain · Motes',lang:'en',onPage:false});
  assert.equal(await page.getAttribute('#experience','data-away'),'true');
  assert.ok(await page.locator('#away').isVisible());assert.ok(!await page.locator('#art-status').isVisible());
  assert.ok(!await page.locator('#fullscreen').isVisible());assert.ok(!await page.locator('#quiet').isVisible());
  assert.equal(await toggle.getAttribute('aria-label'),'Bring this place back');
  await page.screenshot({path:'captures-small-window/away-desktop.png'});
  // Playwright gives the small window the page's viewport; set it to the size Motes asks for.
  // That also proves the canvas follows a resized window.
  const smallPage=page.context().pages().find(other=>other!==page);
  if(smallPage) {
    await smallPage.setViewportSize({width:512,height:288});
    await page.waitForFunction(()=>window.__motes.rendering.box.join()==='512,288');
    await page.waitForTimeout(300);await smallPage.screenshot({path:'captures-small-window/small-window.png'});
  }
  report.screenshotOfSmallWindow=!!smallPage;
  // The canvas paints at the small window's size and keeps moving while its tab is hidden.
  await page.waitForFunction(()=>{const small=documentPictureInPicture.window,[width,height]=window.__motes.rendering.box;return Math.abs(width-small.innerWidth)<=1&&Math.abs(height-small.innerHeight)<=1;});
  await setHidden(page,true);
  assert.ok(await advancing(page),'The small window keeps painting while its tab is hidden.');
  report.paintsWhileTabHidden=true;

  assert.equal(await smallListen(page,'aria-label'),'Listen to music');
  await smallListen(page,'click');await page.waitForFunction(()=>window.__motes.radio.playing);
  await page.waitForFunction(()=>documentPictureInPicture.window.document.querySelector('.small-window-listen').getAttribute('aria-pressed')==='true');
  assert.equal(await smallListen(page,'aria-label'),'Pause music');
  // While playing, the control steps aside until the pointer or keyboard comes to it.
  if(smallPage) {
    // The pointer hasn't entered the small window yet.
    await smallPage.evaluate(()=>document.activeElement?.blur());
    await smallPage.waitForFunction(()=>getComputedStyle(document.querySelector('.small-window-listen')).opacity==='0');
    await smallPage.screenshot({path:'captures-small-window/small-window-playing.png'});
    await smallPage.mouse.move(256,144);
    await smallPage.waitForFunction(()=>getComputedStyle(document.querySelector('.small-window-listen')).opacity==='1');
    report.controlStepsAside=true;
  }
  await page.evaluate(()=>documentPictureInPicture.window.document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true})));
  await page.waitForFunction(()=>!window.__motes.radio.playing);
  assert.equal(await smallListen(page,'aria-label'),'Listen to music');
  report.listensFromSmallWindow=true;

  // Another place while away: the small window follows it.
  await page.evaluate(()=>window.__motes.visit('2026-09-17','snow'));await ready(page);
  assert.equal(await page.evaluate(()=>documentPictureInPicture.window.document.title),'Last light station · Motes');
  assert.ok(await advancing(page));report.changesPlaceWhileAway=true;

  // Bring it back from the page's card, by keyboard: focus moves to the header action.
  await setHidden(page,false);
  await page.focus('#bring-back');await page.keyboard.press('Enter');await onPage(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'small-window-toggle');
  assert.equal(await toggle.getAttribute('aria-label'),'Keep this place in a small window');
  assert.ok(await page.locator('#fullscreen').isVisible());assert.ok(!await page.locator('#away').isVisible());
  await page.waitForFunction(()=>Math.abs(window.__motes.rendering.box[0]-innerWidth)<=1&&Math.abs(window.__motes.rendering.box[1]-innerHeight)<=1);
  assert.ok(await advancing(page));report.bringsBack=true;

  // The header action closes it too, and so does closing the window itself.
  await toggle.click();await inSmallWindow(page);await toggle.click();await onPage(page);
  await toggle.click();await inSmallWindow(page);await page.evaluate(()=>documentPictureInPicture.window.close());await onPage(page);
  assert.ok(await advancing(page));report.closesEveryWay=true;

  // A refusal leaves the place on the page and says so.
  await page.evaluate(()=>{documentPictureInPicture.requestWindow=()=>Promise.reject(new DOMException('Refused.','NotAllowedError'));});
  await toggle.click();await page.waitForSelector('#status:not([hidden])');
  assert.match(await page.textContent('#status'),/small window couldn’t open/);
  assert.equal(await page.getAttribute('#experience','data-away'),'false');
  assert.equal(await page.evaluate(()=>document.getElementById('scene')?.parentElement?.id),'experience');
  report.refusal=true;

  const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  phone.on('pageerror',error=>errors.push(error.message));
  await phone.goto(url);await ready(phone);
  assert.ok(!await phone.locator('#small-window-toggle').isVisible(),'Phones keep today’s header.');
  await phone.screenshot({path:'captures-small-window/header-phone.png',clip:{x:0,y:0,width:390,height:110}});
  report.phoneHeaderUnchanged=true;

  const unsupported=await browser.newPage({viewport:{width:1440,height:900}});
  await unsupported.addInitScript(()=>Object.defineProperty(window,'documentPictureInPicture',{value:undefined,configurable:true}));
  await unsupported.goto(url);await ready(unsupported);
  assert.ok(!await unsupported.locator('#small-window-toggle').isVisible(),'Browsers without the API see no action.');
  report.hiddenWithoutSupport=true;

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
