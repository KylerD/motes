// narrative.ts — Ambient story moments. Phase arc, milestones, event drama.

import type { World, PhaseName, Biome } from "./types";
import { isEventActive, getEventTriggerPoint } from "./events";
import { CYCLE_DURATION } from "./config";

// --- Narrative pools ---

/** Generic phase entry texts — biome overrides take precedence when available */
const PHASE_ENTRY: Record<PhaseName, string[]> = {
  genesis: [
    "a world begins to breathe",
    "the first light falls",
    "something ancient wakes",
    "emptiness stirs",
  ],
  exploration: [
    "they wander into the unknown",
    "curious sparks scatter",
    "each one finds its own path",
    "the world waits to be found",
  ],
  organization: [
    "they begin to find each other",
    "bonds reach across the distance",
    "warmth gathers at the center",
    "something like a village forms",
  ],
  complexity: [
    "everything alive at once",
    "the world at its fullest",
    "life in its richest hour",
    "at the height of all things",
  ],
  dissolution: [
    "the light begins to fade",
    "one by one, they let go",
    "nothing holds forever",
    "the long unraveling begins",
  ],
  silence: [
    "silence falls",
    "the world rests",
    "the cycle closes",
    "soon, again",
    "what was here, was real",
    "the echo of everything",
  ],
};

/**
 * Biome-specific phase entry overrides.
 * When a biome has text for the current phase, use that pool instead of generic.
 */
const BIOME_PHASE_ENTRY: Partial<Record<Biome, Partial<Record<PhaseName, string[]>>>> = {
  volcanic: {
    genesis:     ["fire touches the first light", "ash and awakening", "the mountain opens its eye"],
    exploration: ["they brave the heat", "curiosity stronger than the ash", "the lava fields call them"],
    dissolution: ["fire takes what fire made", "the mountain reclaims its own", "returning to ash"],
    silence:     ["embers settle", "the caldera rests", "only the smoke remembers"],
  },
  desert: {
    genesis:     ["heat rises on a waking world", "the silence wakes", "sand remembers nothing"],
    exploration: ["the vast emptiness calls", "they scatter like wind-seeds", "the dunes offer no shelter"],
    dissolution: ["heat claims the last light", "the sand was always here", "the desert outlasts all of them"],
    silence:     ["the desert outlasts everything", "the dunes shift and forget"],
  },
  tundra: {
    genesis:     ["cold greets the first stir", "frost on the first breath", "ice remembers everything"],
    exploration: ["the cold does not welcome them", "they seek warmth across open ice"],
    dissolution: ["winter closes over them", "the cold was always patient"],
    silence:     ["only ice endures", "the tundra smooths everything flat"],
  },
  lush: {
    genesis:     ["life wakes hungry for itself", "abundance stirs", "the green world begins"],
    complexity:  ["the world overflows", "life beyond counting", "a full and living place"],
    dissolution: ["even the green things fade", "plenty yields to quiet"],
    silence:     ["green returns to seed", "the forest holds the memory"],
  },
};

/** Fired ~25s before a rare event begins — anticipation without spoilers */
const ANTICIPATION_TEXTS = [
  "something stirs",
  "the air shifts",
  "a change approaches",
  "the world holds its breath",
];

/** Narrative text when an event starts — generic fallback */
const EVENT_START_TEXTS: Partial<Record<string, string>> = {
  flood:      "the waters rise",
  bloom:      "life erupts",
  meteor:     "fire from above",
  migration:  "they move as one",
  eclipse:    "darkness descends",
  earthquake: "the ground trembles",
  plague:     "a sickness spreads",
  aurora:     "the sky comes alive",
  drought:    "the land grows parched",
};

/**
 * Biome-specific event start overrides.
 * A flood in a desert, a drought in a lush world — these deserve their own words.
 */
const BIOME_EVENT_START: Partial<Record<Biome, Partial<Record<string, string>>>> = {
  desert: {
    flood:   "the desert drinks deep",
    bloom:   "impossible — and beautiful",
    drought: "the last water dreams of sky",
    aurora:  "the sky burns twice",
  },
  volcanic: {
    bloom:   "life defies the ash",
    flood:   "lava meets the tide",
    aurora:  "fire and sky conspire",
    plague:  "something in the smoke",
    drought: "even the lava pools dry",
  },
  tundra: {
    bloom:   "color cracks the frozen ground",
    drought: "the cold wind takes the last moisture",
    aurora:  "the sky is speaking",
    flood:   "the ice breaks open",
  },
  lush: {
    drought: "the green things wither",
    flood:   "the river remembers its width",
    plague:  "sickness moves through the abundance",
    eclipse: "even paradise goes dark",
  },
};

/**
 * Weather + event overlap lines.
 * When weather is notable at the moment an event triggers, this extra line
 * is queued after the event start text.
 */
const WEATHER_EVENT_OVERLAP: Partial<Record<string, Partial<Record<string, string>>>> = {
  storm: {
    flood:      "storm and flood — the world drowns",
    earthquake: "sky and earth break together",
    eclipse:    "darkness and lightning both",
    migration:  "they march into the storm",
  },
  rain: {
    drought:    "even the rain cannot save it",
    bloom:      "the rain feeds everything",
    plague:     "sickness rides the rain",
  },
  snow: {
    bloom:      "flowers push through the snow",
    drought:    "cold and dry — a strange thirst",
    eclipse:    "white world, dark sky",
  },
  fog: {
    migration:  "they vanish into the fog",
    eclipse:    "darkness within the darkness",
    plague:     "the sickness hides in the fog",
  },
};

/** Fired after a rare event ends — reflection, not recap */
const EVENT_AFTERMATH: Partial<Record<string, string[]>> = {
  flood:      ["the waters remember", "land reclaims the shore"],
  bloom:      ["color lingers", "the world breathes fuller"],
  meteor:     ["the scar endures", "the crater holds its silence"],
  migration:  ["they have gone where they must", "the path grows quiet"],
  eclipse:    ["light returns, changed", "the shadow remembers"],
  earthquake: ["the land has spoken", "stone reshapes the path"],
  plague:     ["the ones who endured", "hardship leaves its mark"],
  aurora:     ["beauty needs no reason", "the light knew"],
  drought:    ["the thirst passes", "memory of water"],
};

/** Fired when a phase transition happens while an event is still active */
const EVENT_CASCADE_TEXTS: Partial<Record<string, string>> = {
  flood:      "still the waters rise",
  bloom:      "life continues to pour forth",
  meteor:     "the crater holds its silence",
  migration:  "still they move as one",
  eclipse:    "the darkness persists",
  earthquake: "the earth still trembles",
  plague:     "the sickness endures",
  aurora:     "the lights still dance",
  drought:    "no relief yet",
};

/** Fired when mote count first peaks at 60+ during complexity */
const PEAK_POPULATION_TEXTS = [
  "all of them, alive at once",
  "the world at its fullest",
  "never more than this",
  "the peak of everything",
];

/** Fired on the first mote death during dissolution — the unraveling begins */
const DISSOLUTION_FIRST_DEATH_TEXTS = [
  "the first farewell",
  "the first to let go",
  "one light goes out",
  "it begins",
];

/** Fired when bond count drops below half peak during dissolution */
const DISSOLUTION_BONDS_BREAKING_TEXTS = [
  "the bonds begin to fray",
  "they drift apart",
  "communities unraveling",
  "the ties grow thin",
];

/** Fired when only one mote remains */
const LAST_MOTE_TEXTS = [
  "one light remains",
  "the last wanderer",
  "alone at the end",
  "only one",
];

/** Fired when the first cluster of 3+ forms — settlement becoming possible */
const FIRST_CLUSTER_TEXTS = [
  "roots take hold",
  "a place becomes home",
  "the first hearth",
  "here — they choose here",
];

/** Fired when the last mote dies and the world falls empty */
const EMPTY_WORLD_TEXTS = [
  "gone, all of them",
  "the world holds its breath",
  "what was here, was real",
  "the silence is complete",
];

// --- State ---

interface NarrativeEvent {
  text: string;
  time: number;
  duration: number;
}

export interface NarrativeState {
  queue: NarrativeEvent[];
  lastTime: number;
  lastBondCount: number;
  lastPhaseIndex: number;
  phaseNarrated: boolean[];         // [6] — one flag per phase
  narratedFirstElder: boolean;
  narratedFirstBond: boolean;
  narratedPeakCluster: boolean;
  peakClusterSize: number;
  eventAnticipated: boolean;
  eventStartNarrated: boolean;
  eventWasActive: boolean;
  eventAftermathNarrated: boolean;
  eventCascadeNarrated: boolean;
  narratedPeakPopulation: boolean;
  narratedFirstDeath: boolean;
  narratedBondsBreaking: boolean;
  narratedLastMote: boolean;
  narratedFirstCluster: boolean;
  narratedEmptyWorld: boolean;
  peakMoteCount: number;
  peakBondCount: number;
  el: HTMLElement | null;
}

export function createNarrative(): NarrativeState {
  return {
    queue: [],
    lastTime: -99,
    lastBondCount: 0,
    lastPhaseIndex: -1,
    phaseNarrated: [false, false, false, false, false, false],
    narratedFirstElder: false,
    narratedFirstBond: false,
    narratedPeakCluster: false,
    peakClusterSize: 0,
    eventAnticipated: false,
    eventStartNarrated: false,
    eventWasActive: false,
    eventAftermathNarrated: false,
    eventCascadeNarrated: false,
    narratedPeakPopulation: false,
    narratedFirstDeath: false,
    narratedBondsBreaking: false,
    narratedLastMote: false,
    narratedFirstCluster: false,
    narratedEmptyWorld: false,
    peakMoteCount: 0,
    peakBondCount: 0,
    el: document.getElementById("narrative"),
  };
}

export function updateNarrative(ns: NarrativeState, w: World): void {
  if (!ns.el) return;

  // Reset on new cycle
  if (w.time < 1) {
    ns.phaseNarrated = [false, false, false, false, false, false];
    ns.narratedFirstElder = false;
    ns.narratedFirstBond = false;
    ns.narratedPeakCluster = false;
    ns.peakClusterSize = 0;
    ns.lastBondCount = 0;
    ns.lastPhaseIndex = -1;
    ns.eventAnticipated = false;
    ns.eventStartNarrated = false;
    ns.eventWasActive = false;
    ns.eventAftermathNarrated = false;
    ns.eventCascadeNarrated = false;
    ns.narratedPeakPopulation = false;
    ns.narratedFirstDeath = false;
    ns.narratedBondsBreaking = false;
    ns.narratedLastMote = false;
    ns.narratedFirstCluster = false;
    ns.narratedEmptyWorld = false;
    ns.peakMoteCount = 0;
    ns.peakBondCount = 0;
    ns.queue = [];
    ns.el.textContent = "";
    ns.el.style.opacity = "0";
    return;
  }

  const now = w.time;

  // --- Phase entry narration (fires on phase change; bypasses cooldown) ---
  if (w.phaseIndex !== ns.lastPhaseIndex) {
    ns.lastPhaseIndex = w.phaseIndex;
    if (!ns.phaseNarrated[w.phaseIndex]) {
      ns.phaseNarrated[w.phaseIndex] = true;

      // Biome-specific override takes precedence over generic pool
      const biomePool = BIOME_PHASE_ENTRY[w.terrain.biome]?.[w.phaseName];
      const pool = biomePool ?? PHASE_ENTRY[w.phaseName];
      const pick = Math.abs((w.cycleNumber * 1000003 + w.phaseIndex * 97) % pool.length);
      let text = pool[pick];

      // Weather overlay for genesis — only if we fell back to generic pool
      if (!biomePool && w.phaseName === "genesis" && w.weather.type !== "clear") {
        const weatherGenesis: Partial<Record<string, string>> = {
          rain:     "rain falls on a waking world",
          storm:    "a storm greets the waking world",
          snow:     "snow settles on new ground",
          overcast: "clouds gather as the world stirs",
          fog:      "fog shrouds the first breath",
        };
        text = weatherGenesis[w.weather.type] ?? text;
      }

      pushNarrative(ns, text, now, true);
    }

    // Event cascade: if a rare event is actively ongoing during this phase transition
    if (
      w.event &&
      w.eventTriggered &&
      isEventActive(w.event, w.time) &&
      !ns.eventCascadeNarrated
    ) {
      ns.eventCascadeNarrated = true;
      const cascadeText = EVENT_CASCADE_TEXTS[w.event.type];
      if (cascadeText) {
        ns.queue.push({ text: cascadeText, time: now, duration: 5 });
      }
    }
  }

  // --- Milestone narration (respect 6s cooldown) ---
  const canNarrate = now - ns.lastTime >= 6;
  if (!canNarrate) {
    displayNarrative(ns, now);
    return;
  }

  let bondCount = 0;
  for (const m of w.motes) bondCount += m.bonds.length;
  bondCount = Math.floor(bondCount / 2);

  // Track peaks
  if (w.motes.length > ns.peakMoteCount) ns.peakMoteCount = w.motes.length;
  if (bondCount > ns.peakBondCount) ns.peakBondCount = bondCount;

  // First bond
  if (!ns.narratedFirstBond && bondCount > 0) {
    ns.narratedFirstBond = true;
    pushNarrative(ns, "the first bond forms", now);
  }

  // First elder
  if (!ns.narratedFirstElder) {
    for (const m of w.motes) {
      if (m.age > 20) {
        ns.narratedFirstElder = true;
        pushNarrative(ns, "an elder endures", now);
        break;
      }
    }
  }

  // Cluster tracking
  let maxCluster = 0;
  for (const c of w.clusters) if (c.length > maxCluster) maxCluster = c.length;
  if (maxCluster > ns.peakClusterSize) ns.peakClusterSize = maxCluster;

  // First cluster of 3 — roots taking hold, a settlement could form
  if (
    !ns.narratedFirstCluster &&
    maxCluster >= 3 &&
    (w.phaseName === "organization" || w.phaseName === "complexity")
  ) {
    ns.narratedFirstCluster = true;
    const pick = Math.abs((w.cycleNumber * 999911) % FIRST_CLUSTER_TEXTS.length);
    pushNarrative(ns, FIRST_CLUSTER_TEXTS[pick], now);
  }

  // Peak cluster milestone — "a great gathering" when cluster ≥ 6
  if (
    !ns.narratedPeakCluster &&
    ns.peakClusterSize >= 6 &&
    w.phaseName !== "dissolution" &&
    w.phaseName !== "silence"
  ) {
    ns.narratedPeakCluster = true;
    pushNarrative(ns, "a great gathering", now);
  }

  // Peak population — narrate when mote count first hits 60 during complexity
  if (
    !ns.narratedPeakPopulation &&
    w.motes.length >= 60 &&
    w.phaseName === "complexity"
  ) {
    ns.narratedPeakPopulation = true;
    const pick = Math.abs((w.cycleNumber * 999937) % PEAK_POPULATION_TEXTS.length);
    pushNarrative(ns, PEAK_POPULATION_TEXTS[pick], now);
  }

  // Dissolution: first death — the unraveling's opening beat
  if (
    !ns.narratedFirstDeath &&
    (w.phaseName === "dissolution" || w.phaseName === "silence") &&
    w.deaths.length > 0
  ) {
    ns.narratedFirstDeath = true;
    const pick = Math.abs((w.cycleNumber * 999931) % DISSOLUTION_FIRST_DEATH_TEXTS.length);
    pushNarrative(ns, DISSOLUTION_FIRST_DEATH_TEXTS[pick], now);
  }

  // Dissolution: bonds fragmenting
  if (
    !ns.narratedBondsBreaking &&
    ns.peakBondCount > 4 &&
    bondCount < Math.floor(ns.peakBondCount * 0.45) &&
    w.phaseName === "dissolution"
  ) {
    ns.narratedBondsBreaking = true;
    const pick = Math.abs((w.cycleNumber * 999929) % DISSOLUTION_BONDS_BREAKING_TEXTS.length);
    pushNarrative(ns, DISSOLUTION_BONDS_BREAKING_TEXTS[pick], now);
  }

  // Last mote — the final witness
  if (
    !ns.narratedLastMote &&
    w.motes.length === 1 &&
    (w.phaseName === "dissolution" || w.phaseName === "silence")
  ) {
    ns.narratedLastMote = true;
    const pick = Math.abs((w.cycleNumber * 999923) % LAST_MOTE_TEXTS.length);
    pushNarrative(ns, LAST_MOTE_TEXTS[pick], now);
  }

  // Empty world — the world has fully emptied
  if (
    !ns.narratedEmptyWorld &&
    w.motes.length === 0 &&
    (w.phaseName === "dissolution" || w.phaseName === "silence")
  ) {
    ns.narratedEmptyWorld = true;
    const pick = Math.abs((w.cycleNumber * 999907) % EMPTY_WORLD_TEXTS.length);
    pushNarrative(ns, EMPTY_WORLD_TEXTS[pick], now);
  }

  // --- Event anticipation (~25s before trigger) ---
  if (w.event && !w.eventTriggered && !ns.eventAnticipated) {
    const triggerProgress = getEventTriggerPoint(w.event.type);
    const timeUntilTrigger = (triggerProgress - w.cycleProgress) * CYCLE_DURATION;
    if (timeUntilTrigger > 0 && timeUntilTrigger < 28) {
      ns.eventAnticipated = true;
      const pick = Math.abs((w.cycleNumber * 999983) % ANTICIPATION_TEXTS.length);
      pushNarrative(ns, ANTICIPATION_TEXTS[pick], now);
    }
  }

  // --- Event start narration ---
  if (w.event && w.eventTriggered && isEventActive(w.event, w.time) && !ns.eventStartNarrated) {
    const elapsed = w.time - w.event.startTime;
    if (elapsed >= 0 && elapsed < 1) {
      ns.eventStartNarrated = true;
      ns.eventWasActive = true;
      // Biome-specific override, then generic
      const biomeText = BIOME_EVENT_START[w.terrain.biome]?.[w.event.type];
      const text = biomeText ?? EVENT_START_TEXTS[w.event.type];
      if (text) pushNarrative(ns, text, now);

      // Weather-event overlap — queue an extra line if weather makes this more dramatic
      const overlapText = WEATHER_EVENT_OVERLAP[w.weather.type]?.[w.event.type];
      if (overlapText) {
        ns.queue.push({ text: overlapText, time: now, duration: 5 });
      }
    }
  }

  // --- Event aftermath narration ---
  if (
    ns.eventWasActive &&
    !ns.eventAftermathNarrated &&
    w.event &&
    w.eventTriggered &&
    !isEventActive(w.event, w.time)
  ) {
    ns.eventAftermathNarrated = true;
    const pool = EVENT_AFTERMATH[w.event.type];
    if (pool) {
      const pick = Math.abs((w.cycleNumber * 999979) % pool.length);
      pushNarrative(ns, pool[pick], now);
    }
  }

  ns.lastBondCount = bondCount;
  displayNarrative(ns, now);
}

// --- Helpers ---

function pushNarrative(
  ns: NarrativeState,
  text: string,
  now: number,
  force = false,
): void {
  if (!force && now - ns.lastTime < 6) return;
  // Avoid duplicating the last queued text
  if (ns.queue.length > 0 && ns.queue[ns.queue.length - 1].text === text) return;
  ns.queue.push({ text, time: now, duration: 5 });
  ns.lastTime = now;
}

function displayNarrative(ns: NarrativeState, now: number): void {
  if (!ns.el || ns.queue.length === 0) return;
  const current = ns.queue[0];
  const age = now - current.time;

  if (age > current.duration) {
    ns.queue.shift();
    ns.el.style.opacity = "0";
    // Reset the next item's start time so it always gets its full display window
    if (ns.queue.length > 0) {
      ns.queue[0].time = now;
    }
  } else if (age < 0.8) {
    ns.el.textContent = current.text;
    ns.el.style.opacity = String(Math.min(1, age / 0.8));
  } else if (age > current.duration - 1) {
    ns.el.style.opacity = String(Math.max(0, current.duration - age));
  } else {
    ns.el.style.opacity = "1";
  }
}
