# Motes visual and sound system

## Direction

A cosy, lofi game-like pond to watch and listen to. Rounded creatures, painted dusk water, mossy banks and a warm waterside nook. The user’s cosy/lofi direction and explicit freedom to use 3D supersede the earlier realistic cellular concept and initial flat pixel renderer. Their subsequent graphics feedback calls for a visibly illustrated finish: softened pixels, pigment texture and warm light. Keep cellular construction legible without making the bodies look like plastic beads.

## Composition

The world fills the viewport immediately, seen through a fixed elevated orthographic camera. A small serif wordmark, habitat choice and sound sit at the top. Quiet transport stays below. Explore discloses the experiment tools and history. Selecting a body reveals a compact reading; Follow brings the camera closer. On a phone, the initial view frames the lantern bank and nearby creatures; tools wrap when opened. Avoid a dashboard or promotional landing-page layout.

## Material and colour

Dusk water with plum shadows, matching instruments (#303149), mossy banks (#8ba783) and warm cream text (#f1e8d7). Rounded controls use restrained gold (#f1d39b) and soft green. Mallow is butter yellow (#ffdc9d), Clover pale green (#b7e7b1), Ember rose (#f4b3ba) and Pip lavender (#c3c6ef), lit through a muted filmic colour transform. Bevelled bodies have shallow cellular freckles and tiny blinking eyes; the energy and bond lenses make individual cells more prominent. Captions, habitat controls and creature selectors receive dark local backing so terrain cannot erase their contrast.

All creature positions, outlines, pulses and resource fields come from the model. Three.js renders pigment-mottled procedural meshes with an elevated orthographic camera and a cached environment shadow map. A separate scene target uses 67% of the CSS width, bounded to 240–864 pixels. Nearest-neighbour sampling, fixed grain, restrained colour quantisation and warm halation give it a printed, lofi finish. Tone mapping and display colour conversion happen once, in the final pass. The DOM stays crisp at native resolution; analytical lenses reduce grain and glow.

Procedural banks use the same obstacle ellipses as physics, with slightly irregular, inset edges. Trees, mushrooms, flowers, ornamental lily pads, a shingled cabin and lantern jetty give them a friendly game-world character. Water carries sparse, short brush-like ripples and an amber reflection below the jetty. No photographic textures, model downloads or generated concept art appear in the running world. The earlier softly pixelated Canvas renderer remains the WebGL-unavailable fallback.

## Type and interaction

EB Garamond gives the world a warm literary voice. Simple sans-serif controls and IBM Plex Mono readings remain legible. Visible focus, semantic controls, a creature selector, full icon labels, keyboard tools and live status support different ways of interacting. Keep chrome compact and subordinate to the pond.

## Motion and sound

Creature motion comes from the fixed-step simulation. Body skins update with every model step; paused, imported and replayed moments have the same appearance. Water patterns, fireflies and blinks also use model time. Pigment is anchored to world positions; screen grain is fixed, never flickering static. The optional follow camera eases toward a selected body. Reduced-motion preference starts paused and disables easing; the viewer may deliberately play. No entrance delays, forced camera orbit or decorative interface animation.

Listen enables mellow sine/triangle colony voices with softened filters, restrained echo and electric-piano-like notes arriving on actual cell pulses. Energy shapes volume, coherence opens the filter and horizontal position sets stereo placement. Five sustained voices bound the texture. The sound should feel like a small pond humming to itself, with no compulsory beat or sudden notification noises.

## Quality bar

The world dominates on desktop and phone. Creatures read as friendly assembled bodies. The first view is calm; controls remain readable over every bank. Watching requires no interaction, listening requires one deliberate click, and Explore reveals real causal depth. Prefer warmth and clear consequences over cinematic realism.
