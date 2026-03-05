// render-bonds.ts — Bond lines, cluster glow, death particles.

import type { Mote, DeathRecord } from "./types";
import { setPixel } from "./render";
import { drawLine } from "./render";

/** Draw soft glow around bonded clusters */
export function renderClusterGlow(
  buf: ImageData,
  cluster: Mote[],
  colors: Map<Mote, [number, number, number]>,
  time: number,
): void {
  let cx = 0, cy = 0, avgR = 0, avgG = 0, avgB = 0;
  for (const m of cluster) {
    cx += m.x; cy += m.y;
    const [r, g, b] = colors.get(m)!;
    avgR += r; avgG += g; avgB += b;
  }
  cx /= cluster.length; cy /= cluster.length;
  avgR = Math.round(avgR / cluster.length);
  avgG = Math.round(avgG / cluster.length);
  avgB = Math.round(avgB / cluster.length);

  const radius = Math.min(16, 6 + cluster.length * 1.5);
  const pulse = Math.sin(time * 2 + cx * 0.1) * 0.15 + 0.85;
  const maxAlpha = Math.min(30, 10 + cluster.length * 3) * pulse;

  const rcx = Math.round(cx);
  const rcy = Math.round(cy);
  const r2 = radius * radius;

  for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const falloff = 1 - Math.sqrt(d2) / radius;
      const a = Math.round(maxAlpha * falloff * falloff);
      if (a < 2) continue;
      setPixel(buf, rcx + dx, rcy + dy, avgR, avgG, avgB, a);
    }
  }
}

/** Draw bond lines between connected motes */
export function renderBondLines(
  buf: ImageData,
  motes: Mote[],
  moteColors: Map<Mote, [number, number, number]>,
  time: number,
): void {
  const drawn = new Set<string>();
  for (const m of motes) {
    for (const bonded of m.bonds) {
      const bdx = bonded.x - m.x;
      const bdy = bonded.y - m.y;
      if (bdx * bdx + bdy * bdy > 50 * 50) continue;
      const key = m.x < bonded.x
        ? `${m.x},${m.y}-${bonded.x},${bonded.y}`
        : `${bonded.x},${bonded.y}-${m.x},${m.y}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      const [r1, g1, b1] = moteColors.get(m)!;
      const [r2, g2, b2] = moteColors.get(bonded)!;
      const avgR = Math.round((r1 + r2) / 2);
      const avgG = Math.round((g1 + g2) / 2);
      const avgB = Math.round((b1 + b2) / 2);

      const flash = Math.max(m.bondFlash, bonded.bondFlash);
      const bondPulse = Math.sin(time * 3 + m.x * 0.05 + bonded.x * 0.05) * 0.15 + 0.85;
      const bondAlpha = Math.round((160 + flash * 95) * bondPulse);
      drawLine(buf, m.x, m.y, bonded.x, bonded.y, avgR, avgG, avgB, bondAlpha);
      const glowAlpha = Math.round(bondAlpha * 0.35);
      drawLine(buf, m.x, m.y - 1, bonded.x, bonded.y - 1, avgR, avgG, avgB, glowAlpha);
    }
  }
}

/** Death particles — rising souls + ground marks */
export function renderDeathParticles(
  buf: ImageData,
  deaths: DeathRecord[],
  time: number,
): void {
  for (const d of deaths) {
    const age = time - d.time;

    // Soul rise phase
    if (age < 1.2) {
      const life = 1 - age / 1.2;
      const alpha = Math.round(life * 200);
      const spread = age * 20;
      const rise = age * 8;
      setPixel(buf, d.x, d.y, d.r, d.g, d.b, alpha);
      const pa = Math.round(alpha * 0.6);
      setPixel(buf, d.x, d.y - spread - rise, 255, 255, 255, Math.round(pa * 0.8));
      setPixel(buf, d.x - spread, d.y - rise, d.r, d.g, d.b, pa);
      setPixel(buf, d.x + spread, d.y - rise, d.r, d.g, d.b, pa);
      setPixel(buf, d.x, d.y - spread * 1.5 - rise, d.r, d.g, d.b, Math.round(pa * 0.4));
      setPixel(buf, d.x - 1, d.y - spread * 0.7 - rise, d.r, d.g, d.b, Math.round(pa * 0.3));
      setPixel(buf, d.x + 1, d.y - spread * 0.7 - rise, d.r, d.g, d.b, Math.round(pa * 0.3));
    }

    // Ground mark phase
    if (age >= 1.0 && age < 6) {
      const markLife = 1 - (age - 1.0) / 5.0;
      const ma = Math.round(markLife * 25);
      if (ma > 0) setPixel(buf, d.x, d.y, d.r, d.g, d.b, ma);
    }
  }
}
