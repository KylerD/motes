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
    const { createGraph, prepareBank, stopVoices, disposeGraph } = await import('/src/music/sound.ts');
    const { STYLES } = await import('/src/music/styles/index.ts');
    const { createSession, composeSessionTrack } = await import('/src/session/session.ts');
    const rate = 44100, context = new OfflineAudioContext(2, rate * 5, rate);
    const graph = createGraph(context, 20260928), bank = await prepareBank(graph, STYLES.dreamy); graph.output.gain.value = 1;
    bank.schedule({ instrument: 'lead', beat: 0, note: 69, duration: 1, velocity: .7, pan: 0, brightness: .8 }, .05, .6, {});
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
    const measure = (buffer, from, to) => {
      let power = 0, count = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = Math.round(from * rate); i < Math.round(to * rate); i++) { power += data[i] ** 2; count++; }
      }
      return Math.sqrt(power / count);
    };
    // Bypass the hall/chorus so a diffuse tail cannot masquerade as a timed repeat.
    const echoes = [];
    for (const secondsPerBeat of [.5, 60 / 84]) {
      for (const cancelled of [false, true]) {
        const context = new OfflineAudioContext(2, rate * 4, rate), graph = createGraph(context, 7), bank = await prepareBank(graph, STYLES.dreamy);
        bank.synth.disconnect(); bank.synth.connect(context.destination);
        bank.schedule({ instrument: 'arp', beat: 0, note: 76, duration: .08, velocity: .6, pan: 0 }, .05, secondsPerBeat, {});
        if (cancelled) stopVoices(graph, .27, .02);
        const buffer = await context.startRendering(), dry = measure(buffer, .06, .1);
        const taps = [1, 2, 3, 4].map(n => measure(buffer, .05 + n * .75 * secondsPerBeat + .01, .05 + n * .75 * secondsPerBeat + .05));
        echoes.push({ secondsPerBeat, cancelled, ratios: taps.map(tap => tap / dry) });
        disposeGraph(graph);
      }
    }
    const track = composeSessionTrack(createSession(20260928, 'rain', 'dreamy'), 0), beat = 60 / track.bpm;
    const padContext = new OfflineAudioContext(2, Math.ceil(rate * beat * 26), rate), padGraph = createGraph(padContext, 7), padBank = await prepareBank(padGraph, STYLES.dreamy);
    padBank.synth.disconnect(); padBank.synth.connect(padContext.destination);
    for (const event of track.events.filter(e => e.instrument === 'pad' && e.beat < 26)) padBank.schedule(event, .05 + event.beat * beat, beat, {});
    const pads = await padContext.startRendering();
    const joins = [8, 16, 24].map(at => {
      const change = .05 + at * beat, body = measure(pads, change - .8, change - .4);
      const windows = [0, .1, .2, .3, .4].map(offset => measure(pads, change + offset, change + offset + .1));
      return Math.min(...windows) / body;
    });
    disposeGraph(padGraph);
    return { body, tail, tailDb: 20 * Math.log10(tail / body), stereoWidth, peak, echoes, chordJoinRatios: joins };
  });
  mkdirSync('captures-synthwave', { recursive: true });
  writeFileSync('captures-synthwave/sound-character.json', JSON.stringify(report, null, 2));
  console.log(report);
  assert.ok(report.tailDb > -24, 'The tail should remain prominent after release, not merely measurable.');
  assert.ok(report.stereoWidth > .08, 'The lead needs audible stereo width at centre pan.');
  assert.ok(report.peak < .9 && report.body > .01, 'Thick synths still need headroom and usable level.');
  for (const echo of report.echoes) {
    if (echo.cancelled) assert.ok(echo.ratios.every(ratio => ratio < .0001), 'Cancelled notes must not leave queued rhythmic echoes.');
    else {
      assert.ok(echo.ratios[0] > .25 && echo.ratios[1] > .12 && echo.ratios[2] > .06, 'Plucks need several audible repeats on the dotted-eighth grid.');
      assert.ok(echo.ratios.every((ratio, index) => index === 0 || ratio < echo.ratios[index - 1]), 'Successive echoes should decay.');
    }
  }
  assert.ok(report.chordJoinRatios.every(ratio => ratio > .7), 'Held harmony must carry across chord attacks without a deep volume hole.');
} finally { await browser.close(); await server.close(); }
