// main.ts — Entry point. Orchestrates world, rendering, sound, interaction.

import { createRenderContext, present, setPixel, RenderContext, W, H } from "./render";
import { drawText, drawTextRight } from "./font";
import { renderTerrain } from "./terrain";
import { createWorld, updateWorld, World } from "./world";
import { cycleName } from "./names";
import { PAL, BiomePalette } from "./palette";
import { Mote } from "./mote";
import { findClusters } from "./physics";
import { createSoundEngine, initAudio, updateSound, SoundEngine } from "./sound";
import { createInteraction, applyInteraction, Interaction } from "./interaction";
import { isEventActive, isEclipseActive, getMeteorPosition } from "./events";

let rc: RenderContext;
let world: World;
let sound: SoundEngine;
let input: Interaction;

// DOM elements for cycle info (populated outside the canvas)
let elCycleName: HTMLElement | null;
let elPhase: HTMLElement | null;

function init(): void {
  const canvas = document.getElementById("world") as HTMLCanvasElement;
  rc = createRenderContext(canvas);
  world = createWorld();
  sound = createSoundEngine();
  input = createInteraction(canvas);

  // DOM info elements
  elCycleName = document.getElementById("cycle-name");
  elPhase = document.getElementById("cycle-phase");

  // Audio init on first interaction
  const startAudio = () => {
    initAudio(sound);
    document.removeEventListener("click", startAudio);
    document.removeEventListener("touchstart", startAudio);
    document.removeEventListener("keydown", startAudio);
  };
  document.addEventListener("click", startAudio);
  document.addEventListener("touchstart", startAudio);
  document.addEventListener("keydown", startAudio);

  // Sound update loop (~15fps, decoupled)
  setInterval(() => {
    updateSound(sound, world.motes, world.phaseIndex, world.phaseProgress);
  }, 67);

  // Idle cursor hide
  let idleTimer = 0;
  document.addEventListener("mousemove", () => {
    document.body.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => document.body.classList.add("idle"), 3000);
  });

  let lastTime = performance.now();
  const debugMode = new URLSearchParams(window.location.search).has("debug");

  function frame(now: number): void {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Update world + interaction
    updateWorld(world, dt);
    applyInteraction(input, world.motes);

    // Render terrain + sky
    renderTerrain(rc.buf, world.terrain, world.time);

    // Pre-compute mote colors (reused for both mote pixels and bond lines)
    const bp = world.terrain.bp;
    const moteColors = new Map<Mote, [number, number, number]>();
    for (const m of world.motes) {
      moteColors.set(m, computeMoteColor(m, bp));
    }

    // Render motes — color reflects temperament + energy
    for (const m of world.motes) {
      const [cr, cg, cb] = moteColors.get(m)!;
      setPixel(rc.buf, m.x, m.y, cr, cg, cb);

      // Bonded motes glow slightly wider
      if (m.bonds.length > 0) {
        setPixel(rc.buf, m.x, m.y - 1, cr, cg, cb, 100);
      }
    }

    // Draw bond lines — blend the temperament colors of the two endpoints.
    // A wanderer-to-wanderer bond glows warm amber; social-to-social shimmers
    // cool blue; mixed pairs show a midpoint hue. Each bond reads as a
    // relationship between two distinct individuals.
    const drawn = new Set<string>();
    for (const m of world.motes) {
      for (const bonded of m.bonds) {
        const bdx = bonded.x - m.x;
        const bdy = bonded.y - m.y;
        if (bdx * bdx + bdy * bdy > 24 * 24) continue; // skip long bonds visually
        const key = m.x < bonded.x
          ? `${m.x},${m.y}-${bonded.x},${bonded.y}`
          : `${bonded.x},${bonded.y}-${m.x},${m.y}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        const [r1, g1, b1] = moteColors.get(m)!;
        const [r2, g2, b2] = moteColors.get(bonded)!;
        drawLine(rc.buf, m.x, m.y, bonded.x, bonded.y,
          Math.round((r1 + r2) / 2),
          Math.round((g1 + g2) / 2),
          Math.round((b1 + b2) / 2),
          40);
      }
    }

    // Meteor visual
    const meteorPos = getMeteorPosition(world.event, world.time, world.cycleNumber);
    if (meteorPos) {
      const mc = PAL[14]; // gold
      setPixel(rc.buf, meteorPos.x, meteorPos.y, mc[0], mc[1], mc[2]);
      setPixel(rc.buf, meteorPos.x + 1, meteorPos.y - 1, mc[0], mc[1], mc[2], 180);
      // Trail
      for (let i = 1; i < 4; i++) {
        setPixel(rc.buf, meteorPos.x + i, meteorPos.y - i, mc[0], mc[1], mc[2], 120 - i * 30);
      }
    }

    // Eclipse darkening
    if (isEclipseActive(world.event, world.time)) {
      const d = rc.buf.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = d[i] * 0.4;
        d[i + 1] = d[i + 1] * 0.35;
        d[i + 2] = d[i + 2] * 0.5; // shift blue
      }
    }

    // Vignette
    applyVignette(rc.buf);

    // Event message flash
    if (world.event && isEventActive(world.event, world.time) && world.event.messageAlpha > 0) {
      const msgX = Math.floor((W - world.event.message.length * 4) / 2);
      const msgY = Math.floor(H * 0.3);
      // Use white (5) with manual alpha isn't possible in bitmap font, so use brightest color when visible
      if (world.event.messageAlpha > 0.3) {
        drawText(rc.buf, msgX, msgY, world.event.message, 5);
      } else {
        drawText(rc.buf, msgX, msgY, world.event.message, 4);
      }
    }

    // Update DOM cycle info
    const name = cycleName(world.cycleNumber);
    if (elCycleName) elCycleName.textContent = name;
    if (elPhase) elPhase.textContent = world.phaseName;

    // Debug overlay
    if (debugMode) {
      const clusters = findClusters(world.motes);
      const info = `${world.phaseName.toUpperCase()} M:${world.motes.length} C:${clusters.length}`;
      drawText(rc.buf, 2, 2, info, 5);
      const fps = `${Math.round(1 / Math.max(dt, 0.001))} FPS`;
      drawTextRight(rc.buf, W - 2, 2, fps, 5);
    }

    present(rc.ctx, rc.buf);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

/**
 * Compute a mote's display color from its temperament and energy.
 *
 * Wanderlust → warm tint (ember: restless, fire-touched).
 * Sociability → cool tint (sky: open, connective).
 * Hardiness → resists dimming at low energy (glows longer).
 *
 * Energy controls base brightness between the biome's dim and glow colors.
 * Temperament nudges hue so every creature reads as an individual.
 */
function computeMoteColor(m: Mote, bp: BiomePalette): [number, number, number] {
  const bright = PAL[bp.moteGlow];
  const dark = PAL[bp.moteDim];

  // Hardy motes resist fading — boost their apparent brightness when low on energy
  const hardyBoost = m.temperament.hardiness * 0.3 * (1 - m.energy);
  const t = Math.min(1, m.energy + hardyBoost);

  // Linear interpolate between dim and glow by effective brightness
  let r = dark[0] + (bright[0] - dark[0]) * t;
  let g = dark[1] + (bright[1] - dark[1]) * t;
  let b = dark[2] + (bright[2] - dark[2]) * t;

  // Wanderlust: shift toward warm ember (200, 80, 20)
  const wt = m.temperament.wanderlust * 0.35;
  r += (200 - r) * wt;
  g += (80 - g) * wt;
  b += (20 - b) * wt;

  // Sociability: shift toward cool sky (60, 160, 200)
  const st = m.temperament.sociability * 0.30;
  r += (60 - r) * st;
  g += (160 - g) * st;
  b += (200 - b) * st;

  return [Math.round(r), Math.round(g), Math.round(b)];
}

function applyVignette(buf: ImageData): void {
  const cx = W / 2;
  const cy = H / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const d = buf.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const fade = dist < 0.55 ? 1 : 1 - (dist - 0.55) * 1.6;
      const f = Math.max(0.35, fade);
      const i = (y * W + x) * 4;
      d[i] = d[i] * f;
      d[i + 1] = d[i + 1] * f;
      d[i + 2] = d[i + 2] * f;
    }
  }
}

function drawLine(
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

init();
