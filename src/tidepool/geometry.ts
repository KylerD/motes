import { WIDTH, HEIGHT, clamp } from './model';
import type { Pool } from './model';

export function habitable(pool: Pool, x: number, y: number): boolean {
  return x >= 15 && x <= WIDTH - 15 && y >= 15 && y <= HEIGHT - 15 &&
    pool.obstacles.every(r => Math.hypot((x - r.x) / (r.rx + 7), (y - r.y) / (r.ry + 7)) >= 1);
}

/** Project onto a feasible shelf boundary, including where a shelf intersects a wall. */
export function projectPosition(pool: Pool, x: number, y: number): { x: number; y: number } {
  x = clamp(x, 15, WIDTH - 15); y = clamp(y, 15, HEIGHT - 15);
  if (habitable(pool, x, y)) return { x, y };
  let best: { x: number; y: number } | null = null, distance = Infinity;
  const candidate = (px: number, py: number) => {
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < distance && habitable(pool, px, py)) { best = { x: px, y: py }; distance = d; }
  };
  for (const r of pool.obstacles) {
    const theta = Math.atan2((y - r.y) / r.ry, (x - r.x) / r.rx);
    candidate(r.x + Math.cos(theta) * (r.rx + 8), r.y + Math.sin(theta) * (r.ry + 8));
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * Math.PI * 2;
      candidate(r.x + Math.cos(a) * (r.rx + 8), r.y + Math.sin(a) * (r.ry + 8));
    }
  }
  return best ?? { x, y };
}
