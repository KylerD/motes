import { chromium } from 'playwright';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const url = process.env.MOTES_URL || 'http://127.0.0.1:5175', browser = await chromium.launch();
const errors = [], report = {};
const settled = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = page => page.waitForFunction(() => window.__tidepool?.painting.ready && window.__tidepool.rendering.samples > 3);
try {
  const page = await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'});
  page.on('pageerror',e => errors.push(e.message));
  await page.goto(`${url}/?debug&seed=2718&view=pond`); await ready(page);
  assert.equal(await page.locator('#pool').getAttribute('data-renderer'),'painting');
  await page.addStyleTag({content:'#experience > :not(canvas) { visibility: hidden !important; }'});
  await page.evaluate(() => window.__tidepool.advance(11)); await settled(page);
  const model = await page.evaluate(() => window.__tidepool.export()), before = await page.screenshot();
  await page.locator('#file').setInputFiles({name:'same.json',mimeType:'application/json',buffer:Buffer.from(model)});
  await page.waitForFunction(() => document.querySelector('#observation').textContent.includes('Welcome back')); await settled(page);
  assert.ok(before.equals(await page.screenshot()),'Importing an identical model must reproduce every scene pixel.');
  report.exactSnapshot = true;
  await page.evaluate(() => window.__tidepool.advance(30)); await settled(page);
  assert.ok(!before.equals(await page.screenshot()),'The live scene must change with model time.');
  report.liveMotion = true;
  await page.reload(); await ready(page);
  const lone = await page.evaluate(() => {
    const data = JSON.parse(window.__tidepool.export());
    data.initial.cells = [{...data.initial.cells[0],x:800,y:480}];
    data.initial.bonds = []; data.initial.obstacles = []; data.initial.nutrients = [];
    return JSON.stringify(data);
  });
  await page.locator('#file').setInputFiles({name:'lone.json',mimeType:'application/json',buffer:Buffer.from(lone)});
  await page.waitForFunction(() => window.__tidepool.pool.cells.length===1);
  await page.locator('#fit').click();
  for(let i=0;i<8;i++) await page.locator('#zoom-in').click();
  const point = await page.evaluate(() => window.__tidepool.cellScreen(window.__tidepool.pool.cells[0].id));
  await page.locator('#pool').click({position:point});
  assert.equal(await page.evaluate(() => window.__tidepool.view.selected),await page.evaluate(() => window.__tidepool.pool.cells[0].id));
  report.zoomedPicking = true;
  await page.reload(); await ready(page);
  for(let i=0;i<12;i++) {
    await page.locator('#habitat').selectOption(i%2?'reef':'spores');
    await page.locator('#scenery').selectOption(i%2?'rain':'meadow'); await ready(page);
    await page.locator('#lens').selectOption(i%3===0?'energy':i%3===1?'bonds':'life'); await settled(page);
  }
  const resources = await page.evaluate(() => window.__tidepool.rendering);
  assert.equal(resources.images,2); assert.ok(resources.sprites<=10);
  report.boundedResources = {images:resources.images,sprites:resources.sprites};
  assert.deepEqual(errors,[]);
  mkdirSync('captures-sanctuaries',{recursive:true});
  writeFileSync('captures-sanctuaries/rendering.json',JSON.stringify({...report,errors},null,2));
  console.log(JSON.stringify({...report,errors}));
} finally {await browser.close();}
