// render.ts — Canvas pipeline. 256×144 pixels, scaled up with nearest-neighbor.

import { W, H } from "./config";
import type { RenderContext } from "./types";

// Re-export for backward compatibility during migration
export { W, H };
export type { RenderContext };

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingEnabled = false;

  const buf = ctx.createImageData(W, H);
  // Init to opaque black
  const d = buf.data;
  for (let i = 3; i < d.length; i += 4) d[i] = 255;

  return { ctx, buf };
}

/** Set a single pixel in the buffer by palette index */
export function setPixel(
  buf: ImageData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
  const i = (iy * W + ix) * 4;
  if (a >= 255) {
    buf.data[i] = r;
    buf.data[i + 1] = g;
    buf.data[i + 2] = b;
    buf.data[i + 3] = 255;
  } else {
    // Alpha blend
    const aa = a / 255;
    const ia = 1 - aa;
    buf.data[i] = buf.data[i] * ia + r * aa;
    buf.data[i + 1] = buf.data[i + 1] * ia + g * aa;
    buf.data[i + 2] = buf.data[i + 2] * ia + b * aa;
  }
}

/** Clear entire buffer to a color */
export function clearBuf(buf: ImageData, r: number, g: number, b: number): void {
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  }
}

/** Flush buffer to canvas */
export function present(ctx: CanvasRenderingContext2D, buf: ImageData): void {
  ctx.putImageData(buf, 0, 0);
}

/** Bresenham line drawing */
export function drawLine(
  buf: ImageData,
  x0: number, y0: number,
  x1: number, y1: number,
  r: number, g: number, b: number, a: number,
): void {
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);

  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;

  for (let i = 0; i < 30; i++) {
    setPixel(buf, ix0, iy0, r, g, b, a);
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; ix0 += sx; }
    if (e2 < dx) { err += dx; iy0 += sy; }
  }
}
