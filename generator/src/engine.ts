export interface Trait {
  id: string;
  name: string;
  archetype: string;
  palette: string;
  file: string;
  tags: string[];
  added: string;
  addedBy: string;
  downloads: number;
  combinationsOk: boolean;
  status: string;
}

export interface TraitRegistry {
  version: string;
  lastUpdated: string;
  traits: {
    heads: Trait[];
    bodies: Trait[];
    accessories: Trait[];
    eyes: Trait[];
    mouths: Trait[];
    backgrounds: Trait[];
  };
}

export interface PaletteEntry {
  name: string;
  colours: string[];
}

export interface PaletteRegistry {
  version: string;
  palettes: Record<string, PaletteEntry>;
}

export type Layer = keyof TraitRegistry["traits"];

export interface Slots {
  heads: string | null;
  bodies: string | null;
  accessories: string | null;
  eyes: string | null;
  mouths: string | null;
  backgrounds: string | null;
}

const LAYERS: Layer[] = [
  "heads",
  "bodies",
  "accessories",
  "eyes",
  "mouths",
  "backgrounds",
];

/** URL param keys for each layer */
const PARAM_MAP: Record<Layer, string> = {
  heads: "h",
  bodies: "b",
  accessories: "a",
  eyes: "e",
  mouths: "m",
  backgrounds: "bg",
};

const PARAM_MAP_REVERSE: Record<string, Layer> = {};
for (const [layer, param] of Object.entries(PARAM_MAP)) {
  PARAM_MAP_REVERSE[param] = layer as Layer;
}

/** Select a random trait from a layer, optionally filtered by archetype and weighted by tag match. */
export function selectRandom(
  traits: Trait[],
  archetype: string | null,
  keywords: string[] = []
): string | null {
  let pool = traits.filter((t) => t.status === "active");

  if (archetype && archetype !== "any") {
    const filtered = pool.filter((t) => t.archetype === archetype);
    if (filtered.length > 0) pool = filtered;
  }

  if (pool.length === 0) return null;

  if (keywords.length > 0) {
    const scored = scoreTraits(pool, keywords);
    if (scored.length > 0 && scored[0].score > 0) {
      // Weighted random from scored results
      const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
      let roll = Math.random() * totalScore;
      for (const entry of scored) {
        roll -= entry.score;
        if (roll <= 0) return entry.id;
      }
      return scored[0].id;
    }
  }

  // Pure random
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** Parse a text prompt into lowercase keywords. */
export function parsePrompt(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Score traits by how many of their tags match the keywords. */
export function scoreTraits(
  traits: Trait[],
  keywords: string[]
): { id: string; score: number }[] {
  const scored = traits
    .filter((t) => t.status === "active")
    .map((t) => {
      const score = t.tags.reduce((sum, tag) => {
        const tagLower = tag.toLowerCase();
        return (
          sum + keywords.filter((kw) => tagLower.includes(kw) || kw.includes(tagLower)).length
        );
      }, 0);
      return { id: t.id, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored;
}

/** Encode a slots object into URL params. */
export function encodeCombination(slots: Slots): string {
  const params = new URLSearchParams();
  for (const layer of LAYERS) {
    const val = slots[layer];
    if (val) {
      params.set(PARAM_MAP[layer], val);
    }
  }
  return params.toString();
}

/** Decode URL params into a slots object. */
export function decodeCombination(search: string): Partial<Slots> {
  const params = new URLSearchParams(search);
  const slots: Partial<Slots> = {};
  for (const [param, layer] of Object.entries(PARAM_MAP_REVERSE)) {
    const val = params.get(param);
    if (val) {
      slots[layer] = val;
    }
  }
  return slots;
}

export { LAYERS, PARAM_MAP };
