---
name: Motes
description: Living paintings and warm, jazzy lofi; your quiet corner of the world.
colors:
  ink: "#302721"
  ink-deep: "#211e1b"
  ink-soft: "#493b30"
  cream: "#fff1da"
  muted: "#d2c2af"
  amber: "#eab574"
  amber-hover: "#f3c991"
  paper: "#f7efdf"
  paper-hover: "#eadecb"
  paper-text: "#40332a"
  paper-muted: "#705b4b"
  line: "#fff1da26"
  paper-line: "#d8c9b5"
  control: "#ffffff0d"
  radio-surface: "#302721f5"
  header-surface: "#302721df"
  field-surface: "#fff9ef"
  slider: "#9b633b"
  panel-focus: "#956038"
  panel-link: "#81522e"
typography:
  display:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "clamp(38px, 3.5vw, 54px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-.025em"
  title:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-.025em"
  track:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.2
  place:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "23px"
    fontWeight: 500
    lineHeight: 1.12
  body:
    fontFamily: "'Nunito Sans', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  panel-body:
    fontFamily: "'Nunito Sans', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.6
  label:
    fontFamily: "'Nunito Sans', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  thumbnail: "7px"
  field: "8px"
  control: "9px"
  primary: "10px"
  panel: "16px"
spacing:
  desktop-inset: "32px"
  tablet-inset: "24px"
  phone-inset: "18px"
  panel: "27px"
  phone-panel: "24px"
  narrow-panel: "20px"
components:
  button-listen:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.primary}"
    padding: "0 20px 0 17px"
    height: "54px"
  button-listen-hover:
    backgroundColor: "{colors.amber-hover}"
  button-text:
    textColor: "{colors.cream}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
  button-scenes:
    backgroundColor: "{colors.control}"
    textColor: "{colors.cream}"
    rounded: "{rounded.primary}"
    padding: "0 16px"
    height: "48px"
  radio:
    backgroundColor: "{colors.radio-surface}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "17px 20px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  date-input:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    width: "100%"
---

# Design System: Motes

## Overview

**Creative North Star: "A Quiet Place"**

Motes is an illustrated place to settle into with warm, jazzy lofi. A shelter holding an amber mote welcomes the listener; a toasted-brown radio and cream settings make the interface feel familiar and comfortable. The paintings remain the focus.

Four authored places establish the world: Neon rain, Golden hour, Last light station and The last chapter. Golden hour has matched daytime and dusk paintings; the other three places retain their subtler lighting treatment. Daily editions change the chosen place, atmosphere and musical arrangement. They do not create a new painting each day.

**Key Characteristics:**

- Full-viewport paintings with moving water, weather, light and small distant events.
- An original shelter-and-mote logo, warm brown radio, amber playback and cream settings.
- Clear labelled controls on desktop and phone, opt-in music and independent scene motion.

Source of truth: `index.html`, `src/style.css`, `src/main.ts` and `src/scenes/`. Brand masters and provenance live in `public/brand/`; local font licenses in `public/fonts/`; original painting prompts in `public/scenes/ARTWORK.md`.

## Colors

The paintings carry the saturated colour. The interface retains one warm palette across all four places.

- **Amber** makes Listen the clearest action and colours the mote, keyboard focus and active playback indicator. Its lighter hover tone provides immediate feedback.
- **Toasted brown** grounds the radio and header actions. Cream supplies primary text; warm muted text supports track details and atmosphere descriptions.
- **Cream paper** gives settings an opaque, readable surface. Brown text, darker secondary text and warm separators establish hierarchy. The selected place uses the deeper paper tone with a brown check.
- **Controls** use warm field surfaces, bronze sliders and brown focus outlines inside panels. Secondary text on the selected-place surface has a measured contrast of 4.81:1; on the main panel, 5.59:1.

The frontmatter owns the reusable palette. Exact one-off scrims, borders and shadow recipes remain in CSS and the sidecar. Avoid taking interface colours from individual paintings: navigation should stay familiar when the scene changes.

## Typography

**Display:** locally bundled EB Garamond, with Georgia fallback. **Body and controls:** locally bundled Nunito Sans, with Arial fallback. Both use `font-display: swap`; there are no runtime font-service requests.

The original lowercase logo is path artwork, not font-rendered text. Its `486 × 114` aspect ratio must remain intact. The header displays it at 192px wide on desktop, 158px on phones and 132px at the narrowest breakpoint. The independent shelter symbol and favicon use the same ivory and amber geometry.

Serif captions, panel headings, track names and place names sit alongside rounded, legible functional labels. The frontmatter records the desktop hierarchy. Subtitles use 14px; the tagline and track detail use 12px; scene-choice descriptions use 11px. Panel headings balance their lines. Track names truncate on one line, while mobile track details also ellipsize. Slider percentages use tabular numerals. Preserve sentence case and short, welcoming copy.

## Layout

The painting occupies `100dvh`, with a 400px minimum height and clipped overflow. The masthead anchors the logo left and date/view actions right. A caption sits 156px above the bottom. The radio is inset from the page edges, 24px above the bottom, with playback left and Sound & motion / Find a place right. Its desktop layout is one row, with a 2px session-progress strip along its bottom edge.

Only one settings panel opens at a time. Sound & motion is 382px wide at bottom-left; places is 422px wide at bottom-right; both sit 132px above the bottom. Editions is 366px wide at top-right, 98px from the top. Panels scroll internally, with a desktop height cap of viewport minus 180px.

Responsive behavior follows the actual CSS breakpoints:

- **1250px:** the atmosphere description disappears and the radio gap tightens.
- **850px:** side insets become 24px; player padding and control gaps compact; the place-button symbol disappears while its text remains.
- **700px:** insets become 18px and the experience minimum height becomes 480px. The radio becomes two rows, 18px above the bottom, with a divider between playback and navigation. Both Sound & motion and Find a place keep visible labels. Listen is 50px high; track titles are 18px. The caption sits 207px above the bottom, with a 38px title. The short date is visible while the full date remains available to assistive technology; fullscreen and the text beside Hide controls disappear. Panel headings become 30px. Sound/place panels span the side insets, 185px above the bottom, with height capped at viewport minus 286px. Editions starts at 99px with a separate viewport-minus-135px cap.
- **360px:** the logo, panel padding, slider columns and player controls compact further; settings continue scrolling internally.
- **Short landscape, at most 600px high and at least 701px wide:** the logo becomes 165px and the tagline disappears. The caption sits 136px above the bottom, with a 36px title. Panels sit 20px above the bottom, capped at viewport minus 40px.

Paintings use a cover crop with vertical centring. Horizontal anchors are .43 for rain and snow, .60 for meadow and .56 for coast. Keep water masks, lights, steam and shoreline interaction aligned to image coordinates through every crop.

## Elevation & Depth

The illustrated world supplies most of the depth. Warm edge scrims protect text; the near-opaque radio and fully opaque cream panels create steady reading surfaces. Soft offset shadows lift the radio and open settings. No decorative backdrop blur is used.

The radio shadow is `0 12px 40px #110e0b40`; panels use `0 18px 60px #110e0b59`. The logo has a subtle dark drop shadow; captions use a broad text shadow. Layer order is painting, masthead/caption (2), player/return-controls (3), panels (5), then status feedback (7). Panels use shadow rather than a surrounding border.

## Shapes

The shelter arch and amber mote are the signature geometry. Controls have gentle corners; panels and the radio use the larger panel radius. Date/select fields and thumbnails use the smaller field and thumbnail radii. Place choices are image-and-text rows, with a selected background and check, rather than a collection of separate cards.

Most line icons are 21px with 1.65px rounded strokes. The playback icon is filled at rest and becomes stroked pause bars while playing. Range tracks are 4px high with an 18px circular WebKit thumb; the motion switch uses a 36×22px track and 16px thumb moving 14px. Preserve native labelled inputs beneath their styling.

## Components

- **Identity:** use `motes-logo.svg` as an image with the accessible name Motes. The tagline is “your quiet corner of the world.” Use the independent symbol for small contexts and the warm-brown favicon tile for browser tabs. Do not recreate the logo using a font.
- **Radio:** the amber Listen action becomes Tuning in…, Pause or Resume as appropriate. Next track remains beside the title and instrument/chapter detail. A small amber dot signals playback. The quiet progress strip represents the hour and uses `scaleX` with a left transform origin, avoiding layout animation. Reduced motion removes its transition. Disabled controls use .4 opacity.
- **Sound & motion:** “Make yourself at home.” introduces independent Music and Scene sounds sliders, Warm lofi beats / Without drums, and Scene motion On / Still. Slider fill tracks the saved values immediately. The motion switch has a visible text state and `aria-pressed`. Preferences persist locally. The panel note explains that music continues when switching tabs.
- **Place browser:** “Find your quiet.” leads four thumbnail rows and a quiet daily-place action. Desktop thumbnails are 94×67px; phone thumbnails are 84×60px. Names stay prominent, secondary descriptions remain readable and the selected row has both a background and a check.
- **Editions:** a labelled native date input revisits a local calendar day. The date action uses a short display on phones without losing its accessible full date. A new-day invitation does not interrupt the current scene or song. Arriving in a new place/date resets its environment immediately; the current song finishes before the next belongs to the new place/date.
- **Focus and recovery:** 2px amber keyboard outlines with 4px offset; inside cream panels, brown outlines with 3px offset. Native date/select fields use a light colour scheme. Selection, caret and scrollbars follow the palette. Escape closes panels and restores trigger focus, or restores hidden controls. Space toggles playback outside interactive controls. Just the scene leaves a small Show controls action. Asset and audio failures remain visible and retryable.
- **UI motion:** panels arrive from a 6px offset while already partly visible, over 240ms with `cubic-bezier(.16,1,.3,1)`. Button colour transitions are restrained. Reduced motion removes CSS animations and transitions.
- **Living scene:** 1600ms scene crossfades, subtle water displacement, slow lighting changes, weather and steam remain subordinate to the painting. Water taps create ripples only inside painted shorelines. Still and reduced-motion preference freeze the scene independently of music. Background tabs stop visual rendering while ordinary audio playback continues.
- **An hour unfolding:** eighteen arrangements and six musical chapters shape the score. An independent environment clock advances with listening time, controlling evening light, weather and sparse seeded events. Next changes the score without advancing the environment. Pause holds both clocks while ordinary ambient motion continues; Still freezes the picture while audio and environment time continue. A train visits the station, a boat crosses the distant bay, butterflies and birds pass through the meadow before fireflies emerge, and a passing shower deepens the rain. After hours preserves the evening and continues softer music without restarting the events.
- **Meadow evening:** `golden-hour.png` and the composition-matched `golden-hour-dusk.png` move from afternoon to dusk over about 50 minutes of environment time. Painted sky, distance, clearing and water transition at separate rates, with lantern light and fireflies arriving later. A cached composite updates every two seconds; water reflections sample that same composite. If the dusk painting fails to load, the daytime painting remains visible with a retry action. Preserve both paintings' provenance in `public/scenes/ARTWORK.md`.

## Do's and Don'ts

- **Do** keep the illustrated, cosy videogame character and make every scene beautiful when still.
- **Do** preserve the original shelter-and-mote identity, warm brown radio, amber listening action and cream settings.
- **Do** retain visible action labels on phones, readable contrast and useful keyboard focus.
- **Do** distinguish the four authored places, including the meadow's matched day/dusk paintings, from their daily atmospheric and musical editions.
- **Don't** reintroduce organisms, names/stats, experiments, an Explore interface or dashboard density.
- **Don't** start sound without a listening action or make ambient scene motion depend on music.
- **Don't** replace the paintings with realistic rendering or toy-like procedural scenery.
