import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

// Desktop automation cannot exercise an iPhone's physical Silent Mode. Verify
// the documented WebKit playback-session contract and feature-detection paths.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=user-gesture-required'] });
try {
  for (const support of ['supported', 'missing', 'rejects']) {
    const page = await browser.newPage();
    await page.addInitScript(support => {
      window.audioStartup = [];
      let type = 'auto';
      const session = {
        get type() { return type; },
        set type(value) {
          window.audioStartup.push(`session:${value}`);
          if (support === 'rejects') throw new DOMException('Not supported', 'NotSupportedError');
          type = value;
        },
      };
      Object.defineProperty(navigator, 'audioSession', { configurable: true, value: support === 'missing' ? undefined : session });
      const Audio = window.AudioContext;
      window.AudioContext = class extends Audio {
        constructor(options) { window.audioStartup.push(`create:${type}`); super(options); }
        resume() { window.audioStartup.push(`resume:${type}`); return super.resume(); }
      };
    }, support);
    await page.goto(server.resolvedUrls.local[0]);
    assert.deepEqual(await page.evaluate(() => window.audioStartup), [], 'Loading the page must not claim music playback before Listen.');
    await page.click('#mix-toggle');
    await page.selectOption('#music-style', 'synthwave');
    await page.keyboard.press('Escape');
    await page.click('#listen');
    await page.waitForFunction(() => document.querySelector('#listen-label').textContent === 'Pause');
    const startup = await page.evaluate(() => window.audioStartup);
    if (support === 'supported') {
      assert.deepEqual(startup.slice(0, 3), ['session:playback', 'create:playback', 'resume:playback'], 'iOS needs the media playback category before audio activation.');
    } else assert.ok(startup.includes('resume:auto'), 'An absent or rejecting session API must not prevent ordinary audio playback.');
    await page.click('#mix-toggle');
    await page.selectOption('#music-style', 'lofi');
    await page.waitForFunction(() => document.querySelector('#track-detail').textContent.includes('Upright piano'));
    await page.keyboard.press('Escape');
    await page.click('#listen');
    await page.waitForFunction(() => document.querySelector('#listen-label').textContent === 'Resume');
    await page.click('#listen');
    await page.waitForFunction(() => document.querySelector('#listen-label').textContent === 'Pause');
    if (support === 'supported') assert.equal(await page.evaluate(() => navigator.audioSession.type), 'playback');
    console.log(`${support}: trusted Listen, both styles and pause/resume passed`);
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
