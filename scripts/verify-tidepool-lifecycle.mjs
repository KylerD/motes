import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist');
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const path=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(root)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chromium',ignoreDefaultArgs:['--disable-back-forward-cache']});
const reports=[];const output=(kind,data)=>{reports.push({kind,...data});writeFileSync('captures-cozy/lifecycle-results.json',JSON.stringify(reports,null,2));};
try{
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce',hasTouch:true});
  const page=await context.newPage();
  await page.goto(url+'/?debug');await page.waitForFunction(()=>window.__tidepool);
  await page.evaluate(()=>{window.reviewCacheToken='same-document';window.addEventListener('pageshow',e=>window.reviewPersisted=e.persisted);});
  await page.evaluate(() => {
    window.reviewEvents = [];
    const record = (event, matches) => window.reviewEvents.push({ event, matches, paused: window.__tidepool.paused, reduced: window.__tidepool.view.reduced, hidden: document.hidden });
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => record('preference', e.matches));
    window.addEventListener('pageshow', () => record('show'));
    window.addEventListener('pagehide', () => record('hide'));
    document.addEventListener('visibilitychange', () => record('visibility'));
  });
  await page.locator('#play').click();await page.waitForFunction(()=>window.__tidepool.pool.step>10);
  await page.locator('#guide-open').click();await page.locator('a[href="/original.html"]').click();
  await page.goBack({timeout:2500}).catch(error=>{if(!page.url().startsWith(url+'/?debug'))throw error;});await page.waitForFunction(()=>window.__tidepool);
  const before=await page.evaluate(()=>({step:window.__tidepool.pool.step,samples:window.__tidepool.rendering.samples,paused:window.__tidepool.paused,cacheToken:window.reviewCacheToken,persisted:window.reviewPersisted}));
  await page.waitForTimeout(400);
  const after = await page.evaluate(()=>({step:window.__tidepool.pool.step,samples:window.__tidepool.rendering.samples,paused:window.__tidepool.paused,events:window.reviewEvents}));
  output('production-back-navigation',{before,after});
  assert.equal(before.persisted, true);
  assert.ok(after.step > before.step && after.samples > before.samples, JSON.stringify({before,after}));
  await page.reload();await page.waitForFunction(()=>window.__tidepool);
  await page.locator('#explore').click();await page.locator('[data-tool="feed"]').click();
  const nutrients=await page.evaluate(()=>window.__tidepool.pool.nutrients.length);
  const cdp=await context.newCDPSession(page);
  const a={x:650,y:450,id:1},b={x:750,y:450,id:2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...a,x:620},{...b,x:780}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{...a,x:620}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  output('pinch-intervention',{before:nutrients,after:await page.evaluate(()=>window.__tidepool.pool.nutrients.length),message:await page.locator('#observation').textContent()});
  assert.equal(await page.evaluate(()=>window.__tidepool.pool.nutrients.length), nutrients);
  await page.reload();await page.waitForFunction(()=>window.__tidepool);
  await page.locator('#pool').focus();await page.keyboard.press('2');
  const keyboardBefore=await page.evaluate(()=>window.__tidepool.pool.nutrients.length);
  await page.keyboard.press('Enter');
  output('keyboard-intervention',{tool:await page.evaluate(()=>window.__tidepool.view.tool),before:keyboardBefore,after:await page.evaluate(()=>window.__tidepool.pool.nutrients.length)});
  assert.equal(await page.evaluate(()=>window.__tidepool.pool.nutrients.length), keyboardBefore + 1);
  console.log('Passed production back navigation, pinch without intervention, and keyboard intervention.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
