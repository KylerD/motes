import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';

const browser=await chromium.launch(),base=process.env.MOTES_URL||'http://127.0.0.1:5175';
const directory='captures-sessions';mkdirSync(directory,{recursive:true});
const errors=[],report={};
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  page.on('pageerror',error=>errors.push(error.message));
  const visit=async(page,scene)=>{
    await page.goto(`${base}/?debug&day=2026-09-18&scene=${scene}`);
    await page.waitForFunction(()=>window.__motes?.ready);
    await page.evaluate(()=>document.fonts.ready);
  };
  const frame=async(page,seconds)=>{
    await page.evaluate(seconds=>window.__motes.previewSession(seconds),seconds);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  for(const scene of ['rain','meadow','snow','coast']){
    await visit(page,scene);await frame(page,0);await page.screenshot({path:`${directory}/${scene}-arrival-desktop.png`});
    await frame(page,3300);assert.ok(await page.evaluate(()=>window.__motes.rendering.session.dusk>.9));
    await page.screenshot({path:`${directory}/${scene}-evening-desktop.png`});
    if(scene==='snow'||scene==='coast'){
      const kind=scene==='snow'?'train':'boat';
      const moment=await page.evaluate(kind=>{const event=window.__motes.sessionPlan.events.find(e=>e.kind===kind);return event.start+event.duration*.5;},kind);
      await frame(page,moment);assert.ok(await page.evaluate(kind=>window.__motes.rendering.session.events.some(e=>e.kind===kind),kind));
      await page.screenshot({path:`${directory}/${scene}-${kind}-desktop.png`});
    }
  }report.sceneArcsAndEvents=true;
  await visit(page,'meadow');await page.click('#listen');await page.waitForFunction(()=>window.__motes.radio.playing);
  await page.click('#next-track');await page.waitForFunction(()=>window.__motes.session.elapsed>200);
  await page.click('#mix-toggle');await page.click('#motion');await page.keyboard.press('Escape');
  const fixed=await page.locator('#scene').screenshot(),before=await page.evaluate(()=>window.__motes.session.elapsed);
  await page.waitForTimeout(500);assert.ok(fixed.equals(await page.locator('#scene').screenshot()));
  assert.ok(await page.evaluate(before=>window.__motes.session.elapsed>before,before));report.stillLeavesMusicAndSessionRunning=true;
  await page.click('#listen');const paused=await page.evaluate(()=>window.__motes.session.elapsed);
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.__motes.session.elapsed),paused);report.pauseHoldsSession=true;
  const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  phone.on('pageerror',error=>errors.push(error.message));
  for(const scene of ['rain','meadow','snow','coast']){
    await visit(phone,scene);await frame(phone,3300);
    assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await phone.screenshot({path:`${directory}/${scene}-evening-mobile.png`});
  }report.mobile=true;
  assert.deepEqual(errors,[]);report.errors=errors;
  writeFileSync(`${directory}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
