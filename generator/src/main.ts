import {
  type TraitRegistry,
  type PaletteRegistry,
  type Slots,
  type Layer,
  LAYERS,
  selectRandom,
  parsePrompt,
  encodeCombination,
  decodeCombination,
} from "./engine";
import { renderCharacter, exportPNG } from "./renderer";

let registry: TraitRegistry | null = null;
let _palettes: PaletteRegistry | null = null;
let currentSlots: Slots = {
  heads: null,
  bodies: null,
  accessories: null,
  eyes: null,
  mouths: null,
  backgrounds: null,
};
const lockedSlots = new Set<Layer>();

const canvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
const archetypeSelect = document.getElementById(
  "archetype-filter"
) as HTMLSelectElement;
const promptInput = document.getElementById("prompt-input") as HTMLInputElement;
const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;
const randomiseBtn = document.getElementById(
  "randomise-btn"
) as HTMLButtonElement;
const shareBtn = document.getElementById("share-btn") as HTMLButtonElement;
const shareMsg = document.getElementById("share-msg") as HTMLSpanElement;
const dl1xBtn = document.getElementById("dl-1x") as HTMLButtonElement;
const dl4xBtn = document.getElementById("dl-4x") as HTMLButtonElement;
const dl8xBtn = document.getElementById("dl-8x") as HTMLButtonElement;

function getArchetype(): string | null {
  const val = archetypeSelect.value;
  return val === "any" ? null : val;
}

function randomiseAll(keywords: string[] = []) {
  if (!registry) return;
  const arch = getArchetype();
  for (const layer of LAYERS) {
    if (lockedSlots.has(layer)) continue;
    const traits = registry.traits[layer];
    const id = selectRandom(traits, arch, keywords);
    currentSlots[layer] = id;
  }
  render();
}

function randomiseLayer(layer: Layer) {
  if (!registry) return;
  const arch = getArchetype();
  const traits = registry.traits[layer];
  const id = selectRandom(traits, arch);
  currentSlots[layer] = id;
  render();
}

async function render() {
  if (!registry) return;
  await renderCharacter(canvas, currentSlots, registry, 8);
  updateSlotDisplays();
}

function updateSlotDisplays() {
  if (!registry) return;
  for (const layer of LAYERS) {
    const nameEl = document.getElementById(`slot-name-${layer}`);
    if (!nameEl) continue;
    const traitId = currentSlots[layer];
    if (!traitId) {
      nameEl.textContent = "None";
      continue;
    }
    const trait = registry.traits[layer].find((t) => t.id === traitId);
    nameEl.textContent = trait ? trait.name : traitId;
  }
}

function toggleLock(layer: Layer) {
  if (lockedSlots.has(layer)) {
    lockedSlots.delete(layer);
  } else {
    lockedSlots.add(layer);
  }
  const lockBtn = document.getElementById(`lock-${layer}`);
  if (lockBtn) {
    lockBtn.textContent = lockedSlots.has(layer) ? "Locked" : "Lock";
    lockBtn.classList.toggle("locked", lockedSlots.has(layer));
  }
}

async function download(scale: number) {
  if (!registry) return;
  const blob = await exportPNG(currentSlots, registry, scale);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `character_${scale}x.png`;
  a.click();
  URL.revokeObjectURL(url);

  // Fire download tracking (silently ignore errors)
  const combination = LAYERS.map((l) => currentSlots[l] || "none").join("|");
  try {
    fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ combination }),
    }).catch(() => {});
  } catch {
    // Silently ignore
  }
}

function shareLink() {
  const params = encodeCombination(currentSlots);
  const url = `${window.location.origin}${window.location.pathname}?${params}`;
  navigator.clipboard.writeText(url).then(
    () => {
      shareMsg.textContent = "Copied!";
      setTimeout(() => {
        shareMsg.textContent = "";
      }, 2000);
    },
    () => {
      shareMsg.textContent = "Copy failed";
      setTimeout(() => {
        shareMsg.textContent = "";
      }, 2000);
    }
  );
}

function setupSlotControls() {
  for (const layer of LAYERS) {
    const randomBtn = document.getElementById(`random-${layer}`);
    if (randomBtn) {
      randomBtn.addEventListener("click", () => randomiseLayer(layer));
    }
    const lockBtn = document.getElementById(`lock-${layer}`);
    if (lockBtn) {
      lockBtn.addEventListener("click", () => toggleLock(layer));
    }
  }
}

function applyURLParams() {
  const decoded = decodeCombination(window.location.search);
  let hasParams = false;
  for (const layer of LAYERS) {
    if (decoded[layer]) {
      currentSlots[layer] = decoded[layer]!;
      hasParams = true;
    }
  }
  return hasParams;
}

async function init() {
  try {
    const [regRes, palRes] = await Promise.all([
      fetch("../traits/index.json"),
      fetch("../palettes/index.json"),
    ]);
    registry = await regRes.json();
    _palettes = await palRes.json();
  } catch (err) {
    console.error("Failed to load data:", err);
    return;
  }

  setupSlotControls();

  randomiseBtn.addEventListener("click", () => randomiseAll());
  generateBtn.addEventListener("click", () => {
    const keywords = parsePrompt(promptInput.value);
    randomiseAll(keywords);
  });
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const keywords = parsePrompt(promptInput.value);
      randomiseAll(keywords);
    }
  });

  shareBtn.addEventListener("click", shareLink);
  dl1xBtn.addEventListener("click", () => download(1));
  dl4xBtn.addEventListener("click", () => download(4));
  dl8xBtn.addEventListener("click", () => download(8));

  const hasParams = applyURLParams();
  if (!hasParams) {
    randomiseAll();
  } else {
    // Fill in missing slots randomly
    for (const layer of LAYERS) {
      if (!currentSlots[layer] && registry) {
        const traits = registry.traits[layer];
        currentSlots[layer] = selectRandom(traits, null);
      }
    }
    render();
  }
}

init();
