import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const url = process.env.MOTES_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch();
const errors = [], report = {};
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) errors.push(m.text()); });
};
const ready = page => page.waitForFunction(() => window.__tidepool?.rendering.samples > 3);
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' }); watch(page);
  await page.goto(`${url}/?debug&seed=2718`); await ready(page);
  assert.equal(await page.locator('#pool').getAttribute('data-renderer'), 'three');
  await page.addStyleTag({ content: '#experience > :not(canvas) { visibility: hidden !important; }' });
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.__tidepool.advance(1));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const saved = await page.evaluate(() => window.__tidepool.export());
  const before = await page.screenshot();
  await page.locator('#file').setInputFiles({ name: 'same.json', mimeType: 'application/json', buffer: Buffer.from(saved) });
  await page.waitForFunction(() => document.querySelector('#observation').textContent.includes('Welcome back'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const after = await page.screenshot();
  assert.ok(before.equals(after), 'An identical saved model must render identically after import.');
  report.exactSnapshotAppearance = true;

  await page.reload(); await ready(page);
  const lone = await page.evaluate(() => {
    const data = JSON.parse(window.__tidepool.export());
    data.initial.cells = [{ ...data.initial.cells[0], x: 800, y: 480 }];
    data.initial.bonds = []; data.initial.obstacles = []; data.initial.nutrients = [];
    return JSON.stringify(data);
  });
  await page.locator('#file').setInputFiles({ name: 'lone.json', mimeType: 'application/json', buffer: Buffer.from(lone) });
  await page.waitForFunction(() => window.__tidepool.pool.cells.length === 1);
  await page.locator('#fit').click();
  for (let i = 0; i < 8; i++) await page.locator('#zoom-in').click();
  const target = await page.evaluate(() => window.__tidepool.cellScreen(window.__tidepool.pool.cells[0].id));
  await page.locator('#pool').click({ position: target });
  assert.equal(await page.evaluate(() => window.__tidepool.view.selected), await page.evaluate(() => window.__tidepool.pool.cells[0].id));
  report.elevatedPicking = true;
  await page.reload(); await ready(page);
  const initial = await page.evaluate(() => window.__tidepool.rendering.geometries);
  const initialTextures = await page.evaluate(() => window.__tidepool.rendering.textures);
  for (let i = 0; i < 8; i++) {
    await page.locator('#habitat').selectOption(i % 2 ? 'reef' : 'channel');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const final = await page.evaluate(() => window.__tidepool.rendering.geometries);
  assert.ok(final <= initial + 2, `Geometry count grew across resets: ${initial} -> ${final}`);
  report.geometryCounts = { initial, final };
  const finalTextures = await page.evaluate(() => window.__tidepool.rendering.textures);
  assert.equal(finalTextures, initialTextures, 'Render textures must remain bounded across habitat resets.');
  report.textureCounts = { initial: initialTextures, final: finalTextures };

  await page.locator('#play').click(); await page.waitForFunction(() => window.__tidepool.pool.step > 8);
  await page.evaluate(() => {
    window.__contextExtension = document.querySelector('#pool').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.__contextExtension.loseContext();
  });
  await page.waitForFunction(() => window.__tidepool.paused);
  const resting = await page.evaluate(() => window.__tidepool.pool.step);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__tidepool.pool.step), resting);
  await page.evaluate(() => window.__contextExtension.restoreContext());
  await page.waitForFunction(() => !window.__tidepool.paused && window.__tidepool.pool.step > 10);
  report.contextRecovery = true;

  // Recovery must redraw the same picture, including the off-screen print texture.
  await page.locator('#play').click();
  await page.addStyleTag({ content: '#experience > :not(canvas) { visibility: hidden !important; }' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const beforeRecovery = await page.screenshot();
  const pausedStep = await page.evaluate(() => window.__tidepool.pool.step);
  await page.evaluate(() => window.__contextExtension.loseContext());
  await page.waitForFunction(() => document.querySelector('#pool').getContext('webgl2').isContextLost());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__contextExtension.restoreContext());
  await page.waitForFunction(() => !document.querySelector('#pool').getContext('webgl2').isContextLost());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => window.__tidepool.pool.step), pausedStep);
  assert.ok(beforeRecovery.equals(await page.screenshot()), 'Context recovery must restore the entire paused scene.');
  report.exactRecoveredAppearance = true;

  const fallback = await browser.newPage({ reducedMotion: 'reduce' }); watch(fallback);
  await fallback.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); };
  });
  await fallback.goto(`${url}/?debug`); await ready(fallback);
  assert.equal(await fallback.locator('#pool').getAttribute('data-renderer'), 'canvas');
  await fallback.locator('#pool').focus(); await fallback.keyboard.press('2');
  const n = await fallback.evaluate(() => window.__tidepool.pool.nutrients.length);
  await fallback.keyboard.press('Enter');
  assert.equal(await fallback.evaluate(() => window.__tidepool.pool.nutrients.length), n + 1);
  report.canvasFallback = true;
  assert.deepEqual(errors, []);
  mkdirSync('captures-cozy', { recursive: true }); writeFileSync('captures-cozy/graphics.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, errors }));
} finally { await browser.close(); }
