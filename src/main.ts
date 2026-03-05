// main.ts — Entry point. Orchestrates world, rendering, sound, interaction.

import { createRenderContext, present, setPixel, RenderContext, W, H } from "./render";
import { drawText, drawTextRight } from "./font";
import { renderTerrain } from "./terrain";
import { createWorld, updateWorld, World } from "./world";
import { cycleName } from "./names";
import { PAL, BiomePalette } from "./palette";
import { Mote } from "./mote";
import { findClusters } from "./physics";
import { createSoundEngine, initAudio, updateSound, SoundEngine, playDeath, playEventSound } from "./sound";
import { createInteraction, applyInteraction, Interaction } from "./interaction";
import { isEventActive, isEclipseActive, getMeteorPosition } from "./events";

let rc: RenderContext;
let world: World;
let sound: SoundEngine;
let input: Interaction;

// Meteor impact flash state
let meteorWasVisible = false;
let impactFlash = 0;
let impactX = 0;
let impactY = 0;

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

    // Event sound triggering
    if (world.pendingEventSound && sound.initialized) {
      playEventSound(sound, world.pendingEventSound);
      world.pendingEventSound = null;
    }

    // Death sounds
    for (const d of world.deaths) {
      if (world.time - d.time < 0.02) { // just died this frame
        if (sound.initialized) {
          playDeath(sound, 1 - d.y / H);
        }
        break; // max 1 death sound per frame
      }
    }

    // Render terrain + sky
    renderTerrain(rc.buf, world.terrain, world.time, world.cycleProgress);

    // Pre-compute mote colors (reused for both mote pixels and bond lines)
    const bp = world.terrain.bp;
    const moteColors = new Map<Mote, [number, number, number]>();
    for (const m of world.motes) {
      moteColors.set(m, computeMoteColor(m, bp));
    }

    // Check if plague is active (for mote tinting)
    const plagueActive = world.event && world.event.type === 'plague' && isEventActive(world.event, world.time);
    const plaguePulse = plagueActive ? Math.sin(world.time * 6) : 0;

    // Render motes — multi-pixel so you can actually see them
    for (const m of world.motes) {
      let [cr, cg, cb] = moteColors.get(m)!;

      // Plague visual: bonded motes flash with sickly green tint
      if (plagueActive && m.bonds.length > 0 && plaguePulse > 0.3) {
        const tint = (plaguePulse - 0.3) * 0.4;
        cr = Math.round(cr * (1 - tint));
        cg = Math.round(Math.min(255, cg + 40 * tint));
        cb = Math.round(cb * (1 - tint * 0.5));
      }

      const isElder = m.age > 20;
      const isMature = m.age > 8;

      // Center pixel — always full brightness (elders get brightness boost)
      if (isElder) {
        setPixel(rc.buf, m.x, m.y, Math.min(255, cr + 20), Math.min(255, cg + 20), Math.min(255, cb + 20));
      } else {
        setPixel(rc.buf, m.x, m.y, cr, cg, cb);
      }

      // Cross pixels — scale alpha with energy so dying motes shrink to 1px
      if (m.energy > 0.15) {
        // Elders: full alpha cross; Mature: slightly higher alpha; Normal: energy-based
        const ea = isElder ? 255 : isMature ? Math.round(100 + m.energy * 140) : Math.round(60 + m.energy * 160);
        setPixel(rc.buf, m.x - 1, m.y, cr, cg, cb, ea);
        setPixel(rc.buf, m.x + 1, m.y, cr, cg, cb, ea);
        setPixel(rc.buf, m.x, m.y - 1, cr, cg, cb, ea);
        setPixel(rc.buf, m.x, m.y + 1, cr, cg, cb, ea);
      }

      // Elders: full 3×3 filled block regardless of bonds
      if (isElder) {
        setPixel(rc.buf, m.x - 1, m.y - 1, cr, cg, cb, 200);
        setPixel(rc.buf, m.x + 1, m.y - 1, cr, cg, cb, 200);
        setPixel(rc.buf, m.x - 1, m.y + 1, cr, cg, cb, 200);
        setPixel(rc.buf, m.x + 1, m.y + 1, cr, cg, cb, 200);
      } else if (m.bonds.length > 0) {
        // Bonded motes get corner pixels — reads as a 3x3 blob
        const ba = Math.round(30 + m.bonds.length * 30); // 60–120
        setPixel(rc.buf, m.x - 1, m.y - 1, cr, cg, cb, ba);
        setPixel(rc.buf, m.x + 1, m.y - 1, cr, cg, cb, ba);
        setPixel(rc.buf, m.x - 1, m.y + 1, cr, cg, cb, ba);
        setPixel(rc.buf, m.x + 1, m.y + 1, cr, cg, cb, ba);
      }

      // Bond formation flash — bright burst that fades
      if (m.bondFlash > 0) {
        const fa = Math.round(m.bondFlash * 200);
        setPixel(rc.buf, m.x - 2, m.y, 255, 255, 255, fa);
        setPixel(rc.buf, m.x + 2, m.y, 255, 255, 255, fa);
        setPixel(rc.buf, m.x, m.y - 2, 255, 255, 255, fa);
        setPixel(rc.buf, m.x, m.y + 2, 255, 255, 255, fa);
      }
    }

    // Draw bond lines — visible this time
    const drawn = new Set<string>();
    for (const m of world.motes) {
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
        // Flash bright on formation, settle to steady visible alpha
        const flash = Math.max(m.bondFlash, bonded.bondFlash);
        const bondAlpha = Math.round(100 + flash * 155); // 100–255
        drawLine(rc.buf, m.x, m.y, bonded.x, bonded.y,
          Math.round((r1 + r2) / 2),
          Math.round((g1 + g2) / 2),
          Math.round((b1 + b2) / 2),
          bondAlpha);
      }
    }

    // Death particles — fading ghosts
    for (const d of world.deaths) {
      const age = world.time - d.time;
      const alpha = Math.round((1 - age / 0.8) * 150);
      if (alpha <= 0) continue;
      // Expanding outward pattern
      const spread = age * 15;
      setPixel(rc.buf, d.x, d.y, d.r, d.g, d.b, alpha);
      setPixel(rc.buf, d.x - spread, d.y - spread, d.r, d.g, d.b, Math.round(alpha * 0.5));
      setPixel(rc.buf, d.x + spread, d.y - spread, d.r, d.g, d.b, Math.round(alpha * 0.5));
      setPixel(rc.buf, d.x - spread, d.y + spread, d.r, d.g, d.b, Math.round(alpha * 0.3));
      setPixel(rc.buf, d.x + spread, d.y + spread, d.r, d.g, d.b, Math.round(alpha * 0.3));
    }

    // Meteor visual — bright head + long trail
    const meteorPos = getMeteorPosition(world.event, world.time, world.cycleNumber);
    if (meteorPos) {
      const mx = Math.round(meteorPos.x);
      const my = Math.round(meteorPos.y);
      // Bright 3x3 head
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const dist = Math.abs(dx) + Math.abs(dy);
          const a = dist === 0 ? 255 : 200;
          setPixel(rc.buf, mx + dx, my + dy, 255, 220, 140, a);
        }
      }
      // Long trail
      for (let i = 1; i <= 10; i++) {
        const ta = Math.round(200 * (1 - i / 10));
        const tr = Math.round(255 - i * 10);
        const tg = Math.round(180 - i * 12);
        setPixel(rc.buf, mx + i, my - i, tr, tg, 80, ta);
        if (i < 7) {
          setPixel(rc.buf, mx + i, my - i + 1, tr, tg, 80, Math.round(ta * 0.5));
          setPixel(rc.buf, mx + i + 1, my - i, tr, tg, 80, Math.round(ta * 0.5));
        }
      }
      meteorWasVisible = true;
      impactX = mx;
      impactY = my;
    } else if (meteorWasVisible) {
      meteorWasVisible = false;
      impactFlash = 1.0;
    }

    // Impact flash — expanding bright circle
    if (impactFlash > 0) {
      const flashRadius = Math.round((1 - impactFlash) * 18 + 4);
      for (let dy = -flashRadius; dy <= flashRadius; dy++) {
        for (let dx = -flashRadius; dx <= flashRadius; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= flashRadius * flashRadius) {
            const falloff = 1 - Math.sqrt(d2) / flashRadius;
            const fa = Math.round(impactFlash * 220 * falloff);
            setPixel(rc.buf, impactX + dx, impactY + dy, 255, 240, 180, fa);
          }
        }
      }
      impactFlash = Math.max(0, impactFlash - dt * 2.5);
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

    // Aurora visual — boost blue-green channels
    if (world.event && world.event.type === 'aurora' && isEventActive(world.event, world.time)) {
      const d = rc.buf.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i] * 1.12);
        d[i + 1] = Math.min(255, d[i + 1] * 1.15);
        d[i + 2] = Math.min(255, d[i + 2] * 1.2);
      }
    }

    // Click ripples — expanding rings
    for (let i = input.ripples.length - 1; i >= 0; i--) {
      const rp = input.ripples[i];
      const r = Math.round(rp.radius);
      const ra = Math.round(rp.alpha * 180);
      const r2inner = (r - 1) * (r - 1);
      const r2outer = (r + 1) * (r + 1);
      for (let dy = -r - 1; dy <= r + 1; dy++) {
        for (let dx = -r - 1; dx <= r + 1; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 >= r2inner && d2 <= r2outer) {
            setPixel(rc.buf, Math.round(rp.x) + dx, Math.round(rp.y) + dy, 220, 224, 228, ra);
          }
        }
      }
      rp.radius += dt * 30;
      rp.alpha -= dt * 2.2;
      if (rp.alpha <= 0) input.ripples.splice(i, 1);
    }

    // Cursor indicator — faint ring so you know where you're pointing
    if (input.present) {
      const cr = 5;
      const cx = Math.round(input.x);
      const cy = Math.round(input.y);
      const cr2inner = (cr - 1) * (cr - 1);
      const cr2outer = cr * cr;
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dx = -cr; dx <= cr; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 >= cr2inner && d2 <= cr2outer) {
            setPixel(rc.buf, cx + dx, cy + dy, 220, 224, 228, 40);
          }
        }
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
  const mid = PAL[bp.moteMid];

  // Hardy motes resist fading — boost their apparent brightness when low on energy
  const hardyBoost = m.temperament.hardiness * 0.3 * (1 - m.energy);
  const t = Math.min(1, m.energy + hardyBoost);

  // Three-point blend: dim → mid → glow
  let r, g, b;
  if (t < 0.5) {
    const st = t * 2; // 0-1 within dim→mid range
    r = dark[0] + (mid[0] - dark[0]) * st;
    g = dark[1] + (mid[1] - dark[1]) * st;
    b = dark[2] + (mid[2] - dark[2]) * st;
  } else {
    const st = (t - 0.5) * 2; // 0-1 within mid→glow range
    r = mid[0] + (bright[0] - mid[0]) * st;
    g = mid[1] + (bright[1] - mid[1]) * st;
    b = mid[2] + (bright[2] - mid[2]) * st;
  }

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

  // Age: elders shift toward warm gold (220, 165, 40) as they accumulate time.
  // Starts at maturity (age 8s), peaks at 40% gold by age 30s.
  // By dissolution the survivors are visibly golden — the cycle arc reads in color.
  const ageGold = Math.min(1, Math.max(0, (m.age - 8) / 22)) * 0.40;
  r += (220 - r) * ageGold;
  g += (165 - g) * ageGold;
  b += (40 - b) * ageGold;

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
      const fade = dist < 0.65 ? 1 : 1 - (dist - 0.65) * 1.2;
      const f = Math.max(0.55, fade);
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
