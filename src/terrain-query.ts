// terrain-query.ts — Terrain data queries: surface, tiles, walkability, settlement placement.

import { W, H } from "./config";
import { Tile } from "./types";
import type { Terrain } from "./types";

/** Get the surface Y (screen coords, top=0) for a column */
export function getSurfaceY(t: Terrain, x: number): number {
  const cx = Math.max(0, Math.min(W - 1, Math.round(x)));
  return Math.floor(H - t.heights[cx]);
}

/** Get the tile at a screen position */
export function getTile(t: Terrain, x: number, y: number): Tile {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return Tile.Air;
  return t.tiles[iy * W + ix] as Tile;
}

/** Is a tile solid (motes can't pass through)? */
export function isSolid(tile: Tile): boolean {
  return tile !== Tile.Air && tile !== Tile.Cave && tile !== Tile.CaveInterior;
}

/** Is a tile walkable surface (motes can stand on it)? */
export function isWalkable(tile: Tile): boolean {
  return (
    tile === Tile.Ground ||
    tile === Tile.Sand ||
    tile === Tile.DarkGround ||
    tile === Tile.Ruin ||
    tile === Tile.Settlement
  );
}

/** Energy yield per tile type. Positive = nutrient, negative = hazard. */
export function getTileEnergy(tile: Tile): number {
  if (tile === Tile.DeepWater) return -0.8;
  if (tile === Tile.ShallowWater) return -0.3;
  if (tile === Tile.Cliff) return -0.2;
  if (tile === Tile.Sand) return 0.02;
  if (tile === Tile.TreeTrunk) return 0.05;
  if (tile === Tile.DarkGround) return 0.1;
  if (tile === Tile.Ruin) return 0.1;
  if (tile === Tile.Ground) return 0.15;
  if (tile === Tile.Settlement) return 0.2;
  if (tile === Tile.Cave) return 0.25;
  if (tile === Tile.TreeCanopy) return 0.3;
  return 0; // Air
}

/** Set a tile at screen coordinates (bounds-checked). */
export function modifyTile(terrain: Terrain, x: number, y: number, newTile: Tile): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
  terrain.tiles[iy * W + ix] = newTile;
}

/** Mark a settlement at a mote's position */
export function placeSettlement(terrain: Terrain, x: number, y: number): void {
  const ix = Math.round(x);
  const iy = Math.round(y) + 1; // mark the ground they're standing on
  if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
    const tile = terrain.tiles[iy * W + ix];
    if (isWalkable(tile as Tile)) {
      terrain.tiles[iy * W + ix] = Tile.Settlement;
    }
  }
}
