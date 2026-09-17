# Motes development

The application is a living illustration entered through `index.html`, implemented in `src/tidepool/`. Read README.md, PRODUCT.md and DESIGN.md for the current product and visual system.

Use the two original sanctuary paintings with the unified Canvas 2D renderer. Explore reveals real cells, connections and energy inside the same artwork. Do not reintroduce the superseded pixel world, toy diorama, alternate renderer, journal or daily-evolution workflow.

Keep the model deterministic, render from real state without consuming simulation randomness, validate imported experiments before replacing state, and keep audio opt-in. Art, camera and cell picking share one projection. All visual motion follows simulation time. Preserve comfortable watching as the default and reveal instruments through Explore.

Run `npm test`, `npm run build`, and the relevant browser scripts after changes. Test failed artwork/retry, both scene crops, pause, history and mobile input when touching those flows. Original paintings and exact generation prompts live in `public/scenes/`.

There is no backend, account, API key or scheduled development requirement.
