import { VERSION, WIDTH, HEIGHT, clamp, random } from './model';
import type { Pool, Cell, Colony, Command, Preset } from './model';
import { projectPosition } from './geometry';

export function addCell(pool: Pool, x: number, y: number, lineage: number, role: number, parent: Cell | null = null): Cell {
  const position = projectPosition(pool, x, y);
  const cell: Cell = {
    id: pool.nextId++, lineage, parent: parent?.id ?? null, ...position, vx: 0, vy: 0,
    energy: parent ? 0.30 : 0.62 + random(pool) * 0.28,
    phase: parent ? parent.phase + 0.25 : random(pool) * Math.PI * 2,
    frequency: parent ? clamp(parent.frequency + (random(pool) - 0.5) * 0.05, 0.6, 2) : 1.0 + lineage * 0.15 + random(pool) * 0.14,
    angle: parent?.angle ?? (random(pool) * 0.6 - 0.3), role, age: 0,
    radius: 3.7 + (role === 2 ? 0.7 : role === 0 ? 0.3 : 0),
    generation: parent ? parent.generation + 1 : 0, cooldown: 0, activity: 0,
  };
  pool.cells.push(cell);
  return cell;
}

function seedBody(pool: Pool, x: number, y: number, lineage: number, shape: 'ribbon' | 'rosette' | 'drifter', angle: number, scale = 1): void {
  const body: Cell[] = [];
  const point = (px: number, py: number, role: number) => {
    const c = addCell(pool, x + (px * Math.cos(angle) - py * Math.sin(angle)) * scale,
      y + (px * Math.sin(angle) + py * Math.cos(angle)) * scale, lineage, role);
    c.angle = angle;
    // A prepared body has a phase gradient, never an animation trajectory.
    c.phase = px * 0.024 + random(pool) * 0.8;
    body.push(c);
  };
  if (shape === 'ribbon') {
    for (let col = 0; col < 18; col++) {
      const px = (col - 8.5) * 12;
      const breadth = 5 + 18 * Math.sin((col + 0.5) / 18 * Math.PI);
      point(px, -breadth, col % 3);
      point(px, breadth, (col + 1) % 3);
      if (col > 1 && col < 16) point(px, 0, 2);
    }
  } else if (shape === 'rosette') {
    point(0, 0, 0);
    for (let ring = 1; ring <= 3; ring++) {
      const count = ring * 7;
      for (let i = 0; i < count; i++) {
        const theta = i / count * Math.PI * 2 + ring * 0.13;
        point(Math.cos(theta) * ring * 14, Math.sin(theta) * ring * 14, ring === 1 ? 0 : i % 3);
      }
    }
  } else {
    for (let col = 0; col < 9; col++) {
      point((col - 4) * 13, Math.sin(col * 0.7) * 15, col % 3);
      point((col - 4) * 13, Math.sin(col * 0.7) * 15 + 15, (col + 1) % 3);
    }
  }
  for (let i = 0; i < body.length; i++) for (let j = i + 1; j < body.length; j++) {
    const distance = Math.hypot(body[i].x - body[j].x, body[i].y - body[j].y);
    if (distance < 25 * scale) pool.bonds.push({ a: body[i].id, b: body[j].id, rest: distance, strain: 0, flow: 0, age: 0 });
  }
}

export function createPool(seed = 2718, preset: Preset = 'reef'): Pool {
  const pool: Pool = {
    version: VERSION, seed: seed >>> 0, rng: seed >>> 0, step: 0, preset, nextId: 1,
    cells: [], bonds: [], nutrients: [], obstacles: [], disturbances: [], events: [], births: 0, deaths: 0, divisions: 0,
  };
  const shift = () => (random(pool) - 0.5) * 80;
  pool.obstacles = preset === 'channel' ? [
    { x: 800, y: 150, rx: 175, ry: 240, seed: 1 }, { x: 810, y: 825, rx: 210, ry: 295, seed: 2 },
  ] : [
    { x: 115, y: 835, rx: 265, ry: 190, seed: 2 }, { x: 1340, y: 90, rx: 300, ry: 180, seed: 3 },
    { x: 1060, y: 1000, rx: 330, ry: 180, seed: 4 }, { x: -60, y: 110, rx: 270, ry: 220, seed: 5 },
  ];
  const sites = preset === 'channel' ? [[640, 465, 90], [1060, 470, 110], [1320, 430, 100]] :
    [[700, 370, 135], [400, 620, 110], [1120, 560, 130], [850, 750, 90], [290, 320, 95]];
  for (const [x, y, radius] of sites) pool.nutrients.push({ id: pool.nextId++, x, y, radius, amount: 1, supply: 0.024 });
  if (preset === 'spores') {
    for (let i = 0; i < 150; i++) {
      const lineage = i % 4, cx = [560, 1000, 400, 1100][lineage], cy = [330, 400, 580, 680][lineage];
      addCell(pool, cx + (random(pool) - 0.5) * 190, cy + (random(pool) - 0.5) * 130, lineage, i % 3);
    }
  } else if (preset === 'channel') {
    seedBody(pool, 475 + shift(), 466 + shift() * 0.2, 0, 'ribbon', 0);
    seedBody(pool, 325, 580, 1, 'rosette', -0.4);
    seedBody(pool, 1020, 410, 2, 'drifter', 0.4);
  } else {
    seedBody(pool, 650 + shift(), 370 + shift(), 0, 'ribbon', -0.34, 1.2);
    seedBody(pool, 398 + shift(), 610 + shift(), 1, 'rosette', 0.2, 1.2);
    seedBody(pool, 1110 + shift(), 535 + shift(), 2, 'drifter', -0.55, 1.2);
    seedBody(pool, 850 + shift(), 710 + shift(), 3, 'ribbon', 0.48, 0.8);
    seedBody(pool, 1040 + shift(), 300 + shift(), 1, 'rosette', 0.4, 0.65);
    for (let i = 0; i < 16; i++) addCell(pool, 300 + random(pool) * 950, 200 + random(pool) * 540, i % 4, i % 3);
  }
  pool.births = pool.cells.length;
  return pool;
}

export function clonePool(pool: Pool): Pool { return structuredClone(pool); }

export function colonies(pool: Pool): Colony[] {
  const byId = new Map(pool.cells.map(c => [c.id, c]));
  const adjacent = new Map<number, number[]>();
  for (const b of pool.bonds) {
    if (!adjacent.has(b.a)) adjacent.set(b.a, []);
    if (!adjacent.has(b.b)) adjacent.set(b.b, []);
    adjacent.get(b.a)!.push(b.b); adjacent.get(b.b)!.push(b.a);
  }
  const seen = new Set<number>(), groups: Colony[] = [];
  for (const start of pool.cells) {
    if (seen.has(start.id)) continue;
    const cells: Cell[] = [], queue = [start.id]; seen.add(start.id);
    while (queue.length) {
      const id = queue.pop()!, c = byId.get(id);
      if (!c) continue;
      cells.push(c);
      for (const next of adjacent.get(id) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    const n = cells.length, x = cells.reduce((s, c) => s + c.x, 0) / n, y = cells.reduce((s, c) => s + c.y, 0) / n;
    groups.push({ id: Math.min(...cells.map(c => c.id)), lineage: start.lineage, cells, x, y,
      energy: cells.reduce((s, c) => s + c.energy, 0) / n,
      coherence: Math.hypot(cells.reduce((s, c) => s + Math.cos(c.phase), 0), cells.reduce((s, c) => s + Math.sin(c.phase), 0)) / n,
      radius: Math.max(...cells.map(c => Math.hypot(c.x - x, c.y - y))) + 8,
    });
  }
  return groups.sort((a, b) => b.cells.length - a.cells.length || a.id - b.id);
}

export function event(pool: Pool, text: string, x: number, y: number, type: Pool['events'][number]['type']): void {
  pool.events.push({ step: pool.step, text, x, y, type });
  if (pool.events.length > 80) pool.events.shift();
}

export function distanceToSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

export function normalizeCommand(command: Command): Command {
  if (!['feed', 'current', 'cut'].includes(command.type) || !Number.isFinite(command.x) || !Number.isFinite(command.y) ||
    (command.radius !== undefined && (!Number.isFinite(command.radius) || command.radius < 1 || command.radius > 200)) ||
    (command.strength !== undefined && (!Number.isFinite(command.strength) || Math.abs(command.strength) > 5))) {
    throw new Error('Interventions require finite coordinates, a radius of 1–200 and strength from −5 to 5.');
  }
  return { ...command, x: clamp(command.x, 20, WIDTH - 20), y: clamp(command.y, 20, HEIGHT - 20) };
}

export function applyCommand(pool: Pool, input: Command): void {
  const command = normalizeCommand(input), { x, y } = command;
  if (command.type === 'feed') {
    if (pool.nutrients.length >= 40) pool.nutrients.splice(pool.nutrients.findIndex(n => n.supply === 0), 1);
    pool.nutrients.push({ id: pool.nextId++, x, y, radius: 85, amount: 1, supply: 0 });
    event(pool, 'A new source of nourishment', x, y, 'input');
  } else if (command.type === 'current') {
    pool.disturbances.push({ x, y, strength: command.strength ?? 1, born: pool.step });
    if (pool.disturbances.length > 12) pool.disturbances.shift();
    event(pool, 'A current passes through the pool', x, y, 'input');
  } else {
    const map = new Map(pool.cells.map(c => [c.id, c])), before = pool.bonds.length;
    pool.bonds = pool.bonds.filter(bond => {
      const a = map.get(bond.a)!, b = map.get(bond.b)!;
      if (distanceToSegment(x, y, a.x, a.y, b.x, b.y) > (command.radius ?? 24)) return true;
      a.cooldown = b.cooldown = pool.step + 240;
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1;
      a.vx += dx / d * 9; a.vy += dy / d * 9; b.vx -= dx / d * 9; b.vy -= dy / d * 9;
      return false;
    });
    event(pool, before > pool.bonds.length ? `${before - pool.bonds.length} connections severed` : 'No connections here', x, y, 'input');
  }
}
