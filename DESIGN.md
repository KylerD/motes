# Motes visual and sound system

## Direction

A cosy game-like pond to watch and listen to. Rounded clay-like creatures, dusk water, layered grassy banks and a warm waterside nook. The user’s cosy/lofi direction and explicit freedom to use 3D supersede the earlier realistic cellular concept and initial flat pixel renderer. Keep visible cellular construction: it gives the creatures their identity and explains the simulation.

## Composition

The world fills the viewport immediately, seen through a fixed elevated orthographic camera. A small serif wordmark, habitat choice and sound sit at the top. Quiet transport stays below. Explore discloses the experiment tools and history. Selecting a body reveals a compact reading; Follow brings the camera closer. On a phone, the initial view frames the lantern bank and nearby creatures; tools wrap when opened. Avoid a dashboard or promotional landing-page layout.

## Material and colour

Dusk-blue shader water, navy instruments (#29394d), sage banks and warm cream text (#f1e8cd). Rounded controls use restrained gold (#f1d39b) and soft green. Mallow is butter yellow (#ffdc9d), Clover pale green (#b7e7b1), Ember rose (#f4b3ba) and Pip lavender (#c3c6ef), lit through a muted filmic colour transform. Bevelled bodies, raised cellular beads and tiny blinking eyes make assembled creatures readable. Captions, habitat controls and creature selectors receive dark local backing so terrain cannot erase their contrast.

All creature positions, outlines, pulses and resource fields come from the model. Three.js renders matte procedural meshes with an elevated orthographic camera, a restrained patterned-water shader and a cached environment shadow map. The pixel ratio is capped at 1.5 and 1,800 horizontal pixels. Procedural banks use the same obstacle ellipses as physics; trees, mushrooms, flowers, a cabin and lantern jetty give them a friendly game-world character. No photographic textures, model downloads or generated concept art appear in the running world. The earlier softly pixelated Canvas renderer remains the WebGL-unavailable fallback.

## Type and interaction

EB Garamond gives the world a warm literary voice. Simple sans-serif controls and IBM Plex Mono readings remain legible. Visible focus, semantic controls, a creature selector, full icon labels, keyboard tools and live status support different ways of interacting. Keep chrome compact and subordinate to the pond.

## Motion and sound

Creature motion comes from the fixed-step simulation. Body skins update with every model step; paused, imported and replayed moments have the same appearance. Water patterns, fireflies and blinks also use model time. The optional follow camera eases toward a selected body. Reduced-motion preference starts paused and disables easing; the viewer may deliberately play. No entrance delays, forced camera orbit or decorative interface animation.

Listen enables mellow sine/triangle colony voices with softened filters, restrained echo and electric-piano-like notes arriving on actual cell pulses. Energy shapes volume, coherence opens the filter and horizontal position sets stereo placement. Five sustained voices bound the texture. The sound should feel like a small pond humming to itself, with no compulsory beat or sudden notification noises.

## Quality bar

The world dominates on desktop and phone. Creatures read as friendly assembled bodies. The first view is calm; controls remain readable over every bank. Watching requires no interaction, listening requires one deliberate click, and Explore reveals real causal depth. Prefer warmth and clear consequences over cinematic realism.
