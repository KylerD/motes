import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => { const { RadioAudio } = await import('/src/music/audio.ts'); window.radio = new RadioAudio(20260928, 'rain'); });
  assert.equal(await page.evaluate(() => typeof window.radio.setStyle), 'function', 'A real style selector must change the composer.');
  let failedPiano = true, pianoRequests = 0;
  await page.route('**/audio/piano/*.mp3', async route => { pianoRequests++; if (failedPiano) await route.fulfill({ status: 503, body: 'Unavailable' }); else await route.continue(); });
  await page.evaluate(async () => { await window.radio.setStyle('synthwave'); await window.radio.enable(); });
  await page.waitForTimeout(1000);
  assert.equal(pianoRequests, 0, 'Synthwave must work without piano downloads.');
  assert.equal(await page.evaluate(() => window.radio.current.style), 'synthwave');
  assert.ok(await page.evaluate(() => window.radio.playing && window.radio.diagnostics.voices > 0));
  const before = await page.evaluate(() => window.radio.environment.elapsed);
  const failure = await page.evaluate(() => window.radio.setStyle('lofi').then(() => '', e => e.message));
  assert.match(failure, /piano could not load/);
  assert.equal(await page.evaluate(() => window.radio.current.style), 'synthwave', 'A failed switch leaves the playing style intact.');
  failedPiano = false;
  await page.evaluate(() => window.radio.setStyle('lofi'));
  assert.equal(await page.evaluate(() => window.radio.current.style), 'lofi');
  assert.ok(await page.evaluate(t => window.radio.environment.elapsed >= t, before));
  results.push('synth starts without samples; failed lofi switch is retryable and preserves audio/environment');
  for (let i = 0; i < 8; i++) await page.evaluate(i => window.radio.setStyle(i % 2 ? 'lofi' : 'synthwave'), i);
  await page.evaluate(() => window.radio.setStyle('synthwave'));
  await page.waitForTimeout(800);
  assert.ok(await page.evaluate(() => window.radio.diagnostics.voices < 220));
  assert.equal(await page.evaluate(() => window.radio.diagnostics.scheduledSegments), 1);
  await page.evaluate(async () => { await window.radio.setStyle('lofi'); window.radio.pause(); });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.radio.enable());
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => window.radio.graph.music.gain.value >= .64), 'Resuming during a style fade restores the requested music level.');
  await page.evaluate(() => window.radio.pause());
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.radio.diagnostics.voices), 0);
  const paused = await page.evaluate(() => window.radio.environment.elapsed);
  await page.evaluate(() => window.radio.setStyle('lofi'));
  await page.evaluate(() => window.radio.setStyle('synthwave'));
  assert.equal(await page.evaluate(() => window.radio.playing), false);
  assert.equal(await page.evaluate(() => window.radio.environment.elapsed), paused);
  await page.evaluate(() => window.radio.enable());
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(t => window.radio.environment.elapsed > t, paused));
  await page.evaluate(() => { window.radio.setEdition(84, 'snow'); });
  await page.evaluate(() => window.radio.setStyle('lofi'));
  assert.ok(await page.evaluate(() => window.radio.environment.elapsed < 1));
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.radio.diagnostics.voices), 0);
  results.push('rapid/paused style switching, scene changes and disposal stay bounded');

  // A slow sample request must not override a newer choice or a pause.
  await page.unroute('**/audio/piano/*.mp3');
  await page.route('**/audio/piano/*.mp3', async route => { await new Promise(r => setTimeout(r, 300)); await route.continue(); });
  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(52, 'coast');
    await window.radio.setStyle('synthwave'); await window.radio.enable();
    window.lateSwitch = window.radio.setStyle('lofi');
    await window.radio.setStyle('synthwave'); window.radio.pause();
    await window.lateSwitch;
  });
  assert.equal(await page.evaluate(() => window.radio.current.style), 'synthwave');
  assert.equal(await page.evaluate(() => window.radio.playing), false);
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  assert.deepEqual(errors, []);
  results.push('late loading cannot override the latest style or resume a pause');

  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(19, 'snow');
    await window.radio.setStyle('synthwave');
    const activation = window.radio.enable(); window.radio.dispose(); await activation;
  });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => !!window.radio.graph), false, 'Disposal during context resume must not create an orphaned graph.');

  await page.unroute('**/audio/piano/*.mp3');
  await page.route('**/audio/piano/*.mp3', async route => {
    await new Promise(r => setTimeout(r, 1500));
    // The production fix aborts these intentionally stale requests.
    try { await route.fulfill({ status: 503, body: 'Unavailable' }); } catch (error) { if (!/already handled|closed/i.test(error.message)) throw error; }
  });
  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(71, 'snow');
    window.initialLoad = window.radio.enable().then(() => true, () => false);
  });
  await page.waitForTimeout(50);
  await page.evaluate(() => window.radio.setStyle('synthwave'));
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.radio.playing), true, 'Selecting synthwave during startup must abandon the piano wait.');
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  results.push('switching to synthwave abandons stalled initial piano loading');

  await page.unroute('**/audio/piano/*.mp3');
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ volume: .6, ambience: .2, mode: 'ambient', style: 'synthwave' })));
  await page.reload();
  assert.equal(await page.locator('#music-style').count(), 1, 'Style and drums need independent controls.');
  await page.click('#mix-toggle');
  assert.equal(await page.locator('#music-style').inputValue(), 'synthwave');
  assert.equal(await page.locator('#music-mode').inputValue(), 'ambient');
  await page.selectOption('#music-style', 'lofi');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).style === 'lofi');
  assert.equal(await page.locator('#music-mode').inputValue(), 'ambient');
  await page.selectOption('#music-style', 'synthwave');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).style === 'synthwave');
  await page.keyboard.press('Escape');
  await page.click('#listen');
  await page.waitForFunction(() => document.querySelector('#listen-label').textContent === 'Pause');
  assert.match(await page.locator('#track-detail').textContent(), /Arpeggios/);
  await page.click('#listen');
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ mode: 'ambient', style: 'invalid' })));
  await page.reload();
  assert.equal(await page.locator('#music-style').inputValue(), 'lofi');
  assert.equal(await page.locator('#music-mode').inputValue(), 'ambient');
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ mode: 'ambient' })));
  await page.reload();
  assert.equal(await page.locator('#music-style').inputValue(), 'lofi');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#mix-toggle');
  await page.locator('#music-style').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#music-style').isVisible());
  await page.selectOption('#music-style', 'synthwave');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).style === 'synthwave');
  mkdirSync('captures-synthwave', { recursive: true });
  await page.screenshot({ path: 'captures-synthwave/phone-controls.png' });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: 'captures-synthwave/desktop-controls.png' });
  assert.deepEqual(errors, []);
  results.push('remembered style, old/invalid preferences, independent drums and phone controls');
  mkdirSync('captures-synthwave', { recursive: true });
  writeFileSync('captures-synthwave/lifecycle.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); await server.close(); }
