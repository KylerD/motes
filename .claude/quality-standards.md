# Mote — Visual & Audio Quality Standards

These are permanent quality thresholds. The `analyze-quality.mjs` script measures the visual ones automatically. Every change you make must pass these — they are not optional, not aspirational, and not negotiable.

## Mote Visibility

Motes are the stars of the show. They MUST be clearly visible against any terrain/biome at all times.

- **Body alpha**: Core body pixels must render at 200+ alpha (out of 255). If a mote blends into the terrain, it's broken. Translucency is for auras and trails, not the creature itself.
- **Contrast**: A mote must be distinguishable from the terrain pixel it stands on within 1 second of looking. If you have to squint, it's too dim.
- **Size**: 5-7 pixel sprites are the sweet spot at 256x144. Smaller disappears; larger crowds the world.
- **Outline**: Dark outlines must be near-opaque (alpha 220+) to provide contrast in all biomes.

**Metric targets**: `avgMoteBrightness` >= 0.55, `visibleMoteCount` should roughly match actual mote population.

## Mote Separation

Motes must read as distinct individuals, not an amorphous blob.

- **Minimum spacing**: Short-range repulsion must be strong enough that two motes never fully overlap. ~6px minimum center-to-center when adjacent.
- **Cluster readability**: A group of 5 motes must let the viewer approximate "about 5 creatures." If it looks like 1-2 bright smears, repulsion is too weak or attraction too strong.
- **Landscape usage**: Motes should spread across the terrain, not huddle in one corner. Social attraction should create loose groups, not death-balls.

**Metric targets**: `clumpedMoteRatio` < 0.25, `moteSpreadX` > 0.4.

## Water & Liquid Variety

Water must not be a flat fill at a single height threshold every map.

- **Shape variety**: Different terrain archetypes should produce different water shapes. Not every map should look like "pool at the bottom."
- **Multiple bodies**: Some maps should have isolated pools, elevated lakes, or distributed wetlands — not always one contiguous basin.
- **Visual interest**: Water should shimmer, reflect, or otherwise feel alive — not be a flat colored rectangle.

**Metric targets**: `waterBodyCount` >= 1, water shape should vary visibly across different cycle seeds.

## Phase Arc

The 5-minute cycle must have an unmistakable emotional arc. Looking at a screenshot from genesis vs complexity vs silence should feel dramatically different.

- **Genesis** (0-10%): Few motes, quiet, fragile.
- **Exploration** (10-30%): Motes spreading, discovering terrain.
- **Organization** (30-55%): Bonds forming, clusters emerging.
- **Complexity** (55-80%): Peak life. Rich networks. Most visually and sonically full.
- **Dissolution** (80-92%): Energy draining, deaths, bonds breaking.
- **Silence** (92-100%): Empty landscape. Few or zero motes. Haunting quiet.

## Sound Quality

Sound is not decoration. It should be the first thing that makes someone put on headphones.

### Principles that must hold:
- **Notes, not drones**: Voices must play discrete notes with attack/decay envelopes. Silence between notes creates rhythm. A continuously-held oscillator at constant gain is a drone — never acceptable as the primary sound.
- **Mote sonic identity**: Individual motes should produce audible sounds (chirps, clicks, short melodic fragments) that vary with temperament. Not just cluster averages.
- **Weather is audible**: Rain must sound like rain (individual drops or textured wash), not faint white noise hiss. Wind must gust. Thunder must surprise. If you can't tell the weather by sound alone, it's broken.
- **Phase arc in sound**: Genesis must sound sparse and delicate. Complexity must sound rich and layered. Silence must sound genuinely empty. The sonic difference must be as dramatic as the visual difference.
- **Emotional moments ring out**: Bond formation = clear pleasant chime. Death = audible melancholy tone. These must be clearly heard above the ambient soundscape, not buried at 0.02 gain.
- **Dynamic range**: Quiet parts genuinely quiet. Present parts genuinely present. A flat volume curve = drone.

### Sound anti-patterns (never do these):
- Holding oscillators at constant gain without envelopes
- All voices using the same waveform
- Gain values under 0.05 for intentionally audible sounds
- Smooth frequency ramps with no gaps (glissando mush)
- Noise-based ambient that just sounds like TV static
