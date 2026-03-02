// events.ts — Rare events that break the pattern.
// ~1 in 50 cycles triggers an event (deterministic from seed).
// Events modify world state temporarily and show a text flash.

import { World } from "./world";
import { Mote } from "./mote";
import { Terrain, getSurfaceY } from "./terrain";
import { Tile } from "./terrain";
import { W, H } from "./render";

export type EventType = "flood" | "bloom" | "meteor" | "migration" | "eclipse";

export interface ActiveEvent {
  type: EventType;
  message: string;
  startTime: number;   // world.time when event started
  duration: number;     // seconds
  messageAlpha: number; // fades from 1 to 0 over 3 seconds
}

/** Check if this cycle has a rare event, and what kind */
export function checkForEvent(cycleNumber: number): ActiveEvent | null {
  // Deterministic: hash the cycle number
  const h = Math.abs(cycleNumber * 2654435761 | 0);
  if (h % 50 !== 0) return null;

  const eventIndex = (h >>> 8) % 5;
  const types: EventType[] = ["flood", "bloom", "meteor", "migration", "eclipse"];
  const messages: string[] = [
    "A FLOOD RISES",
    "A BLOOM ERUPTS",
    "SOMETHING FALLS",
    "THE GREAT MIGRATION",
    "AN ECLIPSE DESCENDS",
  ];
  const durations = [25, 15, 8, 20, 25];

  return {
    type: types[eventIndex],
    message: messages[eventIndex],
    startTime: -1, // set when triggered
    duration: durations[eventIndex],
    messageAlpha: 1,
  };
}

/** When in the cycle should the event trigger? (as fraction 0-1) */
export function getEventTriggerPoint(): number {
  return 0.45; // during organization phase, when things are interesting
}

/** Apply ongoing event effects each frame */
export function applyEvent(
  event: ActiveEvent,
  world: World,
  dt: number,
): void {
  if (event.startTime < 0) return; // not yet triggered

  const elapsed = world.time - event.startTime;
  if (elapsed > event.duration) return; // expired

  const progress = elapsed / event.duration;

  // Fade message
  if (elapsed < 3) {
    event.messageAlpha = 1;
  } else {
    event.messageAlpha = Math.max(0, 1 - (elapsed - 3) / 2);
  }

  switch (event.type) {
    case "flood":
      applyFlood(world.terrain, progress, dt);
      break;
    case "bloom":
      applyBloom(world, dt);
      break;
    case "meteor":
      applyMeteor(world, progress);
      break;
    case "migration":
      applyMigration(world.motes, progress);
      break;
    case "eclipse":
      // Eclipse effect is purely visual — handled in main.ts render
      break;
  }
}

/** Is the event currently active? */
export function isEventActive(event: ActiveEvent, worldTime: number): boolean {
  return event.startTime >= 0 && (worldTime - event.startTime) < event.duration;
}

/** Is this an eclipse currently active? (for render darkening) */
export function isEclipseActive(event: ActiveEvent | null, worldTime: number): boolean {
  return event !== null && event.type === "eclipse" && isEventActive(event, worldTime);
}

// --- Event implementations ---

function applyFlood(terrain: Terrain, progress: number, _dt: number): void {
  // Gradually raise water level
  const originalWater = terrain.waterLevel;
  const maxRise = Math.floor(H * 0.15);
  const rise = Math.floor(Math.sin(progress * Math.PI) * maxRise); // rises then recedes
  const newLevel = originalWater + rise;

  // Convert newly-submerged ground tiles to shallow water
  for (let x = 0; x < W; x++) {
    const surfY = getSurfaceY(terrain, x);
    for (let y = surfY; y < H; y++) {
      const worldH = H - y;
      const idx = y * W + x;
      if (worldH <= newLevel && worldH > originalWater) {
        const tile = terrain.tiles[idx] as Tile;
        if (tile === Tile.Ground || tile === Tile.Sand || tile === Tile.Settlement) {
          terrain.tiles[idx] = Tile.ShallowWater;
        }
      }
    }
  }
}

function applyBloom(world: World, dt: number): void {
  // Massively increased spawn rate
  const blooomSpawnRate = 30; // 30 motes/sec
  world.spawnAccum += blooomSpawnRate * dt;
  // Also energize existing motes
  for (const m of world.motes) {
    m.energy = Math.min(1, m.energy + 0.02 * dt);
  }
}

function applyMeteor(world: World, progress: number): void {
  if (progress > 0.3) return; // impact happens in first 30%

  // Meteor position: falls from top-center-ish to an impact point
  const impactX = W * 0.3 + (world.cycleNumber % 100) / 100 * W * 0.4;
  const t = progress / 0.3; // 0-1 during fall phase

  if (t > 0.95) {
    // Impact: crater in terrain + scatter motes
    const ix = Math.round(impactX);
    const surfY = getSurfaceY(world.terrain, ix);

    // Carve crater (lower terrain around impact)
    for (let dx = -4; dx <= 4; dx++) {
      const cx = ix + dx;
      if (cx < 0 || cx >= W) continue;
      const depth = Math.max(0, 4 - Math.abs(dx));
      for (let dy = 0; dy < depth; dy++) {
        const cy = surfY - dy;
        if (cy >= 0 && cy < H) {
          world.terrain.tiles[cy * W + cx] = Tile.Air;
        }
      }
      // Update height map
      world.terrain.heights[cx] = Math.max(
        world.terrain.heights[cx] - depth * 0.8,
        H * 0.1,
      );
    }

    // Scatter nearby motes
    for (const m of world.motes) {
      const dx = m.x - impactX;
      const dist = Math.abs(dx);
      if (dist < 40) {
        const force = (1 - dist / 40) * 50;
        m.forceX = (dx > 0 ? 1 : -1) * force;
        m.forceY = -force * 0.8;
        m.energy = Math.min(1, m.energy + 0.1);
      }
    }
  }
}

function applyMigration(motes: Mote[], progress: number): void {
  // Strong directional force pushing all motes to one side
  const direction = progress < 0.5 ? 1 : -1; // go right, then left
  const strength = Math.sin(progress * Math.PI) * 20;

  for (const m of motes) {
    m.forceX += direction * strength;
  }
}

/** Get meteor visual position for rendering (returns null if not in flight) */
export function getMeteorPosition(
  event: ActiveEvent | null,
  worldTime: number,
  cycleNumber: number,
): { x: number; y: number } | null {
  if (!event || event.type !== "meteor" || event.startTime < 0) return null;

  const elapsed = worldTime - event.startTime;
  const progress = elapsed / event.duration;
  if (progress > 0.3 || progress < 0) return null;

  const t = progress / 0.3;
  const impactX = W * 0.3 + (cycleNumber % 100) / 100 * W * 0.4;
  const impactY = H * 0.5; // roughly mid-terrain

  return {
    x: impactX + (1 - t) * 40,  // comes from upper right
    y: t * impactY,               // falls from top
  };
}
