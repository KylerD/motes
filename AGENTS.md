# Motes development

Read README.md, PRODUCT.md and DESIGN.md. The entry is index.html; implementation is src/main.ts, src/scenes/, src/session/ and src/music/.

Motes is living scenery and warm jazzy lofi radio. Do not reintroduce organisms, names/stats, simulation tools, development journals or daily repository automation. The four original illustrations and music are the product.

Keep the pure composer deterministic and musical: repeated themes, voice-led harmony, arranged sections and restrained performance variation. Piano recordings are local CC0 assets. Never consume scenery randomness from the audio clock. Audio scheduling must continue independently of requestAnimationFrame. Keep samples, scheduled voices and decoded assets bounded. Preserve sample failures/retry and smooth pause/resume.

The session planner writes eighteen arrangements spanning exactly 3,600 seconds. Music uses audible score position; the environmental clock counts actual AudioContext listening time independently of track skips. Pause holds both, normal hidden-tab playback advances both, and entering another edition restarts its environment immediately while the old song finishes. Keep ambient motion available before Listen and let Still freeze visuals independently. After hours must not rewind the evening or replay its events. Instrument changes must preserve the shared groove and calibrated quiet atmosphere; verify every timbre, including sparse passages.

All four places use matched arrival/evening paintings with scene-specific spatial masks and listening-time arcs. Water displacement must sample the current composited painting, never the arrival source alone; the coastal sun and its reflection fade together. Keep just one full-size composite for the active place, update it at most every two scene-seconds, and retain original image coordinates through cover crops. Load each evening state only when its place is visited, reuse decoded images on return, and preserve the original painting with visible retry if evening loading fails. Late image callbacks must prepare only the current place. Procedural evening grades are a fallback when authored light is unavailable.

Daily editions use validated local dates; no surprise scene or song interruption at midnight. Keep ordinary daily URLs unpinned and explicit scene choices shareable. Reduced motion affects scenery independently of listening. All controls need visible focus, useful labels and readable contrast over the art.

Use the original SVG identity in public/brand/ and local licensed fonts in public/fonts/. Preserve the warm brown player, amber listening action and cream panels described in DESIGN.md. Sound & motion and Find a place remain labelled on phones; keep short-screen panels scrollable and return keyboard focus to their trigger on close.

Run npm test, npm run build and relevant browser scripts. Check desktop and phone together. Audio work also needs a rendered PCM preview and lifecycle checks. Original art prompts and audio provenance live alongside local assets.
