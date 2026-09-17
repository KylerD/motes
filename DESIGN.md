---
name: Motes
description: Illustrated sanctuaries with living light, quiet weather and generative sound.
colors:
  ink: "#071b29"
  panel: "#102d39"
  text: "#fff1df"
  quiet: "#d6e2df"
  line: "#8cb1b16b"
  gold: "#f4d3a0"
  outline-backing: "#102335b0"
  outline-text: "#fff0d8"
  active-backing: "#315454"
  active-text: "#fff0c6"
typography:
  display:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "43px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-.02em"
  wordmark:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "46px"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-.035em"
  body:
    fontFamily: "Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.7
  label:
    fontFamily: "Arial, sans-serif"
    fontSize: "14px"
  reading:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "16px"
    fontWeight: 400
  time:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "12px"
rounded:
  tool: "4px"
  field: "5px"
  select: "6px"
  control: "7px"
  panel: "12px"
spacing:
  compact: "8px"
  small: "12px"
  group: "17px"
  row: "22px"
  wide: "24px"
  desktop-inset: "38px"
components:
  button-outline:
    backgroundColor: "{colors.outline-backing}"
    textColor: "{colors.outline-text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-outline-hover:
    backgroundColor: "#284657df"
    textColor: "#fff9ec"
  button-text:
    textColor: "{colors.quiet}"
    typography: "{typography.label}"
    padding: "9px 2px"
  scene-select:
    backgroundColor: "#061528b8"
    textColor: "#fff2e3"
    rounded: "{rounded.select}"
    padding: "9px 29px 9px 12px"
  tool-selected:
    backgroundColor: "{colors.active-backing}"
    textColor: "{colors.active-text}"
    typography: "{typography.label}"
    rounded: "{rounded.tool}"
    padding: "9px 16px"
  seed-input:
    backgroundColor: "#091f2a"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "12px"
    width: "100%"
  specimen-panel:
    backgroundColor: "#0e2937f5"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "18px 19px"
    width: "235px"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "30px 34px"
---

# Design System: Motes

## Overview

**Creative North Star: "The Living Painting"**

Motes is a richly illustrated place to settle into. Saturated light, inhabited scenery and atmospheric distance carry its cosy, lofi character. The two current settings are a rainy neon rooftop refuge and a sunlit fantasy meadow. The user's image references establish this expressive, painted treatment; the page should feel restful without becoming visually empty.

The artwork fills the viewport. Small cream controls sit around its edges, allowing the scenery and the communities of light in its water to remain the focus. Explore reveals those same communities within the same painting. The interface supports curiosity while keeping the setting present.

**Key Characteristics:**

- Original environment illustrations with local layers of moving water, weather and living light.
- Rich scene colour, warm cream typography and restrained dark teal controls.
- A quiet watching surface that reveals deeper instruments through Explore.
- Restful motion and deliberate, optional sound.

This document records the implemented system in `src/tidepool/style.css`, `sanctuary.ts`, `sanctuary-space.ts` and `audio.ts`. The original artwork and exact generation prompts are recorded in [public/scenes/ARTWORK.md](public/scenes/ARTWORK.md).

## Colors

The scenery owns the rich colour; the interface uses warm light against deep teal and navy.

### Primary

- **Lantern gold** (`gold`): the wordmark dot, visible keyboard focus, range thumbs, links and most pressed states.
- **Warm cream** (`text`): the primary interface text. Specific scene captions use nearby cream tints already defined in the stylesheet.

### Secondary

- **Deep teal** (`panel`): dialog surfaces and select options.
- **Selected teal and pale gold** (`active-backing`, `active-text`): the active exploration tool. Selection must remain visible without borrowing the scenery's neon palette.

### Neutral

- **Night ink** (`ink`): the page foundation while artwork loads.
- **Mist** (`quiet`): secondary controls, labels and readings.
- **Waterline** (`line`): translucent borders and separators.
- **Shelter backing and cream** (`outline-backing`, `outline-text`): outline actions that remain readable over the painting.

**The Scenery Rule.** Keep the interface palette steady across settings. Rain uses cyan, blue and pink scenery; the meadow uses gold and forest teal. Scene-specific top and bottom scrims protect the same cream controls.

Canvas lights use four lineage colours per setting. Energy and connection lenses add purposeful highlights to expose model state; these are analytical marks, not new interface accents.

## Typography

**Display Font:** EB Garamond, with Georgia and serif fallbacks.
**Body Font:** Arial, with a sans-serif fallback.
**Label/Mono Font:** IBM Plex Mono, with a monospace fallback.

Garamond supplies a warm, literary voice. Plain sans-serif controls remain compact and familiar; monospaced readings distinguish measurements from the atmosphere. Web fonts are requested in the page head, with usable local fallbacks.

### Hierarchy

- **Display:** the scene title uses the frontmatter display role; it becomes 35px on narrow screens and 30px on short viewports.
- **Wordmark:** the compact lower-case name uses the wordmark role; it becomes 40px on narrow screens.
- **Panel titles:** serif headings, normally 32–33px; smaller specimen and dialog headings become 29px on phones.
- **Body:** dialog prose uses the body role. Scene subtitles use 16px/1.5, becoming 14px on phones.
- **Label:** most actions and form controls use the label role. Weather and secondary controls may use 12–13px.
- **Reading:** specimen values use the reading role. Time and speed use the smaller time role; time has tabular numerals.
- **Aside voice:** identity captions, observations and guide introductions use italic Garamond.

**The Quiet Type Rule.** Reserve the expressive serif for names, scene captions and observations. Keep controls and numbers easy to scan.

## Layout

One full-viewport canvas sits beneath an HTML interface. The experience uses dynamic viewport height, a minimum height of 360px and clipped overflow. There is no scrolling landing-page stack.

On desktop, the header uses three columns: identity left, scenery centred and listening controls right. Its outer inset is 38px. The scene title and transport sit at the lower edge. Transparent regions of the footer pass pointer input through to the water.

Explore replaces the scene caption with observation, timeline and tool controls. Habitat controls appear below the wordmark; an inspector appears toward the upper right and view controls sit above the footer. The tools use one horizontal row where space permits. The guide and seed entry use native dialogs.

Responsive changes are deliberate:

- At 1150px and below, the identity caption disappears and outer horizontal insets narrow to 26px.
- At 850px and below, the volume slider disappears; Explore also hides the weather and hide-controls actions.
- At 700px and below, the header wraps, scenery occupies its own row in Watch, and the wordmark and Listen remain opposite one another. Explore hides the scenery selector, wraps tools, and moves the compact inspector to the left. Insets are approximately 22–23px.
- At 600px height and below, the scene caption and lower padding contract.

The artwork covers the viewport with a scene-specific horizontal anchor: 0.43 for rain and 0.60 for meadow. Explore pans and zooms the painting and projected cells together. Camera offsets are bounded so no empty canvas appears at an image edge.

## Elevation & Depth

Depth comes primarily from the illustration: foreground shelter or foliage, reflective water and a distant city or mountain horizon. Interface depth uses local dark backings, translucent borders and protective gradients. It does not use a raised-card shadow system.

Text over the painting receives small dark shadows. The scene title uses a broad soft shadow (`0 2px 15px #061222`); header captions and actions use smaller shadows. Dialogs use an opaque teal surface and a dark translucent backdrop. The specimen panel is nearly opaque so small readings stay legible.

**The Readable Shelter Rule.** Keep a local dark backing or scrim behind controls wherever the painting can become bright. Preserve visible gold focus outlines.

## Shapes

Controls have gently rounded rectangular edges. Tool segments are the tightest; inputs and selects are slightly softer; action groups use the control radius; inspectors and dialogs use the panel radius. Thin translucent strokes define groups without heavy frames.

Icons are small outline SVGs with rounded line ends. Range controls use a thin track and a circular thumb. Canvas cells are luminous points with soft halos; selected communities and interventions use projected rings. The painted shoreline remains irregular.

## Components

### Outline and text actions

Outline actions such as Explore, Branch and Follow have a translucent dark backing, thin pale border and compact padding. Hover lightens the backing. Text actions omit the box and use the quiet text role; hover raises their contrast.

Interactive controls use a visible 2px gold focus outline with a 4px offset. Disabled buttons reduce opacity. Most pressed buttons become gold; the tool group and weather control use their specific selected treatments.

### Scenery and analytical selects

The scenery selector uses Garamond at 19px, or 18px on phones, with a small down-chevron and a dark translucent backing. Analytical selects use compact sans-serif or monospaced text. Options retain the solid panel background.

### Transport and sound

Play, weather, quiet mode and Explore form the sparse Watch transport. Explore adds speed, time, rewind and branching. Listen is a labelled outline speaker icon; sound starts only after the user's action. Volume uses a thin track and small gold thumb.

The audio texture combines up to five mellow colony voices, soft pulse notes, restrained echo and a filtered rain or breeze bed. Pause and hidden tabs fade sound; weather may be disabled separately. Audio-start failure appears beside Listen in Watch and clears on retry.

### Exploration tools and inspector

Observe, Nourish, Current and Sever share a lightly bordered segmented group. The selected segment has a teal fill and pale gold text. The lenses and file actions stay beside the group when space allows and wrap on phones.

The inspector is a small dark panel with a serif community name, three monospaced readings, an italic observation and a full-width Follow action. Community colour may tint the name. Selection can also be made through a labelled native selector.

### Dialogs and fields

The field guide and seed form share the solid teal dialog surface, restrained border and rounded corners. The guide uses serif headings, readable sans-serif prose and compact keyboard keycaps. Seed input uses monospaced text, a dark fill and a gold caret. Dialog content scrolls internally when necessary.

### The living painting

A single Canvas 2D renderer draws the original illustration, shoreline-masked water displacement, model-driven lights and optional weather. Rain adds fine falling lines and small splashes; the meadow adds drifting pollen and tiny butterflies. Motion uses simulation time, so pause and replay preserve the picture. The renderer never consumes simulation randomness.

Explore adds real bonds, energy, food fields and submerged-shelf outlines over the same painted water. Those overlays explain the model; the scenery is an expressive setting rather than a geometric map of the ecology.

Reduced motion starts paused and disables interface transitions and follow-camera easing. Hide controls leaves the scene with a small Show controls action. Artwork failure retains the lights and controls and presents Retry artwork.

## Do's and Don'ts

### Do:

- **Do** keep the painting visible and dominant in Watch and Explore.
- **Do** use the established cream, teal and gold interface roles across both settings.
- **Do** project living lights, selections and interventions through the same space as the painted water.
- **Do** use model time for visual movement and preserve pause, replay and reduced-motion behaviour.
- **Do** keep sound opt-in and provide visible recovery when artwork or audio cannot start.
- **Do** check desktop and phone crops together with readable controls.

### Don't:

- **Don't** restore the retired toy diorama, pixel world, alternate renderer or development-journal interface.
- **Don't** replace the painted aesthetic with photorealistic materials or generic miniature game assets.
- **Don't** introduce camera orbit, entrance delays or restless interface animation.
- **Don't** turn colony readings into decorative or fabricated data.
- **Don't** let interface decoration compete with the illustrated environment.
