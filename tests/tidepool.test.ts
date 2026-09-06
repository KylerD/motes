import { describe, it, expect } from 'vitest';
import { createPool, clonePool, colonies, applyCommand, addCell } from '../src/tidepool/world';
import { habitable } from '../src/tidepool/geometry';
import { stepPool, transferEnergy } from '../src/tidepool/dynamics';

describe('tidepool physics', () => {
  it.each([42, 2718])('starts every cell outside solid shelves: %i', seed => {
    const p = createPool(seed);
    for (const c of p.cells) for (const r of p.obstacles)
      expect(Math.hypot((c.x-r.x)/(r.rx+7), (c.y-r.y)/(r.ry+7))).toBeGreaterThanOrEqual(1);
  });
  it('rejects invalid interventions before mutating the world', () => {
    const p = createPool(42), original = clonePool(p);
    for (const cmd of [{ type: 'current' as const, x: NaN, y: 100 }, { type: 'current' as const, x: 100, y: 100, strength: 1e308 }, { type: 'cut' as const, x: 100, y: 100, radius: NaN }])
      expect(() => applyCommand(p, cmd)).toThrow();
    expect(p).toEqual(original);
  });
  it('reproduces complete state from the same seed', () => {
    const a = createPool(42), b = createPool(42);
    for (let i = 0; i < 180; i++) { stepPool(a); stepPool(b); }
    expect(a).toEqual(b);
    expect(createPool(43).cells).not.toEqual(createPool(42).cells);
  });
  it('keeps energy transfers conservative and bounded', () => {
    const pool = createPool(42), a = pool.cells[0], b = pool.cells[1];
    a.energy = 0.98; b.energy = 0.02;
    const total = a.energy + b.energy;
    transferEnergy(a, b, 100);
    expect(a.energy + b.energy).toBeCloseTo(total, 12);
    expect(a.energy).toBeGreaterThanOrEqual(0);
    expect(b.energy).toBeLessThanOrEqual(1);
    expect(a.energy).toBeGreaterThanOrEqual(b.energy);
  });
  it('charges for successful growth and keeps newborns inside the habitat', () => {
    let births = 0;
    for (let seed = 0; seed < 100; seed++) {
      const p = createPool(seed); p.cells = []; p.bonds = []; p.nutrients = []; p.step = 29;
      const parent = addCell(p, 15, 480, 0, 0); parent.age = 100; parent.energy = 1;
      const control = clonePool(p); stepPool(control, { growth: false }); stepPool(p);
      for (const c of p.cells) expect(habitable(p, c.x, c.y)).toBe(true);
      if (p.cells.length > 1) {
        births++;
        expect(p.cells[0].energy).toBeCloseTo(control.cells[0].energy - 0.36, 10);
        expect(p.cells[1].energy).toBe(0.30);
      } else expect(p.cells[0].energy).toBe(control.cells[0].energy);
    }
    expect(births).toBeGreaterThan(0);
  });
  it.each([11, 42, 97])('moves living bodies with finite, bounded state: %i', seed => {
    const pool = createPool(seed), first = pool.cells[0];
    const origin = { x: first.x, y: first.y };
    for (let i = 0; i < 600; i++) stepPool(pool, { growth: false });
    expect(Math.hypot(first.x - origin.x, first.y - origin.y)).toBeGreaterThan(5);
    for (const cell of pool.cells) {
      expect([cell.x, cell.y, cell.vx, cell.vy, cell.energy, cell.phase].every(Number.isFinite)).toBe(true);
      expect(cell.energy).toBeGreaterThan(0);
      expect(cell.energy).toBeLessThanOrEqual(1);
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThanOrEqual(1600);
    }
  });
  it('severing bonds has a real topological and motion consequence', () => {
    const a = createPool(42), b = clonePool(a), before = b.bonds.length;
    const target = b.cells[7];
    applyCommand(b, { type: 'cut', x: target.x, y: target.y, radius: 45 });
    expect(b.bonds.length).toBeLessThan(before);
    expect(colonies(b).length).toBeGreaterThan(colonies(a).length);
    for (let i = 0; i < 90; i++) { stepPool(a); stepPool(b); }
    expect(b.cells.map(c => [c.x, c.y])).not.toEqual(a.cells.map(c => [c.x, c.y]));
  });
  it('restores an independent complete checkpoint', () => {
    const pool = createPool(42), saved = clonePool(pool), expected = clonePool(pool);
    for (let i = 0; i < 20; i++) stepPool(pool);
    expect(saved).toEqual(expected);
    expect(pool).not.toEqual(saved);
  });
  it('coupling affects the physical motion, not only decoration', () => {
    const a = createPool(42), b = clonePool(a);
    for (let i = 0; i < 120; i++) { stepPool(a); stepPool(b, { coupling: false }); }
    expect(a.cells[0].phase).not.toEqual(b.cells[0].phase);
    expect(a.cells[0].x).not.toEqual(b.cells[0].x);
  });
});
