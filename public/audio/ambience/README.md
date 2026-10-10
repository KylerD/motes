# Scene sound recordings

Each place's scene sounds are short loops and spots cut from field recordings that their recordists dedicated to the public domain under **Creative Commons CC0 1.0 Universal** (https://creativecommons.org/publicdomain/zero/1.0/). No attribution is required; it is given here with thanks and so every file can be traced.

`scripts/encode-ambience.mjs` makes every file from the sources below. It downloads each source once into `.cache/ambience/` (never served), checks it against the SHA-256 recorded in the script, then trims, filters, normalises every bed to one shared level (−30 dBFS RMS) and every spot's loudest 50 ms to −24 dBFS, folds each bed's last 1.5 s into its first so it loops without a seam, and encodes MP3 with FFmpeg/libmp3lame. `encoded.json` lists what it wrote. The sound maps that place these files around the listener are in `src/music/ambience-maps.ts`.

## Sources

Neon rain's three recordings were found on Freesound and are fetched from the repository of [Ambie](https://github.com/jenius-apps/ambie) (MIT), an ambient sound app that ships them with their Freesound attributions in `Data.json`, pinned at commit `eb29bd9946b414f7b7988d43ea5e77c537e9ab7d`.

| Source | Recordist | Freesound | Licence | SHA-256 (as fetched) |
| --- | --- | --- | --- | --- |
| Rain heavy 1 (rural) | jmbphilmes | https://freesound.org/s/200270/ | CC0 1.0 | `798293eb…a82ada64` |
| Burbling Brook | hargissssound | https://freesound.org/s/324591/ | CC0 1.0 | `3926d7cf…45863777` |
| City park_1 (traffic, cars, people, voices, shouting) | o_ciz | https://freesound.org/s/475513/ | CC0 1.0 | `05346bce…ae23b353` |

The other places' recordings are fetched from Freesound itself: each sound's high-quality preview (Ogg Vorbis, about 200 kbps), which Freesound serves without an account. Each sound's page states its CC0 1.0 licence; all were checked on 10 October 2026.

| Source | Recordist | Freesound | Licence | SHA-256 (as fetched) |
| --- | --- | --- | --- | --- |
| Appalachian Snowy Afternoon 2 | lakewoodsound | https://freesound.org/s/719852/ | CC0 1.0 | `798293eb…a82ada64` |
| Propane Lantern | clairinski | https://freesound.org/s/159386/ | CC0 1.0 | `aa8f8669…beb7f8f2` |
| Grandfather clock | Ryding | https://freesound.org/s/125968/ | CC0 1.0 | `1396506d…97c5a95d` |
| Italian bells mid distant | mikewest | https://freesound.org/s/411489/ | CC0 1.0 | `c5946099…e2432d31` |
| dog barks far echo | kyles | https://freesound.org/s/453433/ | CC0 1.0 | `22613d84…384cb4e0` |
| Distant Train Passing | simgo | https://freesound.org/s/380671/ | CC0 1.0 | `815d9be6…a3a3e699` |
| Summer Meadow | baryy | https://freesound.org/s/409143/ | CC0 1.0 | `daeeb9f2…de6e4d30` |
| Forest, close up of trees rustling in the wind | Anya_Media | https://freesound.org/s/523389/ | CC0 1.0 | `d57fddee…95040ba8` |
| LakeWavesOct25th2015 | kvgarlic | https://freesound.org/s/326097/ | CC0 1.0 | `783364ed…fa65d0dc` |
| Blackbird in the morning | Sesom42 | https://freesound.org/s/431911/ | CC0 1.0 | `6b66edb5…a9942aea` |
| Bumble Bees on Blossom | Cheeseheadburger | https://freesound.org/s/152789/ | CC0 1.0 | `60b5b537…8cac2801` |
| AMBIENCE NIGHT FIELD CRICKET 01 | sengjinn | https://freesound.org/s/175020/ | CC0 1.0 | `c5ce8cc7…67d541f5` |
| house martins | Jaturo | https://freesound.org/s/196363/ | CC0 1.0 | `76417b64…3f62ebf2` |
| Meer_Fels_dümpelt_Sard.TB | Thomas Bruderer | https://freesound.org/s/188509/ | CC0 1.0 | `7b10b41a…71578c35` |
| 130720_Trogir_17Gradska_4824 | blaukreuz | https://freesound.org/s/195725/ | CC0 1.0 | `93a8acfd…5b89421a` |
| Fabric Flapping | IENBA | https://freesound.org/s/701647/ | CC0 1.0 | `0e6897dc…ebf95146` |
| Boat_Chain_Creaking | suonidigenova | https://freesound.org/s/55034/ | CC0 1.0 | `a09d3e1c…1b4e96c4` |
| S29-19 Bell buoy | craigsmith | https://freesound.org/s/675693/ | CC0 1.0 | `fddb35a9…ddc4fa47` |
| Seagulls / gaviotas clean wildtrack | Soojay | https://freesound.org/s/462462/ | CC0 1.0 | `660c7a86…3ebe4e74` |
| Marine diesel engine | AugustSandberg | https://freesound.org/s/264864/ | CC0 1.0 | `13165f14…61ad2072` |

## Neon rain (`rain/`)

| File | Made from | Edits |
| --- | --- | --- |
| `garden.mp3` (stereo, 30 s, 112 kbps) | Rain heavy 1 | Two separate stretches of the mono recording, one per ear, so the rain surrounds without a centre; 24 dB/octave high-pass at 150 Hz (removes a faint hum), −2 dB above 9 kHz |
| `roof.mp3` (mono, 26 s, 80 kbps) | Rain heavy 1 | High-pass at 180 Hz, +5 dB around 520 Hz for the roof's body, low-pass at 6.5 kHz |
| `pond.mp3` (mono, 23.2 s, 80 kbps) | Burbling Brook, Rain heavy 1 | The brook between 300 Hz and 9 kHz, with the rain's fizz above 3.5 kHz mixed in for rain landing on water |
| `gutter.mp3` (mono, three 4 s slots) | Burbling Brook | Three stretches between 300 Hz and 6 kHz with soft edges |
| `city.mp3` (mono, three 4 s slots) | City park_1 | Traffic from the first seventeen seconds only (voices come in later), low-pass at 1 kHz, slow edges |
| `drips.mp3` (mono, eight 0.6 s slots) | Modelled, not recorded | No CC0 recording of single drips could be reached when this was made. Each drip is synthesised by the encode script from a fixed seed: a water drop's entrained bubble (a rising, quickly damped sine, after van den Doel, “Physically-based models for liquid sounds”, 2005) or a tap on wet stone, with a faint splash and two early reflections. Replace it with a CC0 recording when one is chosen. |

## Last light station (`snow/`)

| File | Made from | Edits |
| --- | --- | --- |
| `wind.mp3` (stereo, 32 s, 96 kbps) | Appalachian Snowy Afternoon 2 | A calm stretch running into a gust (30–63.5 s), 24 dB/octave high-pass at 70 Hz for the wind's buffeting |
| `lantern.mp3` (mono, 12 s, 64 kbps) | Propane Lantern | Between 200 Hz and 7 kHz |
| `clock.mp3` (mono, three 3 s slots) | Grandfather clock | Ticks between 150 Hz and 8 kHz with short edges |
| `peal.mp3` (mono, three 6 s slots) | Italian bells mid distant | Moments of the peal between 250 Hz and 3 kHz, faded over 1.5–1.8 s at each end, so the wind seems to carry them |
| `dog.mp3` (mono, four 2.5 s slots) | dog barks far echo | Single and double barks with their echo, between 200 Hz and 2.5 kHz |
| `train.mp3` (mono, 12 s, 64 kbps) | Distant Train Passing | The loudest stretch of the pass (10–23.5 s), up to 3 kHz, folded to loop while the train runs |

## Golden hour (`meadow/`)

| File | Made from | Edits |
| --- | --- | --- |
| `grass.mp3` (stereo, 26 s, 96 kbps) | Summer Meadow | 60–87.5 s, high-pass at 80 Hz |
| `tree.mp3` (mono, 24 s, 64 kbps) | Forest, close up of trees rustling in the wind | One gust swelling through the leaves and dying back (26–51.5 s), high-pass at 90 Hz |
| `pond.mp3` (mono, 20 s, 64 kbps) | LakeWavesOct25th2015 | The calm opening (14–35.5 s) between 120 Hz and 7 kHz |
| `birds.mp3` (mono, five 3.5 s slots) | Blackbird in the morning | The five phrases, high-pass at 600 Hz |
| `bees.mp3` (mono, four 4 s slots) | Bumble Bees on Blossom | Stretches between the recording's bird calls, 90 Hz to 5 kHz, slow edges |
| `crickets.mp3` (mono, four 3 s slots) | AMBIENCE NIGHT FIELD CRICKET 01 | High-pass at 1.5 kHz, slow edges |
| `martins.mp3` (mono, six 2 s slots) | house martins | Chirps from the first 22 seconds, high-pass at 1.5 kHz |

## The last chapter (`coast/`)

| File | Made from | Edits |
| --- | --- | --- |
| `sea.mp3` (stereo, 21 s, 96 kbps) | Meer_Fels_dümpelt_Sard.TB | The calmest stretch (262.5–285 s); elsewhere the waves slap under the rocks some 30 dB over the wash. 24 dB/octave high-pass at 60 Hz |
| `town.mp3` (mono, 24 s, 64 kbps) | 130720_Trogir_17Gradska_4824 | A café square's evening (40–65.5 s) between 120 Hz and 3 kHz; the sound map low-passes it further, to 1.1 kHz and then 700 Hz, so at 150 m it is murmur |
| `curtain.mp3` (mono, four 3 s slots) | Fabric Flapping | Slowed to four fifths, so it is a heavier curtain lifting rather than a flag; between 150 Hz and 5 kHz, slow edges |
| `chains.mp3` (mono, three 2.2 s slots) | Boat_Chain_Creaking | The creaks, high-pass at 200 Hz |
| `buoy.mp3` (mono, four 2.6 s slots) | S29-19 Bell buoy | Single strikes and their ring, 24 dB/octave high-pass at 400 Hz (the clapper's thump), low-pass at 6 kHz |
| `gulls.mp3` (mono, six 2.2 s slots) | Seagulls / gaviotas clean wildtrack | Calls, 24 dB/octave high-pass at 400 Hz |
| `engine.mp3` (mono, 10 s, 64 kbps) | Marine diesel engine | 20–31.5 s, up to 1.5 kHz; the sound map low-passes it to 500 Hz, for a boat on the horizon |

## Sizes

`encoded.json` has each file's size. Each place stays inside the 1.2 MB it may use: Neon rain 1.15 MB, the station 0.84 MB, the meadow 1.07 MB and the coast 0.82 MB. Decoded at 48 kHz they hold about 25, 23, 28 and 22 MB, inside the 32 MB cap for the active place.
