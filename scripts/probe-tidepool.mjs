import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server = await createServer({ server: { middlewareMode: true } });
try {
  const { createPool, colonies } = await server.ssrLoadModule('/src/tidepool/world.ts');
  const { stepPool } = await server.ssrLoadModule('/src/tidepool/dynamics.ts');
  const { habitable } = await server.ssrLoadModule('/src/tidepool/geometry.ts');
  const reports = [];
  for (const preset of ['reef', 'channel', 'spores']) {
    const p = createPool(2718, preset), samples = [];
    for (let i = 0; i < 18000; i++) {
      stepPool(p);
      if (p.step % 60 === 0) for (const c of p.cells) {
        assert.ok(habitable(p, c.x, c.y));
        assert.ok([c.x, c.y, c.vx, c.vy, c.energy, c.phase].every(Number.isFinite));
      }
      if (p.step % 1800 === 0) samples.push({ minute: p.step / 1800, cells: p.cells.length, bodies: colonies(p).filter(g => g.cells.length >= 4).length, births: p.divisions, deaths: p.deaths });
    }
    reports.push({ preset, seed: p.seed, samples });
  }
  mkdirSync('captures-cozy', { recursive: true });
  writeFileSync('captures-cozy/long-run.json', JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports));
} finally { await server.close(); }
