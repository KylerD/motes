import { chromium } from 'playwright';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);
  const report = await page.evaluate(async () => {
    const { createGraph, scheduleNote, disposeGraph } = await import('/src/music/sound.ts');
    const rate = 44100, context = new OfflineAudioContext(2, rate * 5, rate);
    const graph = createGraph(context, new Map(), 20260928); graph.output.gain.value = 1;
    scheduleNote(graph, { instrument: 'lead', beat: 0, note: 69, duration: 1, velocity: .7, pan: 0, brightness: .8 }, .05, .6);
    const buffer = await context.startRendering();
    const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    const rms = (from, to, side = false) => {
      let sum = 0; const start = Math.round(from * rate), end = Math.round(to * rate);
      for (let i = start; i < end; i++) { const v = side ? (left[i] - right[i]) / 2 : (left[i] + right[i]) / 2; sum += v * v; }
      return Math.sqrt(sum / (end - start));
    };
    const body = rms(.15, .6), tail = rms(1.5, 2.4);
    const stereoWidth = rms(.15, .6, true) / body;
    let peak = 0; for (const channel of [left, right]) for (const x of channel) peak = Math.max(peak, Math.abs(x));
    disposeGraph(graph);
    return { body, tail, tailDb: 20 * Math.log10(tail / body), stereoWidth, peak };
  });
  mkdirSync('captures-synthwave', { recursive: true });
  writeFileSync('captures-synthwave/sound-character.json', JSON.stringify(report, null, 2));
  console.log(report);
  assert.ok(report.tailDb > -36, 'The lead needs an audible spacious tail after the dry note has ended.');
  assert.ok(report.stereoWidth > .08, 'The lead needs audible stereo width at centre pan.');
  assert.ok(report.peak < .9 && report.body > .01, 'Thick synths still need headroom and usable level.');
} finally { await browser.close(); await server.close(); }
