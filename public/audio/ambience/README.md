# Scene sound recordings

Each place's scene sounds are short loops and spots cut from field recordings that their recordists dedicated to the public domain under **Creative Commons CC0 1.0 Universal** (https://creativecommons.org/publicdomain/zero/1.0/). No attribution is required; it is given here with thanks and so every file can be traced.

`scripts/encode-ambience.mjs` makes every file from the sources below. It downloads each source once into `.cache/ambience/` (never served), checks it against the SHA-256 recorded in the script, then trims, filters, normalises every bed to one shared level (−30 dBFS RMS) and every spot's loudest 50 ms to −24 dBFS, folds each bed's last 1.5 s into its first so it loops without a seam, and encodes MP3 with FFmpeg/libmp3lame. `encoded.json` lists what it wrote. The sound maps that place these files around the listener are in `src/music/ambience-maps.ts`.

## Sources

The three recordings were found on Freesound and are fetched from the repository of [Ambie](https://github.com/jenius-apps/ambie) (MIT), an ambient sound app that ships them with their Freesound attributions in `Data.json`, pinned at commit `eb29bd9946b414f7b7988d43ea5e77c537e9ab7d`.

| Source | Recordist | Freesound | Licence | SHA-256 (as fetched) |
| --- | --- | --- | --- | --- |
| Rain heavy 1 (rural) | jmbphilmes | https://freesound.org/s/200270/ | CC0 1.0 | `5a68ea94…3f753fa0` |
| Burbling Brook | hargissssound | https://freesound.org/s/324591/ | CC0 1.0 | `3926d7cf…45863777` |
| City park_1 (traffic, cars, people, voices, shouting) | o_ciz | https://freesound.org/s/475513/ | CC0 1.0 | `05346bce…ae23b353` |

## Neon rain (`rain/`)

| File | Made from | Edits |
| --- | --- | --- |
| `garden.mp3` (stereo, 30 s, 112 kbps) | Rain heavy 1 | Two separate stretches of the mono recording, one per ear, so the rain surrounds without a centre; 24 dB/octave high-pass at 150 Hz (removes a faint hum), −2 dB above 9 kHz |
| `roof.mp3` (mono, 26 s, 80 kbps) | Rain heavy 1 | High-pass at 180 Hz, +5 dB around 520 Hz for the roof's body, low-pass at 6.5 kHz |
| `pond.mp3` (mono, 23.2 s, 80 kbps) | Burbling Brook, Rain heavy 1 | The brook between 300 Hz and 9 kHz, with the rain's fizz above 3.5 kHz mixed in for rain landing on water |
| `gutter.mp3` (mono, three 4 s slots) | Burbling Brook | Three stretches between 300 Hz and 6 kHz with soft edges |
| `city.mp3` (mono, three 4 s slots) | City park_1 | Traffic from the first seventeen seconds only (voices come in later), low-pass at 1 kHz, slow edges |
| `drips.mp3` (mono, eight 0.6 s slots) | Modelled, not recorded | No CC0 recording of single drips could be reached when this was made. Each drip is synthesised by the encode script from a fixed seed: a water drop's entrained bubble (a rising, quickly damped sine, after van den Doel, “Physically-based models for liquid sounds”, 2005) or a tap on wet stone, with a faint splash and two early reflections. Replace it with a CC0 recording when one is chosen. |

Neon rain's files total 1.15 MB, inside the 1.2 MB a place may use. Decoded at 48 kHz they hold about 26 MB, inside the 32 MB cap for the active place.
