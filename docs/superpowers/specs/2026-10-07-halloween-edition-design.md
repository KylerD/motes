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

A new module, `src/scenes/halloween.ts`, draws three layers over the painting. Its `HalloweenLayer` is owned by the `SceneRenderer`, created for a Halloween edition and dropped with it, so no module holds mutable state. The renderer calls `layer.draw(...)` after `drawSessionEffects`, only when `edition.season === 'halloween'`. Every layer is derived from listening time (the environment clock) and picture time, never from session events: clips sample a plan without events, and these layers must appear in clips.

1. **Jack-o'-lanterns.** Three or four small pumpkins per place, standing on painted surfaces at authored image coordinates. At least two sit inside the phone crop (about 26% of the painting's width around the place's anchor on a tall phone).
   - Body: pre-rendered once per pixel size as a shaded sprite, so it reads painterly rather than as flat clip-art. It has three overlapping lobes with radial shading in a muted orange, a warm rim light, a short stem and a soft contact shadow.
   - Two sprites, day and dusk, are crossfaded by the place's foreground light. Daylight is matte orange and unlit, easy to miss. At evening the body darkens with the painting, so it never glows unnaturally.
   - Carvings vary so they read as hand-made: a friendly face (round eyes, a gentle smile), a crescent moon, and a scatter of round holes. Never the stock triangle-eyed face on every pumpkin.
   - The carving's light rises along the place's own lamp arc (`sceneLightAt(...).lamps`), with a soft flicker. A small warm pool of light spreads onto the surface beneath.
   - Sizes are 1.2–2.2% of the image width, matched to their depth in the painting. In a clip (phone layout at 2.67×) that makes a near pumpkin about 50 output pixels wide: readable without dominating.
2. **Harvest moon.** A warm cream disc with a soft halo and two faint maria, in a clear patch of each sky and inside the phone crop where the painting allows.
   - It fades in as the sky turns to evening (sky light 0.35 → 0.9) and rises 3% of the image height over the hour.
   - It is drawn from a cached sprite that is rebuilt only when its pixel size changes.
   - At the coast the moon sits above the painted silver path on the bay, so the painting's own path reads as its reflection.
3. **Bats.** Four small dark silhouettes flitting in loose, uneven loops near the moon. They appear only once the moon is well up (at 0.6 or more of its level), and their wings flap with picture time, so Still freezes them.

Final coordinates (u, v in image units; size as a fraction of image width), chosen from desktop and phone screenshots. A phone shows the painting's v .66–.77 under its caption and its top under the header; the clip's wordmark covers v .115–.151. So each moon settles at v ≥ .178, and pumpkins mostly stand above v .66.

| Place | Jack-o'-lanterns | Moon (settled centre) | Arrival light on pumpkins |
| --- | --- | --- | --- |
| Neon rain | steps (.335, .600, .024), (.365, .607, .016); pond rim (.470, .624, .015), (.565, .618, .017) | (.52, .20), veiled to 70% by cloud | 0.3 (blue hour) |
| Golden hour | stones (.455, .655, .026), (.487, .662, .018); grass (.605, .628, .019); by the lantern (.775, .622, .021) | (.55, .178), radius .021, rising from behind the ridge, clipped to a traced horizon | 1 |
| Last light station | platform (.368, .655, .024), (.393, .661, .016), (.386, .606, .011); window ledge (.175, .556, .022) | (.55, .20) | 0.45 (twilight) |
| The last chapter | lantern block (.497, .770, .030); wall top (.567, .657, .022); on the books (.400, .745, .018) | (.605, .19) | 0.8 (sunset) |

The cost is bounded and small. Each frame draws at most four pumpkins (three sprite draws each: body, carving and glow), one moon sprite and four bat paths, and creates no gradients. The layer caches its sprites per pixel size, rebuilds them only when the layout changes, and holds a fixed number of them. Water does not reflect the overlays; only the composited painting is displaced, as today.

### Words

One line per place for each slot, in the existing short, welcoming voice. No puns.

- **Atmosphere** (`edition.light`, also used in the canvas's accessible name): one Halloween phrase per place, for example "Pumpkins on the platform".
- **Caption:** from 30 listening minutes, the caption shown in the player becomes a Halloween caption per place, for example "A harvest moon over the bay". The first half-hour keeps the place's own captions, so the edition starts quietly.
- **Subtitle:** the final subtitle (from 40 minutes) becomes a Halloween line per place. On 31 October it is "Happy Halloween."

### Music

**The motif.**
- Rhythm: two creeping phrases over two bars. The first is three eighth notes into a held note (beats 0, ½, 1, then 1½ held for 1½ beats). The second, after a rest, repeats that shape held longer (beats 4, 4½, 5, then 5½ held for 2). The rhythm leaves air, ends on a held note and never overlaps itself, like every existing cell.
- Lofi: the rhythm is appended as `MELODY_CELLS[12]`. Contour `[2, 1, 0, 3, 2, 1, 0, -1]` around the fifth (`degree: 4`): in minor it creeps down from ♭7 through ♭6 to 5, springs up, then creeps down again. The melody's usual chord-tone fitting may move individual notes; the creeping shape and its rhythm are what make it recognisable.
- Synthwave: the same rhythm is appended as `HOOKS[6]`, with the chord-tone contour `[2, 1, 0, 2, 2, 1, 0, 1]`: fifth, third, root, back up to the fifth, then down again to rest on the third. Ordinary hooks fold each note into the lead's range separately, which would zigzag a written line. So an authored hook (one never drawn at random) is placed at one octave per statement, and its answer repeats it rather than shifting. In every key it creeps down the triad and springs back.
- Random theme draws keep using only the original 12 cells and 6 hooks, so no ordinary song changes.

**Lofi Halloween hour** (`createSession(seed, mood, style, season)`):
- The motif is the hour's theme. Songs 1 and 18 state it, songs 16 and 17 borrow its rhythm, and every third song borrows its contour, as the planner already does with the hour's theme.
- Songs 1 and 18 are in minor; their loop starts on the tonic (ember, ferry, hush, dorian or tide).
- One more minor song is added in chapter 4, on top of the nocturnes and chapters 2, 3, 5 and 6, still never beside another minor song.
- Vibes also play songs 4 and 18, as well as 7, 11 and 15.
- Tempos, forms and the exact 3,600-second hour are unchanged.

**Synthwave Halloween hour** (`planSynthwave(seed, halloween)`, a boolean so the MIT engine needn't know the app's seasons): song 1 and its return at song 18 carry the motif. Synthwave is already mostly minor, so nothing else changes.

**After hours:** fresh ordinary themes, as today.

Ordinary days must compose exactly as before. A fingerprint test pins `createSession` for both styles across three seeds and four places, opening and after-hours tracks, and editions either side of the season.

### Plumbing

The season comes from one place, `edition()`. Every caller that builds a session passes `edition.season` on:

- `RadioAudio` takes the season in its constructor and in `setEdition(seed, mood, season)`, and keeps it. The music plan, the environment plan and a style switch's new hour all use it, so switching to synthwave on 31 October still gives the Halloween hour.
- `main.ts` passes `current.season` to audio, previews and the debug plan.
- `src/clip/export.ts` and `src/clip/music.ts` pass `edition.season`, so a Halloween clip has the Halloween picture and motif.
- `renderPreview` takes a `season` option. `scripts/render-music-preview.mjs` accepts an optional eighth argument, `halloween`.
- `scripts/score.mjs` gains `--day <date>` for the CPU gate, which otherwise measures 17 September, and `--evening`, which holds the picture at minute 50 so evening layers are priced. `npm run score -- --day 2026-10-31 --evening` scores the Halloween edition with its moon, bats and lit pumpkins, and the same options will serve any later seasonal edition. The everyday score run keeps its length.

## Out of scope

- Static link-preview cards: they are built once, so they can't follow dates.
- A seasonal on/off switch.
- Dating share links during the season. Links shared during the season already open the Halloween edition; pinning the date would make links go stale for everyone who opens them later.
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
  - Kyle's listen to the motif, which no automated check can judge.
- **Gates:** `npm test`, `npm run build`, `npm run score -- --full`, and `npm run score -- --day 2026-10-31 --evening` for the Halloween CPU ratio (1.0 or lower in both styles).
- **Docs:** PRODUCT.md, DESIGN.md and README describe the edition. GOAL.md marks it done in the Phase 1 roadmap.
