import { describe, it, expect } from 'vitest';
import { createPool, clonePool } from '../src/tidepool/world';
import { History, readExperiment } from '../src/tidepool/history';

describe('tidepool experiments', () => {
  it('rewinds and replays exactly including interventions', () => {
    const h = new History(createPool(81));
    for (let i = 0; i < 70; i++) h.advance();
    h.command({ type: 'current', x: 600, y: 370 });
    for (let i = 0; i < 60; i++) h.advance();
    const expected = clonePool(h.pool);
    h.seek(20); h.seek(expected.step);
    expect(h.pool).toEqual(expected);
  });
  it('creates an independent original when branching from the past', () => {
    const h = new History(createPool(81));
    for (let i = 0; i < 90; i++) h.advance();
    h.seek(30); h.fork();
    h.command({ type: 'current', x: 600, y: 370 });
    for (let i = 0; i < 30; i++) h.advance();
    expect(h.reference?.step).toBe(h.pool.step);
    expect(h.reference?.cells).not.toEqual(h.pool.cells);
  });
  it('round trips a self-contained experiment', () => {
    const h = new History(createPool(81));
    h.command({ type: 'feed', x: 400, y: 400 });
    for (let i = 0; i < 45; i++) h.advance();
    const restored = readExperiment(h.export());
    expect(restored.pool).toEqual(h.pool);
  });
  it('round trips interventions made in the canvas margin', () => {
    const h = new History(createPool(81));
    h.command({ type: 'feed', x: -140, y: 1500 });
    expect(readExperiment(h.export()).pool).toEqual(h.pool);
  });
  it('rejects malformed or excessive input before replacing any state', () => {
    const h = new History(createPool(81));
    expect(() => readExperiment('{')).toThrow();
    expect(() => readExperiment(JSON.stringify({ version: 'old' }))).toThrow();
    const data = JSON.parse(h.export());
    data.initial.cells[0].energy = -10;
    expect(() => readExperiment(JSON.stringify(data))).toThrow();
    data.initial = createPool(81); data.initial.bonds[0].a = 999999;
    expect(() => readExperiment(JSON.stringify(data))).toThrow();
  });
  it('rejects future events and currents in imported checkpoints', () => {
    const data = JSON.parse(new History(createPool(81)).export());
    data.initial.events.push({ step: 100, text: 'A birth', type: 'birth', x: 100, y: 100 });
    expect(() => readExperiment(JSON.stringify(data))).toThrow();
    data.initial.events = [];
    data.initial.disturbances.push({ born: 100, strength: 1, x: 100, y: 100 });
    expect(() => readExperiment(JSON.stringify(data))).toThrow();
  });
  it('leaves the timeline intact when an invalid intervention is rejected', () => {
    const h = new History(createPool(81));
    h.advance(); h.seek(0);
    const before = h.export();
    expect(() => h.command({ type: 'current', x: NaN, y: 1 })).toThrow();
    expect(h.export()).toBe(before);
    expect(h.branched).toBe(false);
    h.advance();
    expect(h.pool.step).toBe(1);
  });
  it('round trips a busy retained history', () => {
    const pool = createPool(81); pool.cells = []; pool.bonds = [];
    const h = new History(pool);
    for (let i = 0; i < 1001; i++) h.command({ type: 'current', x: 400, y: 400 });
    expect(readExperiment(h.export()).pool).toEqual(h.pool);
  });
});
