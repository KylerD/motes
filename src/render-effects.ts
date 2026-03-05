// render-effects.ts — Visual effects: eclipse, aurora, meteor, impact, crater, vignette, phase flash.

import { W, H } from "./config";
import type { Mote, ActiveEvent } from "./types";
import { setPixel } from "./render";
import { getMeteorPosition } from "./events";

/** Draw aurora light curtains in the sky */
export function renderAuroraCurtains(buf: ImageData, time: number, eventStart: number): void {
  const elapsed = time - eventStart;
  const intensity = Math.min(1, elapsed / 3);

  for (let x = 0; x < W; x++) {
    const curtain1 = Math.sin(x * 0.08 + time * 0.5) * 0.5 + 0.5;
    const curtain2 = Math.sin(x * 0.05 - time * 0.3 + 2) * 0.3 + 0.5;
    const curtain3 = Math.sin(x * 0.12 + time * 0.7 + 4) * 0.2 + 0.5;
    const curtainStrength = (curtain1 + curtain2 + curtain3) / 3;

    const maxY = Math.floor(H * 0.5);
    for (let y = 0; y < maxY; y++) {
      const yFade = 1 - y / maxY;
      const alpha = Math.round(curtainStrength * yFade * intensity * 35);
      if (alpha < 3) continue;

      const colorT = (Math.sin(x * 0.04 + time * 0.2) + 1) / 2;
      const ar = Math.round(40 + colorT * 80);
      const ag = Math.round(180 - colorT * 40);
      const ab = Math.round(100 + colorT * 80);
      setPixel(buf, x, y, ar, ag, ab, alpha);
    }
  }
}

/** Render eclipse darkness, stars, and glowing mote eyes */
export function renderEclipse(
  buf: ImageData,
  event: ActiveEvent,
  time: number,
  motes: Mote[],
  moteColors: Map<Mote, [number, number, number]>,
  cycleNumber: number,
): void {
  const eclipseElapsed = time - event.startTime;
  const eclipseProgress = eclipseElapsed / event.duration;
  const darkness = eclipseProgress < 0.15
    ? eclipseProgress / 0.15
    : eclipseProgress > 0.85
      ? (1 - eclipseProgress) / 0.15
      : 1.0;
  const dimFactor = 0.12 + (1 - darkness) * 0.88;
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] * dimFactor;
    d[i + 1] = d[i + 1] * dimFactor;
    d[i + 2] = Math.min(255, d[i + 2] * dimFactor * 1.3);
  }

  // Stars emerge
  if (darkness > 0.3) {
    const starAlpha = Math.round((darkness - 0.3) / 0.7 * 200);
    const starSeed = cycleNumber * 31337;
    for (let i = 0; i < 40; i++) {
      const sx = Math.abs((starSeed + i * 7919) % W);
      const sy = Math.abs((starSeed + i * 4793) % Math.floor(H * 0.5));
      const brightness = (starSeed + i * 2287) % 3;
      const twinkle = Math.sin(time * (2 + i * 0.3) + i) * 0.3 + 0.7;
      const sa = Math.round(starAlpha * twinkle);
      if (brightness === 0) {
        setPixel(buf, sx, sy, 220, 230, 255, sa);
        setPixel(buf, sx - 1, sy, 180, 190, 220, Math.round(sa * 0.4));
        setPixel(buf, sx + 1, sy, 180, 190, 220, Math.round(sa * 0.4));
        setPixel(buf, sx, sy - 1, 180, 190, 220, Math.round(sa * 0.4));
        setPixel(buf, sx, sy + 1, 180, 190, 220, Math.round(sa * 0.4));
      } else {
        setPixel(buf, sx, sy, 200, 210, 240, Math.round(sa * 0.6));
      }
    }
  }

  // Mote eyes glow in darkness
  if (darkness > 0.2) {
    const glowIntensity = (darkness - 0.2) / 0.8;
    for (const m of motes) {
      const ga = Math.round(glowIntensity * 255 * m.energy);
      const dir = m.direction;
      if (dir > 0) {
        setPixel(buf, m.x, m.y - 1, 255, 255, 240, ga);
        setPixel(buf, m.x + 1, m.y - 1, 255, 255, 240, ga);
      } else {
        setPixel(buf, m.x - 1, m.y - 1, 255, 255, 240, ga);
        setPixel(buf, m.x, m.y - 1, 255, 255, 240, ga);
      }
      const ha = Math.round(ga * 0.15);
      const [mcr, mcg, mcb] = moteColors.get(m)!;
      setPixel(buf, m.x, m.y, mcr, mcg, mcb, ha);
    }
  }
}

/** Aurora luminous boost — brightens the scene */
export function applyAuroraBoost(buf: ImageData): void {
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i] * 1.08);
    d[i + 1] = Math.min(255, d[i + 1] * 1.12);
    d[i + 2] = Math.min(255, d[i + 2] * 1.18);
  }
}

/** Meteor visual state — tracks impact flash between frames */
export interface MeteorState {
  wasVisible: boolean;
  impactFlash: number;
  impactX: number;
  impactY: number;
}

export function createMeteorState(): MeteorState {
  return { wasVisible: false, impactFlash: 0, impactX: 0, impactY: 0 };
}

/** Render meteor fireball + trail, and manage impact flash state */
export function renderMeteorVisual(
  buf: ImageData,
  ms: MeteorState,
  event: ActiveEvent | null,
  time: number,
  cycleNumber: number,
  dt: number,
): void {
  const meteorPos = getMeteorPosition(event, time, cycleNumber);
  if (meteorPos) {
    const mx = Math.round(meteorPos.x);
    const my = Math.round(meteorPos.y);
    // Bright 3x3 head
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist === 0) {
          setPixel(buf, mx, my, 255, 255, 220, 255);
        } else {
          setPixel(buf, mx + dx, my + dy, 255, 200, 100, 220);
        }
      }
    }
    // Fiery trail
    for (let i = 1; i <= 15; i++) {
      const ta = Math.round(220 * (1 - i / 15));
      const tr = Math.round(255 - i * 6);
      const tg = Math.round(180 - i * 10);
      const tb = Math.max(0, Math.round(80 - i * 4));
      setPixel(buf, mx + i, my - i, tr, tg, tb, ta);
      if (i < 10) {
        setPixel(buf, mx + i, my - i + 1, tr, tg, tb, Math.round(ta * 0.5));
        setPixel(buf, mx + i + 1, my - i, tr, tg, tb, Math.round(ta * 0.5));
      }
      if (i % 3 === 0 && i < 12) {
        const sparkY = my - i + (i % 2 === 0 ? 2 : -1);
        setPixel(buf, mx + i + 1, sparkY, 255, 220, 100, Math.round(ta * 0.7));
      }
    }
    ms.wasVisible = true;
    ms.impactX = mx;
    ms.impactY = my;
  } else if (ms.wasVisible) {
    ms.wasVisible = false;
    ms.impactFlash = 1.0;
  }

  // Impact flash
  if (ms.impactFlash > 0) {
    const flashRadius = Math.round((1 - ms.impactFlash) * 24 + 4);
    for (let dy = -flashRadius; dy <= flashRadius; dy++) {
      for (let dx = -flashRadius; dx <= flashRadius; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 <= flashRadius * flashRadius) {
          const falloff = 1 - Math.sqrt(d2) / flashRadius;
          const fa = Math.round(ms.impactFlash * 250 * falloff);
          const heat = falloff;
          setPixel(buf, ms.impactX + dx, ms.impactY + dy,
            Math.round(255 * heat + 180 * (1 - heat)),
            Math.round(240 * heat + 100 * (1 - heat)),
            Math.round(200 * heat + 40 * (1 - heat)),
            fa);
        }
      }
    }
    ms.impactFlash = Math.max(0, ms.impactFlash - dt * 2.0);
  }
}

/** Meteor crater afterglow */
export function renderCraterGlow(
  buf: ImageData,
  event: ActiveEvent,
  time: number,
): void {
  if (event.data.craterX === undefined) return;
  const craterElapsed = time - event.startTime;
  const glowLife = Math.max(0, 1 - (craterElapsed - 2) / 10);
  if (glowLife <= 0) return;

  const cx = event.data.craterX;
  const cy = event.data.craterY;
  const glowR = 8;
  for (let dy = -glowR; dy <= glowR; dy++) {
    for (let dx = -glowR; dx <= glowR; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= glowR * glowR) {
        const falloff = 1 - Math.sqrt(d2) / glowR;
        const ga = Math.round(glowLife * 30 * falloff);
        if (ga > 0) setPixel(buf, cx + dx, cy + dy, 255, 120, 40, ga);
      }
    }
  }
}

/** Phase transition pulse — subtle brightness flash */
export function renderPhaseFlash(buf: ImageData, phaseFlash: number): void {
  if (phaseFlash <= 0) return;
  const boost = phaseFlash * 0.08;
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = Math.min(255, Math.round(d[i] * (1 + boost)));
    d[i + 1] = Math.min(255, Math.round(d[i + 1] * (1 + boost)));
    d[i + 2] = Math.min(255, Math.round(d[i + 2] * (1 + boost)));
  }
}

/** Vignette — darken edges */
export function applyVignette(buf: ImageData): void {
  const cx = W / 2;
  const cy = H / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const d = buf.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const fade = dist < 0.65 ? 1 : 1 - (dist - 0.65) * 1.2;
      const f = Math.max(0.55, fade);
      const i = (y * W + x) * 4;
      d[i] = d[i] * f;
      d[i + 1] = d[i + 1] * f;
      d[i + 2] = d[i + 2] * f;
    }
  }
}
