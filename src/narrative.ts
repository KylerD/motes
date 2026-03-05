// narrative.ts — Ambient story moments that appear below the canvas.

import type { World } from "./types";
import { findClusters } from "./physics";
import { isEventActive } from "./events";

interface NarrativeEvent {
  text: string;
  time: number;
  duration: number;
}

export interface NarrativeState {
  queue: NarrativeEvent[];
  lastTime: number;
  lastBondCount: number;
  lastMoteCount: number;
  narratedFirstElder: boolean;
  narratedFirstLife: boolean;
  narratedDissolution: boolean;
  narratedSilence: boolean;
  el: HTMLElement | null;
}

export function createNarrative(): NarrativeState {
  return {
    queue: [],
    lastTime: 0,
    lastBondCount: 0,
    lastMoteCount: 0,
    narratedFirstElder: false,
    narratedFirstLife: false,
    narratedDissolution: false,
    narratedSilence: false,
    el: document.getElementById("narrative"),
  };
}

export function updateNarrative(ns: NarrativeState, w: World): void {
  if (!ns.el) return;

  // Reset on new cycle
  if (w.time < 1) {
    ns.narratedFirstElder = false;
    ns.narratedFirstLife = false;
    ns.narratedDissolution = false;
    ns.narratedSilence = false;
    ns.lastBondCount = 0;
    ns.lastMoteCount = 0;
    ns.queue = [];
    ns.el.textContent = "";
    ns.el.style.opacity = "0";
  }

  const now = w.time;
  if (now - ns.lastTime < 6) {
    displayNarrative(ns, now);
    return;
  }

  let bondCount = 0;
  for (const m of w.motes) bondCount += m.bonds.length;
  bondCount = Math.floor(bondCount / 2);

  // Weather narrative — early in cycle
  if (!ns.narratedFirstLife && w.time > 2 && w.time < 4) {
    const weatherTexts: Record<string, string> = {
      rain: "rain begins to fall",
      storm: "a storm gathers",
      snow: "snow drifts down",
      overcast: "clouds hang low",
      fog: "a mist settles",
    };
    const wt = weatherTexts[w.weather.type];
    if (wt) pushNarrative(ns, wt, now);
  }

  // First motes appear
  if (!ns.narratedFirstLife && w.motes.length > 5 && w.motes.length > ns.lastMoteCount + 3) {
    pushNarrative(ns, "life stirs", now);
    ns.narratedFirstLife = true;
  }

  // First bonds
  if (bondCount > 0 && ns.lastBondCount === 0 && ns.narratedFirstLife) {
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

  // Large cluster
  const largeClusters = findClusters(w.motes).filter(c => c.length >= 5);
  if (largeClusters.length > 0 && bondCount > ns.lastBondCount + 4) {
    pushNarrative(ns, "a community takes shape", now);
  }

  // Dissolution
  if (w.phaseName === "dissolution" && !ns.narratedDissolution) {
    ns.narratedDissolution = true;
    pushNarrative(ns, "the light begins to fade", now);
  }

  // Silence
  if (w.phaseName === "silence" && !ns.narratedSilence) {
    ns.narratedSilence = true;
    pushNarrative(ns, "silence falls", now);
  }

  // Event narration
  if (w.event && w.eventTriggered && isEventActive(w.event, w.time)) {
    const elapsed = w.time - w.event.startTime;
    if (elapsed > 0 && elapsed < 0.5) {
      const eventTexts: Record<string, string> = {
        flood: "the waters rise",
        bloom: "life erupts",
        meteor: "something falls from above",
        migration: "they move as one",
        eclipse: "darkness descends",
        earthquake: "the ground trembles",
        plague: "a sickness spreads",
        aurora: "the sky comes alive",
        drought: "the land grows parched",
      };
      const text = eventTexts[w.event.type];
      if (text) pushNarrative(ns, text, now);
    }
  }

  ns.lastBondCount = bondCount;
  ns.lastMoteCount = w.motes.length;

  displayNarrative(ns, now);
}

function pushNarrative(ns: NarrativeState, text: string, now: number): void {
  if (ns.queue.length > 0 && ns.queue[ns.queue.length - 1].text === text) return;
  if (now - ns.lastTime < 6) return;
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
  } else if (age < 0.8) {
    ns.el.textContent = current.text;
    ns.el.style.opacity = String(Math.min(1, age / 0.8));
  } else if (age > current.duration - 1) {
    ns.el.style.opacity = String(Math.max(0, (current.duration - age)));
  } else {
    ns.el.style.opacity = "1";
  }
}
