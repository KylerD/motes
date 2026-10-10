# Scene sounds you can place

Written 9 October 2026. Motes is mostly heard, not watched: it sits on a second monitor or behind other windows for hours. The music is composed live, but each place's sound is one 24-second loop of synthesised noise (`startAmbience`, `src/music/sound.ts:172`), the same every hour and flat in the stereo field. This is where Motes can do what a YouTube lofi stream can't: put you in the place, with the rain on the roof above you and the pond in front, and never repeat.

**Success:** with headphones, a listener can point to where the rain, the drips and the city are, and an hour never loops audibly. With speakers it sounds like a better recording of the same place. Atmosphere stays the calibrated quiet bed under the music, CPU stays inside G2, and nothing plays before Listen.

## What a place sounds like

Each place gets a **sound map**: typed data in `src/music/ambience-maps.ts` describing what you'd hear standing where the painting's viewer stands.

- **Beds** are continuous textures. They are either *enveloping* (all round you, played as plain stereo) or *placed* (with a direction).
- **Spots** are short sounds that recur at chosen places.

A position is an azimuth (0° ahead, positive to the right), an elevation and a distance in metres. The engine turns it into Web Audio's frame: the listener sits at the origin facing −z, with +x to the right and +y up (the `AudioListener` defaults). Positions follow the painting, so what you hear is where you see it.

| Place | Beds | Spots | Events (already planned in `session.ts`) |
| --- | --- | --- | --- |
| Neon rain | rain on garden leaves and stone (enveloping); rain on the tea-house roof, ahead-left and above; rain on the pond, ahead-right and below | drips from the eave (ahead-left, 4 m); a gutter trickle (left); the city's hum (far right, low-passed) | the shower raises the rain beds (via `weather`, as today) |
| Last light station | wind over the valley (enveloping, weighted ahead); the hush of falling snow (enveloping) | the station clock (left, 3 m); a lamp's faint hum (left); a far dog or bell, rarely | the train runs in from the far right along the tracks, passes and fades |
| Golden hour | grass and leaves (enveloping); breeze in the big tree (right, above); water lapping (ahead, below) | birdsong in several places; bees by day, crickets as the light goes | birds; butterflies stay silent |
| The last chapter | waves on the shore (ahead, below); the harbour's distant life (right, far) | the curtain in the breeze (left, near); rigging and buoy clinks (right); gulls | gulls with the birds events; the boat's engine follows its path |

**The sound follows the evening.** Each bed and spot family has an arrival level and an evening level, mixed by the same listening-time arc that drives the place's light. So the bees give way to crickets, the harbour quietens and the city hum warms as the evening deepens. After hours, the levels hold at evening and never rewind (CLAUDE.md).

**Randomness comes from the plan.** Spots that aren't events come from a deterministic plan made in `createSession`, beside the events, from the edition's seed. So do the beds' offsets and swap times. Nothing takes randomness from the audio clock (CLAUDE.md). The same place on the same day sounds the same, and tomorrow differs.

## Sources

**CC0 field recordings**, chosen by hand, with provenance in `public/audio/ambience/README.md` (name, recordist, URL, licence, edits), as the piano has. Freesound's CC0 filter is the main source. Synthesis can't match rain on a roof, and the piano already showed that a few honest recordings lift the whole sound.

- **`scripts/encode-ambience.mjs`** (FFmpeg, like the piano's encode) runs every recording through the same steps:
  - trims it;
  - normalises its loudness to one shared target, so the per-place trims start equal;
  - folds a bed's tail into its head, so it loops without a seam;
  - writes mono for placed beds and spots, stereo for enveloping beds;
  - encodes MP3, the format the piano already ships in and every target browser decodes.

  Giving a new place its sound is then: pick recordings, write its sound map, run the script.
- **Size:** beds are 30 s and spots under 4 s.
  - Each place stays under **1.2 MB** compressed.
  - `decodeAudioData` resamples to the context's 48 kHz, so one stereo bed, two mono beds and a dozen spots decode to about 27 MB. The cap is **32 MB for the active place**, plus the outgoing one during a handover; its buffers are released after its fade.
- **Loading:** the recordings load when a place is first played, like its evening painting, and are reused on return. Decoded buffers live on the sound graph, beside the piano bank, not in module state.
- **Never silent:** until a place's recordings arrive, its current synthesised bed plays, and the recordings fade in over it. A failed load leaves the synthesised bed playing; the Sound & motion panel says the recordings didn't load and offers Retry, the same pattern as the piano. A late load never starts sound after a pause or for a place you've left (the piano's stale-load rule).

## Space

- **Headphones:** each placed bed, spot and moving event goes through a `PannerNode` with `panningModel: 'HRTF'`. HRTF makes the position parameters update per block rather than per sample, which is smooth enough for slow movement. The listener is fixed; there is no head tracking.
- **Speakers:** the same positions with `'equalpower'` panning and azimuths pulled a third of the way toward centre, so speakers don't sound hollow.
- **Enveloping beds** use no panner in either mode. They are already all round you, and convolving them would only cost CPU.
- **The panner budget is 8.** A placed bed needs one panner; its two buffer sources share it. Spots take one from a pool of four and give it back when they end, and a spot that finds the pool empty is skipped. Moving events take one. The busiest place, Neon rain, needs two for beds, at most four for spots and one for an event.
- **The control:** a labelled native select in Sound & motion, **Listening on: Speakers / Headphones**. It's the warm field style DESIGN.md gives Music style and Drums, keyboard-accessible and scrollable on short phones. It is remembered in `motes-listening` as `space`, and defaults to Speakers, because browsers can't tell whether headphones are plugged in.

## Never repeating

- **Beds:** each bed plays from two buffer sources at different offsets. Every 20 to 40 s they swap with an equal-power crossfade, and the level drifts slowly (±1.5 dB). Offsets, swap times and drift come from the plan.
- **Spots:** each plays with a small detune (±50 cents) and level variation, also from the plan.
- **Scheduling:** everything runs on the existing look-ahead `setInterval` (2.5 s visible, 6 s hidden), never on `requestAnimationFrame`. Pause and resume behave exactly as ambience does today.
- **Changing place:** entering another place starts its sound map at once, as its environment restarts. The old place's sounds fade out over 0.6 s while its song finishes, as today.

## Mix

- **Quiet:** atmosphere stays at least **18 dB below the music RMS** in `verify-mix`'s opening and theme windows and in a sparse passage (CLAUDE.md asks for sparse passages to be verified), for every place, both styles and drums on or off. The worst case today is 18.2 dB, so each place's trim is recalibrated against the recordings.
- **Spots:** no spot's 400 ms RMS rises above the music RMS minus 10 dB. A drip should never startle.
- **Unchanged:** the Scene sounds slider, `weather` level-following and the compressor chain work as now.

## Events that sound

- **Moving sources:** the train and the boat move their panner along the path the picture draws, as a function of the event's progress in `sessionAt`. The scheduler ramps `positionX/Y/Z` inside each look-ahead window.
- **Birds:** these events trigger spots near where the birds fly.
- **Timing:** events stay on the environment clock, so sound and picture agree. A paused or hidden tab behaves as it does today.

## Clips

`renderPreview` renders the place's beds offline with equal-power panning; clips are for phones and speakers. It reuses the live place's decoded buffers when it has them and otherwise fetches its own on request, never touching the live clocks or preferences (CLAUDE.md). Spots and events stay out of clips, as now. `verify-clip` keeps its true-peak and loudness checks.

## Code

- **`src/music/ambience.ts`:** the loader (with the cap, fallback, retry and stale-load guard), beds, spots, the panner pool and event movement. It owns its sources and panners the way the composer owns voices, so pause, handover and place change free them.
- **`src/music/ambience-maps.ts`:** the four sound maps as typed data.
- **`sound.ts`:** keeps the synthesised bed as the fallback.
- **`audio.ts`:** `enable`, `setEdition` and pause call into `ambience.ts` where they call `startAmbience` today.

## Out of scope

- **The focus bed** (optional pink or brown noise under the music, with no health claims) gets its own spec.
- **Music:** no change to the composer or the music mix.

## Phases

1. **Neon rain, end to end:** its three beds, its drips, gutter and city spots, the shower, the evening arc, Listening on, the encode script, and the loader with fallback and retry. Also the checks below and a rendered PCM preview through speakers and headphones. **Kyle listens before the other places start.**
2. **The other three places'** recordings and sound maps.
3. **Moving event sounds:** the train, the boat and the birds.

## Checks

- **Existing:** `npm test` and `npm run build`.
  - `verify-mix` (lofi and synthwave) with the new margins, the sparse passage and the spot ceiling.
  - `verify-music` lifecycle: no sources or panners left after pause, handover or place change; panners ≤ 8; voices still bounded.
  - `verify-clip`.
  - `npm run score` G2 with Listening on set to Headphones.
- **A new `verify-ambience.mjs`:**
  - nothing before Listen;
  - beds swap without a click (sample-to-sample jumps under a threshold);
  - the synthesised bed plays until the recordings arrive;
  - a failed load falls back and Retry recovers;
  - a stale load after a place switch never plays;
  - decoded bytes stay under the cap;
  - a hidden tab keeps the beds going;
  - after hours the levels hold at evening.
- **Listening:** a rendered PCM preview per place, through speakers and headphones.

## Docs that change with it

- `public/audio/README.md` and the new `public/audio/ambience/README.md` (provenance).
- `made/index.html`: today it says everything but the piano is synthesised. **The new wording is Kyle's call.**
- README and DESIGN.md: Listening on in Sound & motion.
- CLAUDE.md: the ambience rules (the loading cap, the fallback, the plan as the source of randomness, the panner budget).

## For Kyle

1. **Recorded CC0 ambience**, which changes what How Motes is made says about sound (recommended), or improved synthesis only.
2. **Listening on** defaulting to Speakers (recommended), or a one-time question at first Listen. That question would be a nag, against GOAL.md's guardrails.
3. **Listening to scene sounds alone** (music at 0) still doesn't count toward WEL, as now (recommended for this change; revisit with data).

*Web Audio verified via Context7 (`/websites/webaudio_github_io_web-audio-api`):*
- *`PannerNode` `panningModel` `'HRTF' | 'equalpower'`, with `positionX/Y/Z` as `AudioParam`s that HRTF makes k-rate;*
- *the `AudioListener` defaults (forward −z, up +y);*
- *`decodeAudioData` resampling to the context's rate;*
- *`AudioBufferSourceNode.start(when, offset)` with `loop`.*

## Phase 1 as built (10 October 2026)

Branch `feat/scene-sounds`. Kyle asked Claude to make the calls in "For Kyle": recorded CC0 ambience, Listening on defaulting to Speakers, and scene sounds alone still not counting toward WEL. Where the build departs from the spec above:

- **Sources.** The environment's network policy blocks freesound.org, so the three CC0 Freesound recordings come from Ambie's repository (pinned commit, SHA-256 checked), which ships them with their Freesound attributions. One rain recording feeds the garden (two distant stretches, one per ear), the roof (EQ for its body) and the pond's fizz; a brook gives the pond and the gutter; a city park's traffic gives the city. No CC0 drip recording was reachable, so the eave drips are modelled (a bubble model, deterministic, in `encode-ambience.mjs`) and labelled as such. Dedicated recordings (rain on a tin roof, rain on water, single drips) should replace them once freesound.org is allowed.
- **Swaps every 6–22 s** (14 ± 4 s from the plan), not 20–40 s, with 4 s equal-power crossfades: a reading never runs longer than its 23–30 s recording before the next takes over, so the loop seam is rarely reached. Beds still loop through the folded seam if the scheduler stalls.
- **The city is a spot family** (passing traffic far right, low-passed 1.4 kHz → 800 Hz through the evening) rather than a continuous hum, which keeps Neon rain at six panners.
- **Spot plan.** Spots and bed segments are sampled statelessly from the edition seed by position (`spotsBetween`, `bedSegment` in `session.ts`), beside the events, so `createSession` and its music are unchanged and any stretch of listening (including after hours) is planned without state.
- **Mix.** Neon rain's trim is 0.1. Worst cases in `verify-mix` (lofi, speakers and headphones, arrival and evening): opening −20.9 dB, theme −24.1 dB, sparsest six seconds −18.8 dB, loudest spot −18.7 dB under the music. The sparse-window and spot checks are now assertions for every place.
- **Clips** fetch their own copy of the recordings (from the browser cache) instead of borrowing the live decoded buffers.
