# Dreamy night-drive synthwave

User approved the design and explicitly requested building it on 2026-09-28.

## Experience

Motes gains a remembered Lofi / Synthwave choice in Sound & motion. Drums stay independently switchable. Synthwave uses warm detuned pads, rounded pulsing bass, plucked arpeggios, mellow lead hooks and restrained electronic drums. Four song families (arpeggio, pulse, drift, lead) vary rhythm, density, harmony and structure. The familiar eighteen-song, one-hour arc continues into gentler after hours.

Changing style fades the outgoing music over 0.6 seconds and starts the selected style with a 0.6-second fade-in. It starts a new musical hour without restarting the environment, changing the place or starting paused playback. Scenery progression and event timing remain identical regardless of musical style. Rapid changes discard obsolete scheduled notes. Choosing the same style does nothing.

## Architecture

Keep the deterministic lofi composer unchanged. Add a dedicated pure synthwave planner/composer and explicit synth instruments on the shared score event API. The existing session plan gains style-specific arrangements and timing; a separate environment plan always uses existing lofi timing so style changes cannot move a train, boat or sunset. Both styles use the existing look-ahead scheduler and bounded voice lifecycle.

Synthwave plans eighteen songs totaling 3,600 seconds at 84–112 BPM. Four families have different forms, bass patterns, arpeggio patterns, melody density and drum accents. Adjacent families and chord loops differ. Authored chord loops and two-bar hooks repeat within a song, with section dropouts and verbatim returns. The opening theme returns at track 17; after-hours themes change and energy is capped. No runtime dependencies, APIs or external sound assets.

Synth voices live in a focused sound module and route through the shared music/drums mix. Every oscillator (including detuned partners) is stopped on cancellation and disposal. Synthwave can start without piano samples. A failed piano load when switching to lofi remains visible and retryable. Loading, pause, rapid style changes and scene changes always use the latest requested style.

## Sound revision — 2026-10-01

User feedback: the initial version lacked the characteristic rolling gallop, reverb and thick build. The approved mode now uses long-short-short sixteenth bass (with a reversed gallop for the pulse family), octave lifts, saw/sub bass, detuned polyphonic pads and leads, and a delayed middle-register chord layer. Introductions establish the pads, then introduce the gallop, arpeggio and drums; filter brightness opens through the head, and the return arrives fully layered. Quiet sections and the drifting family retain space. The score ceiling is 4,200 events per track; playback voices remain bounded by the existing scheduler.

Further listening feedback identified gaps between the main chords and a missing sustained, echoing flow. Pads now hold for 8.8 beats across the next chord's attack, with a 2.4-second release. Arpeggios, leads and chord accents receive four decaying, alternating stereo echoes on a dotted-eighth grid. Four cascaded mono delay stages per voice keep storage bounded; the voice's cancellation gain controls both direct sound and echoes, and its lifetime includes the final repeat.

Update, 5 October 2026: to bring synthwave inside the CPU gate, notes at one tempo now share one echo (the same four stages, summed identically). A full stop fades and retires it and later notes start a fresh one, so voices end with their dry release. The hall convolves the first two seconds of its 5.2-second impulse; the remainder is 0.55% of its energy and lies under the following notes.

Synthwave owns a stereo modulated chorus, 5.2-second filtered hall with 35 ms predelay, and a short gated snare room. Effects route only synthwave instruments; drum reverb follows the drums control. Shared effect oscillators belong to the graph and stop on disposal. Per-note oscillator partners and echo nodes remain owned by the voice lifecycle. Rendered checks measure the tail after release, stereo width, headroom, distinct tempo-matched repeats, cancelled echoes and actual chord-join levels; these establish the requested acoustic changes without claiming to judge taste.

## Verification

Pure tests cover determinism, eighteen-song timing, bounded notes/events, family and loop diversity, repeated hooks and after hours. Browser tests cover remembered and invalid preferences, independent drums, switching before/during/after loading, rapid changes, paused changes, scene-clock continuity, sample failure/retry, silence after pause and bounded voices. Existing lofi tests and browser checks continue passing. Render three contrasting previews and measure clipping, signal level and ambient balance. Automated checks establish signal health; the user judges musical taste.
