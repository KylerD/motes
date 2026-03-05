// weather-render.ts — Weather rendering: celestial bodies, clouds, particles, lightning, fog, darkening.

import { W, H } from "./config";
import type { Weather } from "./types";
import { setPixel } from "./render";
import { noise2 } from "./noise";

/** Render celestial body (sun or moon) — call before terrain for background effect */
export function renderCelestial(buf: ImageData, weather: Weather, time: number): void {
  const { celestial } = weather;
  if (celestial.type === "none") return;

  const cx = Math.round(celestial.x);
  const cy = Math.round(celestial.y);

  if (celestial.type === "sun") {
    // Sun: warm golden disc with corona
    const pulse = Math.sin(time * 0.5) * 0.08 + 0.92;

    // Corona glow (large, faint)
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > 64) continue;
        const falloff = 1 - Math.sqrt(d2) / 8;
        const a = Math.round(falloff * falloff * 40 * pulse);
        if (a > 1) setPixel(buf, cx + dx, cy + dy, 255, 220, 120, a);
      }
    }

    // Sun disc (3px radius)
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > 9) continue;
        const falloff = 1 - Math.sqrt(d2) / 3;
        const bright = Math.round(200 + falloff * 55);
        const a = Math.round((180 + falloff * 75) * pulse);
        setPixel(buf, cx + dx, cy + dy, bright, Math.round(bright * 0.85), Math.round(bright * 0.5), a);
      }
    }

    // Rays — 4 thin lines extending outward
    const rayLen = 5 + Math.round(Math.sin(time * 0.8) * 2);
    const rays = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [rdx, rdy] of rays) {
      for (let i = 4; i < 4 + rayLen; i++) {
        const ra = Math.round((1 - (i - 4) / rayLen) * 60 * pulse);
        if (ra > 0) setPixel(buf, cx + rdx * i, cy + rdy * i, 255, 230, 150, ra);
      }
    }
  } else if (celestial.type === "moon") {
    // Moon: blue-white disc with shadow crescent
    const phase = celestial.phase;

    // Moon glow
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > 36) continue;
        const falloff = 1 - Math.sqrt(d2) / 6;
        const a = Math.round(falloff * falloff * 25);
        if (a > 1) setPixel(buf, cx + dx, cy + dy, 180, 200, 230, a);
      }
    }

    // Moon disc (2px radius)
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > 4) continue;
        // Crescent shadow: darken one side based on phase
        const shadowOffset = (phase - 0.5) * 4;
        const inShadow = dx < shadowOffset;
        if (inShadow) {
          setPixel(buf, cx + dx, cy + dy, 40, 50, 70, 160);
        } else {
          setPixel(buf, cx + dx, cy + dy, 210, 220, 240, 220);
        }
      }
    }

    // Scattered stars near moon
    const starSeed = Math.floor(celestial.x * 100 + celestial.y * 10);
    for (let i = 0; i < 12; i++) {
      const sx = Math.abs((starSeed + i * 7717) % W);
      const sy = Math.abs((starSeed + i * 3491) % Math.floor(H * 0.4));
      // Don't overlap the moon
      const moonDist = Math.abs(sx - cx) + Math.abs(sy - cy);
      if (moonDist < 10) continue;
      const twinkle = Math.sin(time * (1.5 + i * 0.4) + i * 2.1) * 0.3 + 0.7;
      const sa = Math.round(100 * twinkle);
      setPixel(buf, sx, sy, 200, 210, 235, sa);
    }
  }
}

/** Render clouds — call after terrain for overlay effect */
export function renderClouds(buf: ImageData, weather: Weather, time: number): void {
  for (const cloud of weather.clouds) {
    const cx = cloud.x;
    const cy = cloud.y;
    const hw = cloud.width / 2;
    const hh = cloud.height / 2;

    for (let dy = -Math.ceil(hh); dy <= Math.ceil(hh); dy++) {
      for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px < 0 || px >= W || py < 0 || py >= H) continue;

        // Elliptical falloff
        const nx = dx / hw;
        const ny = dy / hh;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;

        // Noise-shaped edges
        const noiseVal = noise2(px * 0.15 + time * 0.3, py * 0.15 + cloud.speed * 0.01) * 0.5 + 0.5;
        const edgeFade = 1 - d2;
        const shape = edgeFade * noiseVal;
        if (shape < 0.2) continue;

        const a = Math.round(shape * cloud.density * 255);
        if (a < 3) continue;

        // Cloud color: light grey-white
        const bright = weather.type === "storm" ? 100 : weather.type === "overcast" ? 140 : 200;
        setPixel(buf, px, py, bright, bright + 5, bright + 10, a);
      }
    }
  }
}

/** Render rain/snow particles */
export function renderParticles(buf: ImageData, weather: Weather): void {
  const isSnow = weather.type === "snow";

  for (const p of weather.particles) {
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const a = Math.round(p.alpha);

    if (isSnow) {
      // Snow: white soft pixels
      setPixel(buf, px, py, 230, 235, 245, a);
      if (p.size > 0) {
        const halfA = Math.round(a * 0.5);
        setPixel(buf, px + 1, py, 220, 225, 240, halfA);
        setPixel(buf, px, py + 1, 220, 225, 240, halfA);
      }
    } else {
      // Rain: blue-white streaks (2-3px tall for motion blur)
      setPixel(buf, px, py, 160, 180, 220, a);
      setPixel(buf, px, py - 1, 140, 165, 210, Math.round(a * 0.6));
      if (p.size > 0) {
        setPixel(buf, px, py - 2, 120, 150, 200, Math.round(a * 0.3));
      }
    }
  }
}

/** Render lightning flash — bright overlay across the whole scene */
export function renderLightning(buf: ImageData, weather: Weather): void {
  if (!weather.lightning.active) return;

  const brightness = weather.lightning.brightness;
  const d = buf.data;

  // Full-screen flash
  const flashA = Math.round(brightness * 80);
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = Math.min(255, d[i] + flashA);
    d[i + 1] = Math.min(255, d[i + 1] + flashA);
    d[i + 2] = Math.min(255, d[i + 2] + Math.round(flashA * 1.2));
  }

  // Bolt: jagged vertical line from cloud to ground
  const bx = weather.lightning.x;
  let y = 5;
  let x = bx;
  const boltAlpha = Math.round(brightness * 255);
  while (y < H * 0.7) {
    setPixel(buf, x, y, 255, 255, 255, boltAlpha);
    setPixel(buf, x - 1, y, 200, 210, 255, Math.round(boltAlpha * 0.4));
    setPixel(buf, x + 1, y, 200, 210, 255, Math.round(boltAlpha * 0.4));
    y += 1;
    // Jagged steps
    x += (Math.floor(y * 3.7 + bx) % 3) - 1;
  }
}

/** Apply fog overlay — semi-transparent white layer */
export function renderFog(buf: ImageData, weather: Weather, time: number): void {
  if (weather.fogDensity <= 0) return;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Fog thicker at bottom, thinner at top
      const yFactor = y / H;
      const noiseVal = noise2(x * 0.04 + time * 0.2, y * 0.06 + time * 0.05) * 0.5 + 0.5;
      const fogHere = weather.fogDensity * yFactor * noiseVal;
      const a = Math.round(fogHere * 120);
      if (a > 2) {
        setPixel(buf, x, y, 180, 185, 195, a);
      }
    }
  }
}

/** Apply ambient darkening for overcast/storm weather */
export function applyWeatherDarkening(buf: ImageData, weather: Weather): void {
  if (weather.ambientDarkening <= 0) return;

  const factor = 1 - weather.ambientDarkening;
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = Math.round(d[i] * factor);
    d[i + 1] = Math.round(d[i + 1] * factor);
    d[i + 2] = Math.round(d[i + 2] * factor);
  }
}
