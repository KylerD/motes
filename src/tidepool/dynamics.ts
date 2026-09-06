import { DT, WIDTH, HEIGHT, MAX_CELLS, clamp, random, LINEAGES } from './model';
import type { Pool, Cell } from './model';
import { addCell, event } from './world';
import { habitable, projectPosition } from './geometry';

/** Conservative diffusion; even arbitrarily large dt cannot overshoot equilibrium. */
export function transferEnergy(a: Cell, b: Cell, dt: number): number {
  const delta = (a.energy - b.energy) * Math.min(0.5, dt * 0.18);
  a.energy -= delta; b.energy += delta;
  return delta;
}

export function stepPool(pool: Pool, options: { coupling?: boolean; growth?: boolean } = {}): void {
  pool.step++;
  const cells = pool.cells, n = cells.length;
  const index = new Map(cells.map((c, i) => [c.id, i]));
  const fx = new Float64Array(n), fy = new Float64Array(n), phase = new Float64Array(n), degree = new Uint8Array(n);
  const bondSet = new Set<string>();
  for (const b of pool.bonds) {
    const ia = index.get(b.a), ib = index.get(b.b);
    if (ia === undefined || ib === undefined) continue;
    const a = cells[ia], c = cells[ib], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.001;
    degree[ia]++; degree[ib]++;
    const contraction = options.coupling === false ? 1 : 1 - 0.085 * Math.sin((a.phase + c.phase) * 0.5);
    const rest = b.rest * contraction;
    const force = clamp((d - rest) * 18, -160, 160);
    fx[ia] += dx / d * force; fy[ia] += dy / d * force;
    fx[ib] -= dx / d * force; fy[ib] -= dy / d * force;
    b.strain = Math.abs(d - b.rest) / b.rest;
    b.flow = transferEnergy(a, c, DT);
    b.age += DT;
    if (options.coupling !== false) {
      const sync = Math.sin(c.phase - a.phase) * 1.8;
      phase[ia] += sync; phase[ib] -= sync;
    }
    bondSet.add(`${Math.min(a.id, c.id)}:${Math.max(a.id, c.id)}`);
  }
  // Neighbour interactions use one stable, symmetric pair traversal.
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = cells[i], b = cells[j], dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) > 22 || Math.abs(dy) > 22) continue;
    const d = Math.hypot(dx, dy) || 0.001;
    const exclusion = a.radius + b.radius + 2.3;
    if (d < exclusion) {
      const force = Math.min(180, (exclusion - d) * 25);
      fx[i] -= dx / d * force; fy[i] -= dy / d * force;
      fx[j] += dx / d * force; fy[j] += dy / d * force;
    }
    if (pool.step % 15 === 0 && d > exclusion * 0.9 && d < 17 && a.lineage === b.lineage && degree[i] < 5 && degree[j] < 5 &&
      a.cooldown < pool.step && b.cooldown < pool.step && !bondSet.has(`${a.id}:${b.id}`)) {
      pool.bonds.push({ a: a.id, b: b.id, rest: d, strain: 0, flow: 0, age: 0 });
      degree[i]++; degree[j]++;
    }
  }
  const removed = new Set<number>();
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    c.age += DT;
    c.phase += (c.frequency + phase[i] / Math.max(1, degree[i])) * DT;
    // Retaining an unwrapped phase avoids an artificial discontinuity in elastic contraction.
    let gx = 0, gy = 0, gain = 0;
    for (const resource of pool.nutrients) {
      const dx = resource.x - c.x, dy = resource.y - c.y, d = Math.hypot(dx, dy) || 1;
      if (d < 450 && resource.amount > 0.03) {
        const weight = resource.amount * Math.exp(-d / 130);
        gx += dx / d * weight; gy += dy / d * weight;
      }
      if (d < resource.radius && resource.amount > 0) {
        const uptake = Math.min(resource.amount, DT * (c.role === 0 ? 0.065 : 0.014) * (1 - d / resource.radius));
        gain += uptake;
        // Resource amount uses reservoir units: 1 reservoir = 1/0.06 cell-energy units.
        resource.amount -= uptake * 0.06;
      }
    }
    if (Math.hypot(gx, gy) > 0.008) {
      const desired = Math.atan2(gy, gx);
      c.angle += Math.atan2(Math.sin(desired - c.angle), Math.cos(desired - c.angle)) * DT * 0.65;
    } else c.angle += Math.sin(c.id * 4.7 + pool.step * DT * 0.11) * DT * 0.08;
    const pulse = 0.45 + 0.55 * (Math.sin(c.phase) * 0.5 + 0.5);
    const thrust = (c.role === 1 ? 27 : c.role === 0 ? 4.5 : 6) * pulse * (0.25 + c.energy * 0.75);
    fx[i] += Math.cos(c.angle) * thrust; fy[i] += Math.sin(c.angle) * thrust;
    const t = pool.step * DT;
    fx[i] += (pool.preset === 'channel' ? 7 : 1.5) + Math.sin(c.y * 0.012 + t * 0.12) * 2;
    fy[i] += Math.cos(c.x * 0.009 - t * 0.13) * 1.8;
    for (const flow of pool.disturbances) {
      const age = (pool.step - flow.born) * DT, dx = c.x - flow.x, dy = c.y - flow.y, d = Math.hypot(dx, dy) || 1;
      const strength = flow.strength * 90 * Math.exp(-d * d / 55000) * Math.max(0, 1 - age / 7);
      fx[i] += (dx / d - dy / d * 0.8) * strength;
      fy[i] += (dy / d + dx / d * 0.8) * strength;
    }
    c.energy = clamp(c.energy + gain - DT * (0.0045 + thrust * 0.00015 + degree[i] * 0.00012), 0, 1);
    c.activity = pulse;
    c.vx = clamp((c.vx + fx[i] * DT) * Math.exp(-2.1 * DT), -65, 65);
    c.vy = clamp((c.vy + fy[i] * DT) * Math.exp(-2.1 * DT), -65, 65);
    c.x = clamp(c.x + c.vx * DT, 15, WIDTH - 15); c.y = clamp(c.y + c.vy * DT, 15, HEIGHT - 15);
    if (!habitable(pool, c.x, c.y)) {
      const position = projectPosition(pool, c.x, c.y);
      c.x = position.x; c.y = position.y; c.vx *= 0.3; c.vy *= 0.3;
    }
    if (c.energy <= 0) {
      removed.add(c.id); pool.deaths++;
      // Stored energy is exhausted, but a fixed fraction of structural biomass remains as detritus.
      if (pool.nutrients.length < 40) pool.nutrients.push({ id: pool.nextId++, x: c.x, y: c.y, radius: 23, amount: 0.12, supply: 0 });
      if (pool.step % 30 === 0) event(pool, 'A cell returns to the pool', c.x, c.y, 'death');
    }
  }
  const priorBonds = pool.bonds.length;
  pool.bonds = pool.bonds.filter(b => !removed.has(b.a) && !removed.has(b.b) && b.strain < 1.5);
  if (priorBonds - pool.bonds.length > 3 && removed.size === 0) event(pool, 'A body yields to the current', cells[0]?.x ?? 800, cells[0]?.y ?? 480, 'split');
  if (removed.size) pool.cells = pool.cells.filter(c => !removed.has(c.id));
  for (const resource of pool.nutrients) resource.amount = Math.min(1, resource.amount + resource.supply * DT);
  pool.nutrients = pool.nutrients.filter(r => r.supply > 0 || r.amount > 0.005);
  pool.disturbances = pool.disturbances.filter(d => (pool.step - d.born) * DT < 7);
  if (options.growth !== false && pool.step % 30 === 0 && pool.cells.length < MAX_CELLS) {
    for (const c of pool.cells.slice()) {
      if (pool.cells.length >= MAX_CELLS) break;
      if (c.energy < 0.92 || c.age < 18 || c.cooldown > pool.step || random(pool) > 0.08) continue;
      const angle = random(pool) * Math.PI * 2, x = c.x + Math.cos(angle) * 12, y = c.y + Math.sin(angle) * 12;
      if (!habitable(pool, x, y)) continue;
      if (pool.cells.some(other => Math.hypot(other.x - x, other.y - y) < 9)) continue;
      c.energy -= 0.36;
      c.cooldown = pool.step + 450;
      const child = addCell(pool, x, y, c.lineage, (c.role + 1) % 3, c);
      pool.bonds.push({ a: c.id, b: child.id, rest: 12, strain: 0, flow: 0, age: 0 });
      pool.divisions++; pool.births++;
      event(pool, `${LINEAGES[c.lineage].name} grows a new cell`, x, y, 'birth');
    }
  }
}
