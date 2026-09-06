# Storybook pond implementation

The user explicitly removed the 2D and dependency constraints and delegated the choice. Use Three.js to make a cosy 3D diorama while preserving the existing causal model and quiet listening experience. Full autonomy covers implementation and local integration.

Three.js gives this small browser artwork the scene graph, instancing, lighting and projection it needs without bringing an editor or separate game build into the repository. A full game engine adds little to this particular interaction model. A shaded 2D renderer would retain the flat composition that this change is intended to improve.

- [x] Add Three.js and typed renderer boundary. Retain Canvas as an automatic WebGL-unavailable fallback.
- [x] Create an orthographic storybook garden: layered banks, trees, mushrooms, lanterns, a tiny waterside cabin and restrained patterned water. Geometry is procedural; trees and the cabin sit on the physical islands, with a small decorative jetty extending over the water.
- [x] Render true simulated cells, deforming colony bodies, expressive eyes, energy and bond lenses, nutrients and current rings in 3D. Keep simulation randomness and replay untouched.
- [x] Make picking, cursor-anchored zoom and panning projection-aware. Verify projection round trips and browser interventions.
- [x] Check desktop and phone together, shaders and console, context restoration, fallback, resource disposal and bounded performance. Fix material issues in one batch and confirm.
- [x] Update product/design documentation to remove obsolete restrictions, run maintained tests and production build, commit and merge locally, then serve the new version in the existing preview.

Quality bar: a miniature game world with tangible soft creatures, inviting places at the edge of the water and enough visual depth to reward close watching. No photorealism, forced camera orbit, splash screen or model downloads. Sound remains opt-in and driven by the simulation.

## Verification, 6 September 2026

57 maintained tests in 9 files pass, including projection round trips across desktop/mobile sizes and zoom limits. TypeScript and the production build pass. Desktop (1440×960) and phone (390×844) browser flows pass with no page errors; final views were inspected together after one batch of visual fixes. The Three.js bundle brings the new entry to about 163 KB gzip.

The graphics regression script reproduced and then verified the independent review findings: skins now update on every simulation step, and picking uses the real elevated cell projection. Importing the same snapshot produces identical pixels. Eight alternating habitat resets leave allocated geometry count unchanged at 42. Forced WebGL context loss pauses the simulation and recovers it; a forced WebGL-unavailable browser receives a working Canvas fallback. Production cached back navigation, pinch suppression and keyboard intervention pass.

Sampled CPU render submission averages about 2 ms after mixed UI activity; this is not a GPU frame-rate claim. Scene diagnostics expose draw calls, triangles, geometries and textures for further profiling. Static terrain is batched by material and its shadows cached; cells, connections and small particles use instancing. Music, the headless model and the saved-experiment format remain compatible with the prior pond.
