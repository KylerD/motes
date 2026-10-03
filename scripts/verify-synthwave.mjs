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
  await page.evaluate(async () => { await window.radio.setStyle('dreamy'); await window.radio.enable(); });
  await page.waitForTimeout(1000);
  assert.equal(pianoRequests, 0, 'Synthwave must work without piano downloads.');
  assert.equal(await page.evaluate(() => window.radio.current.style), 'dreamy');
  assert.ok(await page.evaluate(() => window.radio.playing && window.radio.diagnostics.voices > 0));
  const before = await page.evaluate(() => window.radio.environment.elapsed);
  const failure = await page.evaluate(() => window.radio.setStyle('lofi').then(() => '', e => e.message));
  assert.match(failure, /piano could not load/);
  assert.equal(await page.evaluate(() => window.radio.current.style), 'dreamy', 'A failed switch leaves the playing style intact.');
  // Each place’s own fails the same way: the pick that is playing stays.
  assert.match(await page.evaluate(() => window.radio.setStyle(undefined).then(() => '', e => e.message)), /piano could not load/);
  assert.equal(await page.evaluate(() => window.radio.current.style), 'dreamy', 'A failed Each place’s own keeps the pick playing.');
  assert.equal(await page.evaluate(() => window.radio.chosen), 'dreamy', 'A failed Each place’s own keeps the pick.');
  failedPiano = false;
  await page.evaluate(() => window.radio.setStyle('lofi'));
  assert.equal(await page.evaluate(() => window.radio.current.style), 'lofi');
  assert.ok(await page.evaluate(t => window.radio.environment.elapsed >= t, before));
  // Each place’s own clears a pick while playing: rain plays its own Warm lofi again.
  await page.evaluate(async () => { await window.radio.setStyle('dreamy'); await window.radio.setStyle(undefined); });
  assert.equal(await page.evaluate(() => window.radio.current.style), 'lofi', 'No pick plays the place’s own style.');
  results.push('synth starts without samples; failed lofi switch is retryable and preserves audio/environment');
  for (let i = 0; i < 9; i++) await page.evaluate(i => window.radio.setStyle(['lofi', 'dreamy', 'driving'][i % 3]), i);
  await page.evaluate(() => window.radio.setStyle('dreamy'));
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
  await page.evaluate(() => window.radio.setStyle('dreamy'));
  await page.evaluate(() => window.radio.setStyle(undefined));
  assert.equal(await page.evaluate(() => window.radio.playing), false);
  assert.equal(await page.evaluate(() => window.radio.environment.elapsed), paused);
  await page.evaluate(() => window.radio.enable());
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(t => window.radio.environment.elapsed > t, paused));
  await page.evaluate(() => { window.radio.setEdition(84, 'snow'); });
  await page.evaluate(() => window.radio.setStyle('dreamy'));
  assert.ok(await page.evaluate(() => window.radio.environment.elapsed < 1));
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.radio.diagnostics.voices), 0);
  results.push('rapid/paused style switching, scene changes and disposal stay bounded');

  // A slow sample request must not override a newer choice or a pause.
  await page.unroute('**/audio/piano/*.mp3');
  let slow = 0;
  await page.route('**/audio/piano/*.mp3', async route => { slow++; await new Promise(r => setTimeout(r, 300)); await route.continue(); });
  // A fresh page, so the piano is not already decoded and the request really waits.
  await page.reload();
  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(52, 'coast');
    await window.radio.setStyle('dreamy'); await window.radio.enable();
    window.lateSwitch = window.radio.setStyle('lofi');
    await window.radio.setStyle('dreamy'); window.radio.pause();
    await window.lateSwitch;
  });
  assert.equal(await page.evaluate(() => window.radio.current.style), 'dreamy');
  assert.equal(await page.evaluate(() => window.radio.playing), false);
  assert.ok(slow > 0, 'The piano request must actually be slow.');
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  assert.deepEqual(errors, []);
  results.push('late loading cannot override the latest style or resume a pause');

  // A visit away while Each place’s own waits on the bank must not switch the new place to the old place’s style.
  await page.reload();
  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(61, 'rain'); await window.radio.setStyle('dreamy'); await window.radio.enable();
    window.ownSwitch = window.radio.setStyle(undefined); window.radio.setEdition(62, 'deck');
    await window.ownSwitch;
  });
  assert.equal(await page.evaluate(() => window.radio.current.style), 'driving');
  assert.equal(await page.evaluate(() => window.radio.chosen), undefined);
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);

  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(19, 'snow');
    await window.radio.setStyle('dreamy');
    const activation = window.radio.enable(); window.radio.dispose(); await activation;
  });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => !!window.radio.graph), false, 'Disposal during context resume must not create an orphaned graph.');

  await page.unroute('**/audio/piano/*.mp3');
  let stalled = 0;
  await page.route('**/audio/piano/*.mp3', async route => {
    stalled++;
    await new Promise(r => setTimeout(r, 1500));
    // The production fix aborts these intentionally stale requests.
    try { await route.fulfill({ status: 503, body: 'Unavailable' }); } catch (error) { if (!/already handled|closed/i.test(error.message)) throw error; }
  });
  // A fresh page, so no piano is already decoded and the request really stalls.
  await page.reload();
  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(71, 'snow');
    window.initialLoad = window.radio.enable().then(() => true, () => false);
  });
  await page.waitForTimeout(50);
  await page.evaluate(() => window.radio.setStyle('dreamy'));
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.radio.playing), true, 'Selecting synthwave during startup must abandon the piano wait.');
  assert.ok(stalled > 0, 'The piano request must actually stall.');
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  // A Warm lofi pick still loading at Top deck, then a move to a lofi place: the 503 leaves the synths that were playing.
  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(72, 'deck'); await window.radio.enable();
    const pick = window.radio.setStyle('lofi').catch(() => {});
    await Promise.all([pick, window.radio.setEdition(73, 'rain').catch(() => {})]);
  });
  assert.equal(await page.evaluate(() => window.radio.current.style), 'driving', 'A failed pick during a place change keeps the synths that were playing.');
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  // The same race during a failed piano load must not revert Each place’s own at the new place either.
  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(79, 'rain'); await window.radio.setStyle('dreamy'); await window.radio.enable();
    window.ownSwitch = window.radio.setStyle(undefined); window.radio.setEdition(80, 'deck');
    await window.ownSwitch;
  });
  assert.equal(await page.evaluate(() => window.radio.current.style), 'driving');
  assert.equal(await page.evaluate(() => window.radio.chosen), undefined);
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  // Two quick visits from Top deck to lofi places, then the 503: the second visit must not settle on the first visit's unready plan.
  await page.evaluate(async () => {
    const { RadioAudio } = await import('/src/music/audio.ts');
    window.radio = new RadioAudio(74, 'deck'); await window.radio.enable();
    const first = window.radio.setEdition(75, 'rain').catch(() => {}), second = window.radio.setEdition(76, 'meadow').catch(() => {});
    await Promise.all([first, second]);
  });
  assert.equal(await page.evaluate(() => window.radio.current.style), 'driving', 'Quick visits during a failed piano load keep the synths that were playing.');
  await page.evaluate(() => window.radio.dispose());
  await page.waitForTimeout(200);
  results.push('switching to synthwave abandons stalled initial piano loading; a failed pick or quick visits during a place change keep the synths');

  await page.unroute('**/audio/piano/*.mp3');
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ volume: .6, ambience: .2, mode: 'ambient', style: 'synthwave' })));
  await page.reload();
  assert.equal(await page.locator('#music-style').count(), 1, 'Style and drums need independent controls.');
  await page.click('#mix-toggle');
  assert.equal(await page.locator('#music-style').inputValue(), 'dreamy');
  assert.equal(await page.locator('#music-mode').inputValue(), 'ambient');
  await page.selectOption('#music-style', 'lofi');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).styleChoice === 'lofi');
  assert.equal(await page.evaluate(() => 'style' in JSON.parse(localStorage.getItem('motes-listening'))), false, 'A save drops main’s style key, so its migration cannot bring a pick back.');
  assert.equal(await page.locator('#music-mode').inputValue(), 'ambient');
  await page.selectOption('#music-style', 'dreamy');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).styleChoice === 'dreamy');
  await page.keyboard.press('Escape');
  await page.click('#listen');
  await page.waitForFunction(() => document.querySelector('#listen-label').textContent === 'Pause');
  assert.match(await page.locator('#track-detail').textContent(), /Arpeggios/);
  await page.click('#listen');
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ mode: 'ambient', style: 'invalid' })));
  await page.reload();
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  assert.equal(await page.locator('#music-mode').inputValue(), 'ambient');
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ mode: 'ambient' })));
  await page.reload();
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  assert.deepEqual(await page.locator('#music-style option').evaluateAll(o => o.map(x => x.value)), ['own', 'lofi', 'dreamy', 'driving']);
  // Main saved `style: 'lofi'` with any change; Top deck still opens on its own music and keeps the volume.
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ volume: .5, style: 'lofi' })));
  await page.goto(server.resolvedUrls.local[0] + '?scene=deck');
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  assert.equal(await page.locator('#music-volume').inputValue(), '50');
  // A pick applies in every place and survives a reload.
  await page.click('#mix-toggle'); await page.selectOption('#music-style', 'dreamy');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).styleChoice === 'dreamy');
  await page.goto(server.resolvedUrls.local[0] + '?scene=rain');
  assert.equal(await page.locator('#music-style').inputValue(), 'dreamy');
  // Each place’s own forgets the pick, so Top deck plays its own music again.
  await page.click('#mix-toggle'); await page.selectOption('#music-style', 'own');
  await page.waitForFunction(() => !('styleChoice' in JSON.parse(localStorage.getItem('motes-listening'))));
  await page.goto(server.resolvedUrls.local[0] + '?debug&scene=deck');
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  assert.equal(await page.evaluate(() => window.__motes.track.style), 'driving');
  await page.evaluate(() => localStorage.setItem('motes-listening', JSON.stringify({ styleChoice: 'bogus' })));
  await page.goto(server.resolvedUrls.local[0] + '?scene=deck');
  assert.equal(await page.locator('#music-style').inputValue(), 'own');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#mix-toggle');
  await page.locator('#music-style').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#music-style').isVisible());
  await page.selectOption('#music-style', 'dreamy');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('motes-listening')).styleChoice === 'dreamy');
  mkdirSync('captures-synthwave', { recursive: true });
  await page.screenshot({ path: 'captures-synthwave/phone-controls.png' });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: 'captures-synthwave/desktop-controls.png' });
  assert.deepEqual(errors, []);
  results.push('remembered style, Each place’s own, old/invalid preferences, independent drums and phone controls');
  mkdirSync('captures-synthwave', { recursive: true });
  writeFileSync('captures-synthwave/lifecycle.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); await server.close(); }
