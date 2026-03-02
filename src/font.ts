// font.ts — 3×5 bitmap font. Uppercase, digits, minimal punctuation.
// Each character is encoded as 5 rows of 3 bits (15 bits total, fits in a number).

import { setPixel } from "./render";
import { PAL, RGB } from "./palette";

// Encode a 3×5 glyph: rows top-to-bottom, each row is 3 bits (MSB = left pixel)
// bit layout: row0[2:0] row1[2:0] row2[2:0] row3[2:0] row4[2:0]
function g(r0: number, r1: number, r2: number, r3: number, r4: number): number {
  return (r0 << 12) | (r1 << 9) | (r2 << 6) | (r3 << 3) | r4;
}

const GLYPHS: Record<string, number> = {
  A: g(0b010, 0b101, 0b111, 0b101, 0b101),
  B: g(0b110, 0b101, 0b110, 0b101, 0b110),
  C: g(0b011, 0b100, 0b100, 0b100, 0b011),
  D: g(0b110, 0b101, 0b101, 0b101, 0b110),
  E: g(0b111, 0b100, 0b110, 0b100, 0b111),
  F: g(0b111, 0b100, 0b110, 0b100, 0b100),
  G: g(0b011, 0b100, 0b101, 0b101, 0b011),
  H: g(0b101, 0b101, 0b111, 0b101, 0b101),
  I: g(0b111, 0b010, 0b010, 0b010, 0b111),
  J: g(0b001, 0b001, 0b001, 0b101, 0b010),
  K: g(0b101, 0b101, 0b110, 0b101, 0b101),
  L: g(0b100, 0b100, 0b100, 0b100, 0b111),
  M: g(0b101, 0b111, 0b111, 0b101, 0b101),
  N: g(0b101, 0b111, 0b111, 0b101, 0b101),
  O: g(0b010, 0b101, 0b101, 0b101, 0b010),
  P: g(0b110, 0b101, 0b110, 0b100, 0b100),
  Q: g(0b010, 0b101, 0b101, 0b110, 0b011),
  R: g(0b110, 0b101, 0b110, 0b101, 0b101),
  S: g(0b011, 0b100, 0b010, 0b001, 0b110),
  T: g(0b111, 0b010, 0b010, 0b010, 0b010),
  U: g(0b101, 0b101, 0b101, 0b101, 0b010),
  V: g(0b101, 0b101, 0b101, 0b101, 0b010),
  W: g(0b101, 0b101, 0b111, 0b111, 0b101),
  X: g(0b101, 0b101, 0b010, 0b101, 0b101),
  Y: g(0b101, 0b101, 0b010, 0b010, 0b010),
  Z: g(0b111, 0b001, 0b010, 0b100, 0b111),
  "0": g(0b010, 0b101, 0b101, 0b101, 0b010),
  "1": g(0b010, 0b110, 0b010, 0b010, 0b111),
  "2": g(0b110, 0b001, 0b010, 0b100, 0b111),
  "3": g(0b110, 0b001, 0b010, 0b001, 0b110),
  "4": g(0b101, 0b101, 0b111, 0b001, 0b001),
  "5": g(0b111, 0b100, 0b110, 0b001, 0b110),
  "6": g(0b011, 0b100, 0b110, 0b101, 0b010),
  "7": g(0b111, 0b001, 0b010, 0b010, 0b010),
  "8": g(0b010, 0b101, 0b010, 0b101, 0b010),
  "9": g(0b010, 0b101, 0b011, 0b001, 0b110),
  "#": g(0b101, 0b111, 0b101, 0b111, 0b101),
  " ": g(0b000, 0b000, 0b000, 0b000, 0b000),
  ".": g(0b000, 0b000, 0b000, 0b000, 0b010),
  ",": g(0b000, 0b000, 0b000, 0b010, 0b100),
  "!": g(0b010, 0b010, 0b010, 0b000, 0b010),
  "?": g(0b110, 0b001, 0b010, 0b000, 0b010),
  "-": g(0b000, 0b000, 0b111, 0b000, 0b000),
  ":": g(0b000, 0b010, 0b000, 0b010, 0b000),
};

/** Draw a single character at (x, y) into the buffer */
export function drawChar(
  buf: ImageData,
  x: number,
  y: number,
  ch: string,
  color: RGB,
): void {
  const glyph = GLYPHS[ch.toUpperCase()];
  if (glyph === undefined) return; // unknown char = skip

  for (let row = 0; row < 5; row++) {
    const bits = (glyph >> ((4 - row) * 3)) & 0b111;
    for (let col = 0; col < 3; col++) {
      if (bits & (1 << (2 - col))) {
        setPixel(buf, x + col, y + row, color[0], color[1], color[2]);
      }
    }
  }
}

/** Draw a string. Returns the x position after the last character. */
export function drawText(
  buf: ImageData,
  x: number,
  y: number,
  text: string,
  colorIndex: number,
): number {
  const color = PAL[colorIndex];
  let cx = x;
  for (const ch of text) {
    drawChar(buf, cx, y, ch, color);
    cx += 4; // 3px char + 1px gap
  }
  return cx;
}

/** Draw text right-aligned from a right edge x position */
export function drawTextRight(
  buf: ImageData,
  rightX: number,
  y: number,
  text: string,
  colorIndex: number,
): void {
  const width = text.length * 4 - 1; // 4px per char minus trailing gap
  drawText(buf, rightX - width, y, text, colorIndex);
}

/** Measure text width in pixels */
export function measureText(text: string): number {
  return text.length * 4 - 1;
}
