// palette.ts — Fixed 16-color palette. Everything is drawn from these.
// Inspired by ANSI/CGA but tuned for natural landscapes.

export type RGB = [number, number, number];

/**
 * The 16 colors. Indexed 0–15.
 *
 *  0: void       — deepest black-blue
 *  1: night      — dark navy
 *  2: shadow     — dark grey-blue
 *  3: stone      — medium grey
 *  4: mist       — light grey
 *  5: white      — brightest (text, highlights)
 *  6: deep water — dark blue
 *  7: water      — medium blue
 *  8: sky        — light blue-cyan
 *  9: earth      — brown
 * 10: sand       — warm tan
 * 11: darkgreen  — deep foliage
 * 12: green      — grass, leaves
 * 13: ember      — warm red-orange
 * 14: gold       — yellow, energy, sunlight
 * 15: dusk       — muted purple-pink
 */
export const PAL: RGB[] = [
  [8, 8, 16],       //  0 void
  [16, 20, 36],     //  1 night
  [40, 44, 56],     //  2 shadow
  [90, 92, 100],    //  3 stone
  [160, 164, 170],  //  4 mist
  [220, 224, 228],  //  5 white
  [16, 28, 56],     //  6 deep water
  [32, 60, 110],    //  7 water
  [80, 140, 180],   //  8 sky
  [72, 44, 24],     //  9 earth
  [160, 120, 72],   // 10 sand
  [20, 56, 32],     // 11 dark green
  [48, 104, 48],    // 12 green
  [170, 70, 40],    // 13 ember
  [210, 180, 60],   // 14 gold
  [100, 60, 100],   // 15 dusk
];

/** Biome types — select different palette indices for terrain roles */
export type Biome = "temperate" | "desert" | "tundra" | "volcanic" | "lush";

export interface BiomePalette {
  sky: number;           // sky gradient top color index
  skyHorizon: number;    // sky gradient bottom color index
  deepWater: number;
  shallowWater: number;
  sand: number;
  ground: number;
  darkGround: number;
  cliff: number;
  treeTrunk: number;
  treeCanopy: number;
  moteGlow: number;      // brightest mote color
  moteMid: number;
  moteDim: number;
  text: number;          // cycle name / watcher count
}

const BIOME_PALETTES: Record<Biome, BiomePalette> = {
  temperate: {
    sky: 8, skyHorizon: 4, deepWater: 6, shallowWater: 7,
    sand: 10, ground: 12, darkGround: 11, cliff: 3,
    treeTrunk: 9, treeCanopy: 12,
    moteGlow: 14, moteMid: 13, moteDim: 15, text: 2,
  },
  desert: {
    sky: 14, skyHorizon: 10, deepWater: 7, shallowWater: 8,
    sand: 10, ground: 10, darkGround: 9, cliff: 9,
    treeTrunk: 9, treeCanopy: 11,
    moteGlow: 5, moteMid: 14, moteDim: 13, text: 2,
  },
  tundra: {
    sky: 4, skyHorizon: 8, deepWater: 6, shallowWater: 7,
    sand: 4, ground: 3, darkGround: 2, cliff: 2,
    treeTrunk: 2, treeCanopy: 11,
    moteGlow: 8, moteMid: 4, moteDim: 15, text: 2,
  },
  volcanic: {
    sky: 15, skyHorizon: 2, deepWater: 1, shallowWater: 6,
    sand: 3, ground: 2, darkGround: 1, cliff: 0,
    treeTrunk: 2, treeCanopy: 11,
    moteGlow: 14, moteMid: 13, moteDim: 15, text: 3,
  },
  lush: {
    sky: 8, skyHorizon: 12, deepWater: 6, shallowWater: 7,
    sand: 10, ground: 12, darkGround: 11, cliff: 11,
    treeTrunk: 9, treeCanopy: 12,
    moteGlow: 14, moteMid: 12, moteDim: 8, text: 2,
  },
};

/** Pick a biome from a 0–1 random value */
export function pickBiome(r: number): Biome {
  if (r < 0.35) return "temperate";
  if (r < 0.55) return "desert";
  if (r < 0.70) return "tundra";
  if (r < 0.85) return "volcanic";
  return "lush";
}

export function getBiomePalette(biome: Biome): BiomePalette {
  return BIOME_PALETTES[biome];
}

/** Linearly interpolate between two palette colors */
export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
