// sound-weather.ts — Weather ambient sounds, dissolution rain, thunder.

import type { SoundEngine, Weather, Biome } from "./types";
import { createNoiseSource } from "./sound";

// ---- Dissolution rain state (module-level) ----
// Dissolution rain runs independently of weather.type
let _drSource: AudioBufferSourceNode | null = null;
let _drGain: GainNode | null = null;
let _drActive = false;

/** Update ambient weather sounds — audible rain, wind, thunder */
export function updateWeatherSound(engine: SoundEngine, weather: Weather): void {
  if (!engine.initialized) return;

  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const amb = engine.weatherAmbient;
  const needsRain = weather.type === "rain" || weather.type === "storm";
  const needsWind = weather.type === "storm" || weather.type === "snow" || weather.type === "overcast";

  if (amb.currentType !== weather.type) {
    if (amb.rainGain) amb.rainGain.gain.linearRampToValueAtTime(0, now + 1);
    if (amb.windGain) amb.windGain.gain.linearRampToValueAtTime(0, now + 1);
    if (amb.rainSource) { try { amb.rainSource.stop(now + 1.1); } catch (_) { /* ignore */ } }
    if (amb.windSource) { try { amb.windSource.stop(now + 1.1); } catch (_) { /* ignore */ } }
    amb.rainSource = null; amb.rainGain = null; amb.rainFilter = null;
    amb.windSource = null; amb.windGain = null; amb.windFilter = null;

    if (needsRain) {
      const src = createNoiseSource(ctx, 2);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = weather.type === "storm" ? 1000 : 3000;
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      const targetVol = weather.type === "storm"
        ? 0.10 + weather.intensity * 0.12
        : 0.06 + weather.intensity * 0.08;
      gain.gain.linearRampToValueAtTime(targetVol, now + 2);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.masterGain);
      src.start(now);
      amb.rainSource = src;
      amb.rainGain = gain;
      amb.rainFilter = filter;
    }

    if (needsWind) {
      const src = createNoiseSource(ctx, 3);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      const targetVol = weather.type === "storm"
        ? 0.08 + weather.intensity * 0.08
        : 0.04 + weather.intensity * 0.04;
      gain.gain.linearRampToValueAtTime(targetVol, now + 2);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(engine.masterGain);
      src.start(now);
      amb.windSource = src;
      amb.windGain = gain;
      amb.windFilter = filter;
    }

    amb.currentType = weather.type;
  }

  if (amb.rainFilter && needsRain) {
    const sweep = Math.sin(now * 0.3) * 800 + (weather.type === "storm" ? 1500 : 3000);
    amb.rainFilter.frequency.linearRampToValueAtTime(sweep, now + 0.1);
  }

  if (amb.windGain && needsWind) {
    const gustBase = weather.type === "storm" ? 0.10 : 0.05;
    const gustSwing = weather.type === "storm" ? 0.06 : 0.03;
    const gust = gustBase + Math.sin(now * 0.6) * gustSwing + Math.sin(now * 1.7) * gustSwing * 0.5;
    amb.windGain.gain.linearRampToValueAtTime(Math.max(0, gust), now + 0.1);
  }

  if (weather.type === "storm" && weather.lightning.active) {
    amb.thunderCooldown -= 0.067;
    if (amb.thunderCooldown <= 0) {
      playThunder(engine, weather.lightning.brightness);
      amb.thunderCooldown = 15 + Math.random() * 25;
    }
  }
}

/** Low rumbling thunder */
function playThunder(engine: SoundEngine, intensity: number): void {
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const len = Math.floor(ctx.sampleRate * 1.5);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 150;
  const gain = ctx.createGain();
  const vol = 0.15 + intensity * 0.10;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(engine.compressor);
  src.start(now);
  src.stop(now + 1.5);
}

/**
 * Phase-driven rain patter during dissolution.
 * The world mourns its own ending in soft rain sounds that build and fade.
 * Only activates in non-desert/volcanic biomes and when weather isn't already rain/storm.
 * Call once per frame from the main loop.
 */
export function updateDissolutionSound(
  engine: SoundEngine,
  cycleProgress: number,
  biome: Biome,
  weatherType: string,
): void {
  if (!engine.initialized) return;

  const ctx = engine.ctx;
  const now = ctx.currentTime;

  // Desert and volcanic skip — they already have appropriate atmosphere
  const rainBiome = biome !== "desert" && biome !== "volcanic";
  // Don't double-stack with existing rain/storm weather sound
  const weatherHasRain = weatherType === "rain" || weatherType === "storm";
  const shouldRain = cycleProgress >= 0.83 && cycleProgress < 0.93 && rainBiome && !weatherHasRain;

  const localP = Math.max(0, Math.min(1, (cycleProgress - 0.83) / 0.10));
  const fadeIn  = Math.min(1.0, localP * 5.0);
  const fadeOut = localP > 0.78 ? (1.0 - (localP - 0.78) / 0.22) : 1.0;
  const str = shouldRain ? fadeIn * fadeOut : 0;

  // Spin up the rain source when dissolution rain begins
  if (str > 0.01 && !_drActive) {
    const src = createNoiseSource(ctx, 3);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    // Tundra: higher freq icy sleet; lush: mid-freq; temperate: soft patter
    filter.frequency.value = biome === "tundra" ? 4800 : biome === "lush" ? 2400 : 3000;
    filter.Q.value = 0.65;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(engine.masterGain);
    src.start(now);
    _drSource = src;
    _drGain = gain;
    _drActive = true;
  }

  // Track volume with phase envelope
  if (_drGain && _drActive) {
    const maxVol = biome === "lush" ? 0.055 : 0.038;
    const targetVol = Math.max(0.001, str * maxVol);
    _drGain.gain.linearRampToValueAtTime(targetVol, now + 0.25);
  }

  // Fade out and stop when dissolution ends or weather changes
  if (!shouldRain && _drActive) {
    if (_drGain) _drGain.gain.linearRampToValueAtTime(0.001, now + 1.5);
    if (_drSource) {
      try { _drSource.stop(now + 1.6); } catch (_) { /* already stopped */ }
      _drSource = null;
    }
    _drGain = null;
    _drActive = false;
  }
}
