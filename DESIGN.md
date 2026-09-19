---
name: Motes
description: Living paintings and warm, jazzy lofi; somewhere to slow down.
colors:
  ink: "#0b1d2b"
  panel: "#102a37"
  text: "#fff1df"
  muted: "#ccd8d7"
  gold: "#f4d3a0"
  line: "#9db2b348"
  listen-surface: "#fff0d9"
  listen-ink: "#142938"
  listen-hover: "#ffdfac"
  panel-surface: "#0f2836fa"
  field-surface: "#193642"
  scenes-surface: "#112c3cad"
  control-hover: "#2b4550"
typography:
  wordmark:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "47px"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-.035em"
  display:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "clamp(36px, 3.4vw, 51px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.02em"
  title:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "29px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.02em"
  track:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.25
  body:
    fontFamily: "Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
rounded:
  field: "4px"
  control: "6px"
  panel: "12px"
spacing:
  desktop-inset: "38px"
  phone-inset: "23px"
  panel: "25px"
  phone-panel: "22px"
components:
  button-listen:
    backgroundColor: "{colors.listen-surface}"
    textColor: "{colors.listen-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 20px 0 15px"
    height: "48px"
  button-listen-hover:
    backgroundColor: "{colors.listen-hover}"
  button-text:
    textColor: "{colors.text}"
    padding: "8px 4px"
  button-scenes:
    backgroundColor: "{colors.scenes-surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 16px 0 19px"
  panel:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  date-input:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "10px"
    width: "100%"
---

# Design System: Motes

## Overview

**Creative North Star: "The Living Painting"**

Motes is an illustrated place to settle into with warm, jazzy lofi. Saturated scenery, soft environmental movement and a small radio player share the screen. Cream serif captions feel conversational; the surrounding controls stay quiet and useful.

Four authored paintings establish the world: Neon rain, Golden hour, Last light station and The last chapter. Daily editions change the chosen place, atmosphere and musical arrangement. They do not create a new painting each day.

**Key Characteristics:**

- Full-viewport paintings with moving water, weather, light and small distant events.
- Warm cream typography and restrained navy/teal controls across all four places.
- Opt-in music, independent scene motion and a view with controls hidden.

Source of truth: `index.html`, `src/style.css`, `src/main.ts` and `src/scenes/`. Artwork provenance lives in `public/scenes/ARTWORK.md`.

## Colors

The paintings carry the saturated colour. Interface colours remain steady across scenes.

- **Primary:** lantern `gold` marks focus, hover text, the wordmark dot, range thumbs and the selected scene check. The warm `listen-surface` makes playback the clearest action.
- **Neutral:** `text` is warm cream; `muted` supports explanations and secondary labels. `ink` backs the page; `panel` supports fallback surfaces. Near-opaque `panel-surface` keeps settings readable, and `line` supplies quiet separators.
- **Control surfaces:** `field-surface` supports native inputs, while translucent `scenes-surface` lets the painting remain present around scene navigation. `control-hover` and `listen-hover` provide immediate feedback.

## Typography

EB Garamond with Georgia fallback gives the wordmark, scene captions, panel headings, track names and place names their soft literary character. Arial carries functional labels. No monospaced readings or numerical display treatment is used beyond tabular slider percentages.

The frontmatter records the desktop hierarchy. Scene subtitles are 15px; panel prose is 13px with 1.65 line height. Place names use 23px/1.15 serif. The tagline is italic 17px/1; atmosphere copy is italic 18px/1.2. Track details use 11px with .02em spacing. Preserve sentence case and short lines; track names truncate on one line.

## Layout

The painting occupies `100dvh` with a 400px minimum height and clipped overflow. The masthead sits at the top; the caption sits 134px above the bottom. Desktop chrome uses the desktop inset. The radio runs along the bottom, with listening controls left and atmosphere/place navigation right. Mix is 354px wide at bottom-left; places is 388px at bottom-right; editions is 360px wide at top-right. Only one panel opens at a time.

At 1120px and below, the tagline and atmosphere copy disappear. At 700px and below, minimum height becomes 440px, the player becomes two rows with a 21px gap, atmosphere copy returns, and the caption sits 174px above the bottom. The wordmark becomes 40px, scene title 36px, track title 19px and panel heading 27px. Mix becomes an icon; fullscreen and the calendar icon are hidden. Listen becomes 43px high. Mix/places panels span between 18px side insets, 163px above the bottom, with phone panel padding.

Panels scroll internally and are capped at viewport height minus 125px on desktop or 120px on phone. On short desktop views (height at most 600px, width at least 701px), the caption moves to 112px, its title becomes 35px, and panels sit 20px above the bottom with a height cap of viewport minus 45px.

Paintings use a cover crop with vertical centring. Horizontal anchors are .43 for rain and snow, .60 for meadow and .56 for coast. Keep water masks, lights, steam and shoreline interaction aligned to image coordinates through every crop.

## Elevation & Depth

Depth comes from the illustration, translucent controls and dark edge gradients, without card shadows or backdrop blur. The masthead scrim runs from `#03112689` to transparent; the player scrim runs from transparent through `#041529b8` at 55% to `#031225e8`. Text shadows protect the wordmark, actions and captions; exact recipes live in the sidecar.

Layer order is painting, player (1), masthead/caption (2), return-controls (3), panels (5), then status feedback (7). Panels use a fine `#849c9d75` border and a nearly opaque surface, preserving the scene around them.

## Shapes

Controls have gently rounded corners; panels use the larger panel radius. Date fields, selects and scene thumbnails use the field radius. Scene choices are image-and-text rows with fine dividers, not separate cards. Range tracks are 2px high with round 11px thumbs. Most line icons are 21px with 1.5px rounded strokes; the playback icon is filled at rest.

## Components

- **Radio:** Listen changes to Tuning in…, Pause and Resume as appropriate. Its icon and label remain visible through each state. Next track, Mix and a quiet 2px strip showing the hour's progression support playback. Track names use serif type; supporting copy names the instrument and chapter. Both lines truncate on small screens. Before playback, “An hour, unfolding here” introduces the session. Disabled controls use .35 opacity.
- **Mix:** separate Music and Atmosphere sliders, Warm lofi beats/Without drums choices, and Scene motion On/Still. Slider rows use 79px / flexible / 35px columns with 13px gaps. Sound preferences persist locally.
- **Place browser:** four thumbnail rows, brief weather descriptions and a gold check for the selected place. Desktop thumbnails are 91×62px; phone thumbnails are 85×55px. “Take me to today’s place” restores the daily selection.
- **Editions:** a native date input revisits a local calendar day. A quiet new-day invitation appears without interrupting the current session. The current song finishes when changing edition; the next belongs to the new place/date.
- **Motion:** 1600ms scene crossfades, subtle water displacement, slow lighting variation, weather, steam and occasional birds/butterflies remain subordinate to the painting. Water taps create ripples only inside painted shorelines. Motion is independent of audio; Still and reduced-motion preference freeze the scene. Reduced motion also removes CSS transitions. Background tabs stop visual rendering while ordinary audio playback continues.
- **An hour unfolding:** six musical chapters lead gradual, restrained evening grading, changing weather and warm lamps. A small train visits the station during a lull; a boat crosses the distant bay; butterflies and birds pass through the meadow before fireflies emerge; a passing shower deepens the rain. Events are sparse and seeded, with quiet intervals between them. Pause holds this timeline; ordinary water, weather and steam continue. Still freezes both. After hours keeps the evening state and continues softer music. Atmosphere copy follows the chapter, with no new panel or numerical clock.
- **Access and recovery:** 2px gold keyboard outlines with 5px offset; labelled native controls; visible retry feedback. Escape closes panels or restores hidden chrome. Hide controls leaves a small Show controls action. Space toggles playback outside interactive controls. Panels return focus to their trigger when closed normally.

## Do's and Don'ts

- **Do** preserve the illustrated, cosy videogame character and keep every scene beautiful when still.
- **Do** keep controls around the painting, protect legibility with the existing scrims and retain visible keyboard focus.
- **Do** distinguish the four authored paintings from daily atmospheric and musical editions.
- **Don't** reintroduce organisms, names and stats, experiments or an Explore interface.
- **Don't** require music for ambient motion or start audio without a listening action; the hour's progression follows listening.
- **Don't** add dashboard density, realistic rendering or toy-like procedural scenery.
