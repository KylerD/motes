# Living scenes and daily radio

The user's direction supersedes artificial life completely: Motes is an alternative to lofi video channels. The scenery and music are equally important. There are no creatures, names, stats or experiment tools. Existing authority covers implementation, art, architecture and removal of superseded code.

## Direction

Preserve the rich illustrated aesthetic. Full-viewport scenery leads; cream Garamond titles and a small listening strip recede. Four places: neon rooftop, golden meadow, snowbound station, coastal reading room. Water, local light, drifting atmosphere and occasional distant events make each place move. A deterministic local-date edition chooses a place and variation every day; users may visit any place and revisit a date. New music and atmospheric combinations are generated locally, not a claim of new hand-painted art every day.

The score has voiced harmony, repeating/answering motifs, bass, swung understated percussion and sections that build and release. A beats/ambient choice and separate music/ambience levels let it work as a long listening session. Audio stays opt-in and continues when the tab is hidden; only visual rendering sleeps. No backend, account or keys.

## Implementation

1. Music task (independent, src/music plus music tests/assets): deterministic multi-song composition, good instrumental timbres, bounded Web Audio scheduling and audio verification. Public API RadioAudio(seed, mood); enable(), pause(), setVolume(0..1), setAmbience(0..1), setMode('beats'|'ambient'), setEdition(seed,mood), next(), dispose(); playing, current {title,bpm,progress,section}; expose a deterministic composer for tests and offline rendering.
2. Scenes and interface (root): daily edition and catalogue, four paintings, atmospheric renderer, scene/date browsing and minimal player. No creature machinery retained. Date changes announce a new edition without interrupting an active session. Reduced motion freezes visual motion independently of listening.
3. Verify composition/daily invariants, production build, desktop/mobile controls, art failure/retry, audio output, pause/resume, scene changes, hidden-tab playback and bounded long-session resources. Fresh review, record current product/design, commit.

## Progress

- Direction chosen from explicit user correction. No further proposal/approval round.
- Replaced the organism simulation and experiment tools with four illustrated scenes, daily editions, weather, water, light, and quiet listening controls.
- Added local CC0 sampled piano, deterministic 64-bar jazz arrangements, soft swung drums, bass, scene ambience, and independent audio scheduling.
- Verified eleven composition/date tests, the production build, desktop/mobile scene controls, retry paths, preferences, midnight behavior, audio lifecycle, continuous track scheduling, and bounded voice resources. Partitioned the 80-score invariant sweep by scene to avoid a single assertion-heavy test exhausting its timeout; the coverage is unchanged.
- Rendered a 90-second audio preview: peak 0.478, RMS 0.043, zero clipped samples. These establish signal health; musical taste is assessed by listening.
- Independent music review resolved the AudioParam compatibility issue. Visual review scored the intermittent mobile Listen-label fix resolved and returned ship for that fix.
- Replaced product/runtime documentation, DESIGN.md, and the design sidecar from the verified living-scenes implementation. Ready for local integration.
