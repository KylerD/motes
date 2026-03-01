# Manifesto

This document defines the visual language, structural rules, and quality standards for the CC0 Pixel Art Character Generator. The agent reads this file before every loop. Every decision the agent makes should trace back to something written here.

---

## Visual Language

- All characters are **32x32 pixels**. No exceptions.
- Maximum **5 colours per character**, including the background colour.
- All colours must be sourced from the **approved palette system only**. No freehand colour picking.
- Characters must be **readable as silhouettes**. If the shape is not recognisable at thumbnail size, the design has failed.
- **No anti-aliasing.** Hard pixel edges only. Every pixel is a deliberate placement.
- **No gradients.** Flat colour only. Shading is achieved through palette selection, not blending.

---

## Trait Coherence Rules

- Every trait must work with every other trait in the same layer. No combination should look broken, clipped, or misaligned.
- Accessories add to the character without dominating the silhouette. An accessory that overwhelms the base shape is too large or too detailed.
- Eyes and mouths carry personality and are designed as **families**, not individual pieces. An eye set should share a design philosophy across its variants so swapping between them feels like changing expression, not changing species.
- A trait that looks good in isolation but breaks combinations is a candidate for deprecation. Coherence across the system always wins over individual flair.

---

## The Five Archetype Families

Each archetype defines a design direction, a material language, and a palette range. Traits are not locked to a single archetype, but every trait should feel most at home in one of these five families.

### Wanderer
Weathered, practical, earthy. These are characters who have been on the road a long time and their gear shows it. Cloaks, hoods, travel-worn leather, patched fabric, functional simplicity.
**Palette:** Browns, tans, muted greens.

### Merchant
Layered, ornamented, prosperous. Merchants carry their wealth visibly. Fine details at pixel scale, coin motifs, rich fabrics suggested through colour contrast, and an overall impression of abundance without excess.
**Palette:** Golds, deep reds, warm neutrals.

### Militant
Structured, armoured, battle-ready. Clean lines, hard geometry, functional design with no wasted space. Every element serves a purpose. Symmetry is preferred but not required.
**Palette:** Steel greys, deep blues, black.

### Scholar
Precise, decorated, intellectual. Robes with careful folds, symbols and glyphs as decorative elements, intricate accessories that suggest learning and authority. Detail-heavy but controlled.
**Palette:** Deep purples, burgundy, aged parchment.

### Outcast
Asymmetric, patched, improvised. These characters are built from whatever was available. Mixed materials, irregular silhouettes, visible marks and scars. Nothing matches, but everything holds together.
**Palette:** Desaturated everything, rust, bone.

---

## Quality Bar

- Every trait must look **intentional at 1x and at 4x zoom**. If a pixel looks accidental at either scale, it needs to be fixed or removed.
- Novelty is valued but not at the cost of coherence. A surprising trait that fits the world is excellent. A surprising trait that breaks the world is a problem.
- **When in doubt, simpler is better.** A clean 8-pixel shape beats a noisy 20-pixel shape every time at this resolution.

---

## What the Agent Is Trying to Achieve

The visual language should feel like it belongs to a single coherent world. A character assembled from any valid combination of traits should feel like they could exist in the same place, standing next to any other character from the same generator. There should be no jarring mismatches, no traits that feel like they wandered in from a different project.

The agent's job is to push the library toward that coherence, one PR at a time. Add traits that fill gaps. Adjust traits that drift. Propose deprecation for traits that resist integration. The library is a living system and the agent is its gardener.
