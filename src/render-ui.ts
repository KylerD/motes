// render-ui.ts — Cursor, ripples, event message, debug overlay.

import { W, H } from "./config";
import type { Interaction } from "./types";
import { setPixel } from "./render";
import { drawText, drawTextRight } from "./font";
import { isEventActive } from "./events";
import type { ActiveEvent } from "./types";

/** Render click ripples */
export function renderRipples(buf: ImageData, input: Interaction, dt: number): void {
  for (let i = input.ripples.length - 1; i >= 0; i--) {
    const rp = input.ripples[i];
    const r = Math.round(rp.radius);
    const ra = Math.round(rp.alpha * 200);
    const r2inner = (r - 1) * (r - 1);
    const r2outer = (r + 1) * (r + 1);
    for (let dy = -r - 1; dy <= r + 1; dy++) {
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2inner && d2 <= r2outer) {
          setPixel(buf, Math.round(rp.x) + dx, Math.round(rp.y) + dy, 220, 224, 228, ra);
        }
      }
    }
    rp.radius += dt * 30;
    rp.alpha -= dt * 2.2;
    if (rp.alpha <= 0) input.ripples.splice(i, 1);
  }
}

/** Render cursor indicator */
export function renderCursor(buf: ImageData, input: Interaction): void {
  if (!input.present) return;
  const cr = 5;
  const cx = Math.round(input.x);
  const cy = Math.round(input.y);
  const cr2inner = (cr - 1) * (cr - 1);
  const cr2outer = cr * cr;
  for (let dy = -cr; dy <= cr; dy++) {
    for (let dx = -cr; dx <= cr; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 >= cr2inner && d2 <= cr2outer) {
        setPixel(buf, cx + dx, cy + dy, 220, 224, 228, 40);
      }
    }
  }
}

/** Render event message flash */
export function renderEventMessage(
  buf: ImageData,
  event: ActiveEvent | null,
  time: number,
): void {
  if (!event || !isEventActive(event, time) || event.messageAlpha <= 0) return;
  const msgX = Math.floor((W - event.message.length * 4) / 2);
  const msgY = Math.floor(H * 0.3);
  if (event.messageAlpha > 0.3) {
    drawText(buf, msgX, msgY, event.message, 5);
  } else {
    drawText(buf, msgX, msgY, event.message, 4);
  }
}

/** Render debug overlay */
export function renderDebugOverlay(
  buf: ImageData,
  phaseName: string,
  moteCount: number,
  clusterCount: number,
  dt: number,
): void {
  const info = `${phaseName.toUpperCase()} M:${moteCount} C:${clusterCount}`;
  drawText(buf, 2, 2, info, 5);
  const fps = `${Math.round(1 / Math.max(dt, 0.001))} FPS`;
  drawTextRight(buf, W - 2, 2, fps, 5);
}
