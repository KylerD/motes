# Halloween edition

Written 7 October 2026. GOAL.md Phase 1 ("Spread") lists a Halloween edition alongside clip export and the TikTok/Reels/Shorts launch.

## Intent

Kyle's direction: a Halloween edition that arrives looking like an ordinary Motes evening and becomes unmistakably Halloween by evening, so it works as a cosy listen and the arrival-to-evening clip catches the change for launch posts. It covers **24–31 October** (local dates, every year) and adds **a recognisable Halloween motif** to the music.

It follows the existing rules: no toy-like procedural geometry, cosy rather than scary, no nags or rewards, no interruption at midnight, inside the CPU gate, and visible in clips.

## What changes on a Halloween day

### Season

- `seasonOf(day)` in `src/scenes/edition.ts` returns `'halloween'` for validated local dates from 24 to 31 October in any year, otherwise `undefined`.
- `Edition` gains `season?: 'halloween'`. It applies to every place on those dates: the daily place and an explicitly chosen one. Revisiting a Halloween date later shows it again.
- The edition's random draws are unchanged, so seed, intensity, wind and warmth match what those dates would otherwise get. Only `light` takes its text from Halloween phrases, indexed by the same draw.
- In 2026 the days fall as: 24 snow, 25 coast, 26 rain, 27 meadow, 28 snow, 29 coast, 30 rain, 31 meadow. Each place gets exactly two.

### Picture

**Revised 7 October, after the first version shipped:** the first build drew jack-o'-lanterns, a moon and bats with Canvas 2D over the existing paintings (`src/scenes/halloween.ts`). Kyle rejected it ("pumpkin emojis onto existing artwork … it needs new artwork altogether"): however they are shaded, code-drawn objects read as stickers on a painting. The layer was removed. Seasonal objects are now always painted.

Each place has an authored Halloween pair in `public/scenes/`, made with the same Codex built-in image tool (`image_gen.imagegen`) as the originals:

- **`<slug>-halloween-evening.png`:** a composition-matched edit of the place's evening painting. Jack-o'-lanterns are painted on surfaces with their own candlelight, contact shadows and reflections. A harvest moon rises with a few bats, and autumn touches suit each place: orange eave lanterns and maple leaves on the rooftop, an autumn oak at the meadow, a wreath in the station café, lanterns along the harbour.
- **`<slug>-halloween.png`:** the arrival. It is that Halloween evening relit toward the place's own arrival painting (attached as a lighting reference only). The same jack-o'-lanterns with the same carvings appear unlit, with no moon or bats.

The usual lighting arc carries a Halloween day from one to the other, so the edition arrives as an autumn visit and settles into a Halloween night. Masks, water polygons, cover crops and clip export apply unchanged because every image is registered to the originals. A 50/50 blend of each pair and of each evening against its everyday evening shows no doubled edges.

`edition.ts` gives each place an optional `halloween` pair. `arrivalImage(edition)` and `eveningImage(edition)` choose the pair. The renderer keeps one arrival and one evening painting per place, keyed by its current source, so the cache stays at four of each, and a late callback for a superseded image prepares nothing. Only the visited place's pair loads. Place pages still preload the everyday arrival, which a Halloween visit doesn't use: one wasted download for eight days a year.

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
- New session events or code-drawn mist and falling leaves.
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
