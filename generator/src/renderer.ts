import type { Slots, Layer, TraitRegistry } from "./engine";

const LAYERS: Layer[] = [
  "backgrounds",
  "bodies",
  "heads",
  "accessories",
  "eyes",
  "mouths",
];

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function getTraitFile(
  registry: TraitRegistry,
  layer: Layer,
  traitId: string
): string | null {
  const traits = registry.traits[layer];
  const trait = traits.find((t) => t.id === traitId);
  return trait ? trait.file : null;
}

/** Resolve a trait file path relative to the generator's base URL. */
function resolveTraitPath(file: string): string {
  // Trait files are stored as "traits/heads/head_001.png" etc.
  // From the generator, we need to go up one level to the repo root.
  return `../${file}`;
}

/**
 * Render the current character combination onto a canvas.
 * Draw order: background, body, head, accessories, eyes, mouth.
 */
export async function renderCharacter(
  canvas: HTMLCanvasElement,
  slots: Slots,
  registry: TraitRegistry,
  scale: number = 8
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = 32 * scale;
  canvas.height = 32 * scale;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const layer of LAYERS) {
    const traitId = slots[layer];
    if (!traitId) continue;

    const file = getTraitFile(registry, layer, traitId);
    if (!file) continue;

    const src = resolveTraitPath(file);
    try {
      const img = await loadImage(src);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch {
      console.warn(`Could not load trait image: ${src}`);
    }
  }
}

/**
 * Export the current canvas content as a PNG blob at a given scale.
 */
export async function exportPNG(
  slots: Slots,
  registry: TraitRegistry,
  scale: number
): Promise<Blob | null> {
  const offscreen = document.createElement("canvas");
  offscreen.width = 32 * scale;
  offscreen.height = 32 * scale;

  await renderCharacter(offscreen, slots, registry, scale);

  return new Promise((resolve) => {
    offscreen.toBlob((blob) => resolve(blob), "image/png");
  });
}
