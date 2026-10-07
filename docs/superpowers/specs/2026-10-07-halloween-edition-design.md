# Halloween edition

Written 7 October 2026. GOAL.md Phase 1 ("Spread") lists a Halloween edition alongside clip export and the TikTok/Reels/Shorts launch.

## Intent

Kyle's direction: a Halloween edition that arrives looking like an ordinary Motes evening and becomes unmistakably Halloween by evening, so it works as a cosy listen and the arrival-to-evening clip catches the change for launch posts. It covers **24–31 October** (local dates, every year) and adds **a recognisable Halloween motif** to the music.

It follows the existing rules: no new paintings (the final pixels come from Motes' own renderer), no toy-like procedural geometry, cosy rather than scary, no nags or rewards, no interruption at midnight, inside the CPU gate, and visible in clips.

## What changes on a Halloween day

### Season

- `seasonOf(day)` in `src/scenes/edition.ts` returns `'halloween'` for validated local dates from 24 to 31 October in any year, otherwise `undefined`.
- `Edition` gains `season?: 'halloween'`. It applies to every place on those dates: the daily place and an explicitly chosen one. Revisiting a Halloween date later shows it again.
- The edition's random draws are unchanged, so seed, intensity, wind and warmth match what those dates would otherwise get. Only `light` takes its text from Halloween phrases, indexed by the same draw.
- In 2026 the days fall as: 24 snow, 25 coast, 26 rain, 27 meadow, 28 snow, 29 coast, 30 rain, 31 meadow. Each place gets exactly two.

### Picture

A new module, `src/scenes/halloween.ts`, draws three layers over the painting. The renderer calls `drawHalloween` after `drawSessionEffects`, only when `edition.season === 'halloween'`. Every layer is derived from listening time (the environment clock) and picture time, never from session events: clips sample a plan without events, and these layers must appear in clips.

1. **Jack-o'-lanterns.** Three or four small pumpkins per place, standing on painted surfaces at authored image coordinates. At least two sit inside the phone crop (about 26% of the painting's width around the place's anchor on a tall phone).
   - Body: three overlapping lobes in a muted orange, with a darker rim, a highlight and a short stem. The lobes are drawn in the painting's palette rather than flat clip-art colours.
   - Daylight: matte orange and unlit; easy to miss.
   - Evening: the body darkens with the place's foreground light, so it never glows unnaturally against the evening painting. The carved face (two triangular eyes and a jagged mouth) lights up along the place's own lamp arc (`sceneLightAt(...).lamps`), with a soft flicker and a small warm glow.
   - Sizes are 1.2–2.2% of the image width, matched to their depth in the painting.
2. **Harvest moon.** A warm cream disc with a soft halo and two faint maria, in a clear patch of each sky and inside the phone crop where the painting allows.
   - It fades in as the sky turns to evening (sky light 0.35 → 0.9) and rises 3% of the image height over the hour.
   - It is drawn from a cached sprite that is rebuilt only when its pixel size changes.
   - At the coast the moon sits above the painted silver path on the bay, so the painting's own path reads as its reflection.
3. **Bats.** Four small dark silhouettes flitting in loose, uneven loops near the moon. They appear only once the moon is well up (at 0.6 or more of its level), and their wings flap with picture time, so Still freezes them.

Initial coordinates (u, v in image units; size as a fraction of image width), to be checked against desktop and phone screenshots:

| Place | Jack-o'-lanterns | Moon |
| --- | --- | --- |
| Neon rain | veranda (.430, .558, .016), (.455, .562, .011); steps (.330, .597, .014); pond rim (.560, .612, .010) | (.560, .100) |
| Golden hour | stones (.455, .655, .016), (.480, .660, .011); grass (.605, .628, .012); by the lantern (.775, .620, .013) | (.480, .070) |
| Last light station | platform (.355, .720, .022), (.380, .725, .014); far platform (.365, .610, .009); window ledge (.175, .556, .014) | (.570, .150) |
| The last chapter | lantern block (.495, .768, .020); wall top (.567, .657, .012); desk (.150, .615, .016) | (.605, .130) |

The cost is bounded and small: at most four pumpkins, one cached moon sprite and four bat paths per frame. Glows reuse a cached radial sprite instead of creating gradients each frame. Water does not reflect the overlays; only the composited painting is displaced, as today.

### Words

- **Atmosphere** (`edition.light`, also used in the canvas's accessible name): three Halloween phrases per place, for example "Pumpkins on the platform" or "A harvest moon over the bay".
- **Captions:** from 30 listening minutes, the caption shown in the player becomes one of two Halloween captions per place (30–45 minutes, then 45 onwards). The first half-hour keeps the place's own captions, so the edition starts quietly.
- **Subtitle:** the final subtitle (from 40 minutes) becomes a Halloween line. On 31 October it is "Happy Halloween."

### Music

**The motif.**
- Rhythm: two creeping phrases over two bars. The first is three eighth notes into a held note (beats 0, ½, 1, then 1½ held for 1½ beats). The second, after a rest, repeats that shape held longer (beats 4, 4½, 5, then 5½ held for 2). The rhythm leaves air, ends on a held note and never overlaps itself, like every existing cell.
- Lofi: the rhythm is appended as `MELODY_CELLS[12]`. Contour `[2, 1, 0, 3, 2, 1, 0, -1]` around the fifth (`degree: 4`): in minor it falls ♭7, ♭6, 5, springs up to the octave, then falls again to the fourth.
- Synthwave: the same rhythm is appended as `HOOKS[6]`, with the chord-tone contour `[2, 1, 0, 3, 2, 1, 0, 1]`.
- Random theme draws keep using only the original 12 cells and 6 hooks, so no ordinary song changes.

**Lofi Halloween hour** (`createSession(seed, mood, style, season)`):
- The motif is the hour's theme. Songs 1 and 18 state it, songs 16 and 17 borrow its rhythm, and every third song borrows its contour, as the planner already does with the hour's theme.
- Songs 1 and 18 are in minor; their loop starts on the tonic (ember, ferry, hush, dorian or tide).
- One more minor song is added in chapter 4, on top of the nocturnes and chapters 2, 3, 5 and 6, still never beside another minor song.
- Vibes also play songs 4 and 18, as well as 7, 11 and 15.
- Tempos, forms and the exact 3,600-second hour are unchanged.

**Synthwave Halloween hour** (`planSynthwave(seed, season)`): song 1 and its return at song 18 carry the motif. Synthwave is already mostly minor, so nothing else changes.

**After hours:** fresh ordinary themes, as today.

Ordinary days must compose exactly as before. A fingerprint test pins `createSession` for both styles across three seeds and four places, opening and after-hours tracks, and editions either side of the season.

### Plumbing

- `RadioAudio` takes the season in its constructor and in `setEdition(seed, mood, season)`. Both the music plan and the environment plan use it.
- `main.ts` passes `current.season` wherever it builds a session: audio, preview, debug.
- `src/clip/export.ts` and `src/clip/music.ts` pass `edition.season`, so a Halloween clip has the Halloween picture and motif.
- `scripts/render-music-preview.mjs` accepts an optional eighth argument, `halloween`.
- `scripts/score.mjs` adds a Halloween CPU measurement (Neon rain on 31 October, lofi). G2 passes only if every measured ratio is 1.0 or lower.

## Out of scope

- Static link-preview cards: they are built once, so they can't follow dates.
- A seasonal on/off switch.
- New session events, mist, falling leaves or new paintings.
- Any analytics change: arrivals by date already show the edition's effect.

## Verification

- **Unit tests:**
  - season dates: 23 Oct, 24 Oct, 31 Oct, 1 Nov, another year and invalid dates;
  - Halloween editions keep their random draws and change only `light`;
  - the Halloween lofi plan: motif at 1 and 18, minor at 1 and 18, vibes at 4 and 18, an exact 3,600 s hour, no adjacent minor songs outside nocturnes;
  - the synthwave plan's motif at 1 and 18;
  - ordinary fingerprints unchanged;
  - the motif cell obeys the existing cell rules.
- **Picture:** screenshots of all four places on Halloween dates at listening minutes 0, 20, 40 and 60, on desktop (1280×720) and phone (390×844), reviewed against the paintings; then the same with Still. Pumpkins must sit on surfaces, and the moon and bats must stay in clear sky.
- **Clip:** render the 31 October clip and check it with `scripts/verify-clip.mjs`.
- **Audio:**
  - PCM previews of Halloween lofi songs 1 and 18 and Halloween synthwave song 1, with peak/RMS reported;
  - `verify-music`, `verify-mix`, `verify-mix synthwave`, `verify-synthwave` and `verify-synthwave-sound`;
  - three rendered synthwave family previews, as CLAUDE.md requires for synthwave changes.
- **Gates:** `npm test`, `npm run build`, `npm run score -- --full` with the new Halloween G2 measurement.
- **Docs:** PRODUCT.md, DESIGN.md and README describe the edition. GOAL.md marks it done in the Phase 1 roadmap.
