# Mote, the traveller

Draft, 9 October 2026; Kyle approved the character and the Neon rain painting the same evening. Kyle asked for one recurring figure in every place: a dark-fantasy hero, Aragorn's kind of build, whose face is always in shadow, dressed for each place, so that the places tell his story. This draft says what he is, how he gets into the paintings without breaking them, and what Kyle decides.

## Who he is

- **Original.** A ranger-like traveller: tall, broad in the shoulder, weathered, a long travelling cloak, a sheathed sword, a worn pack. He reads as the hero of a story we never quite see. He is not a likeness of any actor and not anyone else's character (no white hair with two swords, no wolf medallion, no cat eyes).
- **Face always in shadow.** A hood, a hat brim, back-light or a turned head in every painting, so his features never resolve. You know him by his build, his cloak and the sword.
- **A different outfit in every place** (Kyle, 9 Oct). He's known by his build, his sword and the shadowed face, not by one costume.
- **Small, never the subject.** A mid-ground figure, a few percent of the frame, placed where the eye finds him second. The painting is still the place: you are in the refuge, and he's someone sharing it. This keeps the prompts' old rule ("no dominant human character") in spirit.

## The four places as one story

The paintings already hold a seed of this: Golden hour's prompt left "an empty cloak over a bench, a traveller's pack and a sheathed sword … someone has finally come home". The other places become the road there.

| Place | Mote | What it adds to the story |
| --- | --- | --- |
| Neon rain | the hooded slate-indigo rain cloak, standing under the tea-house eave between the pot and the railing post, one hand on the rail, looking out at the city | a stranger sheltering in a city that isn't his |
| Last light station | a heavy brown greatcoat with a fur-lined hood and a knitted scarf, pack and bedroll at his feet, on the platform past the pillar, looking down the line | leaving, or on his way |
| The last chapter | a sand linen hooded mantle over a rolled-sleeved shirt, sitting on the terrace ledge by the candle lantern, sword leaned on the stone, watching the sunset | resting near the end of the road |
| Golden hour | not shown: only his cloak, pack and sword on the bench, as painted today | home; he's somewhere just out of frame |

Evening states keep him in the same place and pose, lit by that place's evening. In the Halloween states he is there too, unchanged. Seasonal objects stay painted, never drawn in code.

## How he gets into the paintings

Nothing is drawn over the art in code (CLAUDE.md, and the stickers lesson from the first Halloween build). He is painted in.

1. **Character sheet first.** Codex's image tool (`image_gen.imagegen`, Codex CLI 0.160.1, the tool that made the Halloween pairs) makes a reference sheet: front, back, three-quarter, the cloak, the sword and the face in shadow. **Kyle approves it before any place is touched.**
2. **One edit per painting.** Each of the 12 paintings that show him (Golden hour already holds him by absence) gets a composition-matched edit that adds only him, with the sheet attached as the character reference. Evening and Halloween states are edits of that place's new arrival, so pose and position stay identical across states. The prompts and sidecars are kept as provenance, as now.
3. **Registration check.** Each edit must line up with its source at zero shift outside the figure, so the masks and crops still apply, and every state of a place must put him in the same place as its arrival. Where he sits in front of water (the coast), the place's water polygon is cut round him so the water animation never ripples him.
4. **The finish.** Every new painting goes through `scripts/finish.py` like the rest.

## What doesn't change

- Ordinary days compose identically (`tests/halloween.test.ts`), and no code draws him.
- No names, stats or simulation. He doesn't move, speak, or carry UI. The place titles stay as they are unless Kyle chooses otherwise below.
- The audio-first direction: this is one batch of image edits and some checks, not new places.

## For Kyle

1. **His name:** Mote, as Kyle calls him. CLAUDE.md's "no names" was written against organisms and stats, not a painted character.
2. **Where the lore lives.** In the paintings only, as environmental story (recommended), or also one line per place on How Motes is made.
3. **Golden hour.** Keep him absent there, so it's the home he's returning to (recommended), or paint him in.
4. **When.** After the finish lands, so his paintings are finished once (recommended).
