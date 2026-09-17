import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const url = process.env.MOTES_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch(), errors = [], report = {};
mkdirSync('captures-sanctuaries',{recursive:true});
const ready = page => page.waitForFunction(() => window.__tidepool?.painting.ready && window.__tidepool.rendering.samples > 3);
const settled = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
try {
  const page = await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
  page.on('pageerror',e => errors.push(e.message));
  await page.goto(`${url}/?debug&seed=2718`); await ready(page);
  assert.equal(await page.evaluate(() => window.__tidepool.painting.exploring),false);
  assert.equal(await page.evaluate(() => window.__tidepool.paused),true);
  await page.screenshot({path:'captures-sanctuaries/rain-desktop.png'});
  const model = await page.evaluate(() => window.__tidepool.export());
  const stable = await page.screenshot(); await page.waitForTimeout(250);
  assert.ok(stable.equals(await page.screenshot()),'A paused painting must remain pixel-identical.');
  assert.equal(await page.evaluate(() => window.__tidepool.export()),model);
  report.pausedDeterminism = true;
  await page.locator('#scenery').selectOption('meadow'); await ready(page); await settled(page);
  assert.equal(await page.evaluate(() => window.__tidepool.export()),model);
  await page.screenshot({path:'captures-sanctuaries/meadow-desktop.png'});
  const weatherOn = await page.screenshot();
  await page.locator('#weather').click(); await settled(page);
  assert.equal(await page.evaluate(() => window.__tidepool.painting.weather),false);
  assert.ok(!weatherOn.equals(await page.screenshot()));
  await page.locator('#weather').click();
  await page.reload(); await ready(page);
  assert.equal(await page.locator('#scenery').inputValue(),'meadow');
  report.sceneSelection = true;
  const ripple = await page.evaluate(() => window.__tidepool.paintingProject(800,350));
  const beforeRipple = await page.evaluate(() => window.__tidepool.pool.disturbances.length);
  await page.locator('#pool').click({position:ripple});
  assert.equal(await page.evaluate(() => window.__tidepool.pool.disturbances.length),beforeRipple+1);
  report.rippleInteraction = true;
  const beforeExplore = await page.evaluate(() => window.__tidepool.export());
  await page.locator('#explore').click(); await settled(page);
  assert.equal(await page.evaluate(() => window.__tidepool.painting.exploring),true);
  assert.equal(await page.locator('#habitat').isVisible(),true);
  assert.equal(await page.evaluate(() => window.__tidepool.export()),beforeExplore);
  await page.locator('#explore').click();
  assert.equal(await page.evaluate(() => window.__tidepool.export()),beforeExplore);
  report.explorePreservesWorld = true;
  await page.locator('#quiet').click();
  assert.equal(await page.locator('#scenery').isVisible(),false);
  assert.equal(await page.locator('#return-controls').isVisible(),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#scenery').isVisible(),true);
  report.quietMode = true;
  await page.locator('#sound').click();
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
  await page.locator('#play').click(); await page.waitForFunction(() => window.__tidepool.pool.step > 30);
  await page.locator('#play').click(); await page.locator('#sound').click();
  report.playback = true;

  const phone = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  phone.on('pageerror',e => errors.push(e.message));
  await phone.goto(`${url}/?debug&seed=2718`); await ready(phone);
  for (const mood of ['rain','meadow']) {
    await phone.locator('#scenery').selectOption(mood); await ready(phone); await settled(phone);
    await phone.screenshot({path:`captures-sanctuaries/${mood}-mobile.png`});
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    const target = await phone.evaluate(() => window.__tidepool.paintingProject(800,350));
    if (target.x > 0 && target.x < 390) {
      const n = await phone.evaluate(() => window.__tidepool.pool.disturbances.length);
      await phone.locator('#pool').tap({position:target});
      assert.equal(await phone.evaluate(() => window.__tidepool.pool.disturbances.length),n+1);
    }
  }
  await phone.locator('#explore').tap(); assert.equal(await phone.locator('#guide-open').isVisible(),true);
  report.mobile = true;

  const fallback = await browser.newPage({reducedMotion:'reduce'});
  await fallback.route('**/scenes/*.png',route => route.abort());
  await fallback.goto(`${url}/?debug`);
  await fallback.waitForFunction(() => window.__tidepool?.painting.failed);
  assert.equal(await fallback.locator('#retry-art').isVisible(),true);
  await fallback.locator('#explore').click();
  assert.equal(await fallback.locator('#habitat').isVisible(),true);
  await fallback.unroute('**/scenes/*.png');
  await fallback.locator('#retry-art').click(); await ready(fallback);
  assert.equal(await fallback.locator('#scene-loading').isVisible(),false);
  report.failedArtFallback = true;
  const audioFailure = await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
  await audioFailure.addInitScript(() => {
    const resume = AudioContext.prototype.resume; let rejected = false;
    AudioContext.prototype.resume = function() { if (!rejected) { rejected = true; return Promise.reject(new Error('Test audio start rejection')); } return resume.call(this); };
  });
  await audioFailure.goto(`${url}/?debug`); await ready(audioFailure);
  await audioFailure.locator('#sound').click();
  assert.equal(await audioFailure.locator('#sound-status').isVisible(),true);
  assert.match(await audioFailure.locator('#sound-status').textContent(),/Tap Listen to try again/);
  assert.equal(await audioFailure.locator('#sound').getAttribute('aria-pressed'),'false');
  await audioFailure.screenshot({path:'captures-sanctuaries/audio-error-desktop.png'});
  await audioFailure.setViewportSize({width:390,height:844}); await settled(audioFailure);
  await audioFailure.screenshot({path:'captures-sanctuaries/audio-error-mobile.png'});
  await audioFailure.locator('#sound').click();
  assert.equal(await audioFailure.locator('#sound-status').isVisible(),false);
  assert.equal(await audioFailure.locator('#sound').getAttribute('aria-pressed'),'true');
  report.audioStartRecovery = true;
  assert.deepEqual(errors,[]);
  writeFileSync('captures-sanctuaries/verification.json',JSON.stringify({...report,errors},null,2));
  console.log(JSON.stringify({...report,errors}));
} finally { await browser.close(); }
