# The Motes finish

Written 9 October 2026. Motes is open for hours on second monitors, so the paintings are seen large and seen often. Two things work against them.

- **They look generated.** The detail is everywhere at the same sharpness, the colour is pushed to the limit, blacks are pure, and there is no medium.
- **They are small.** The paintings are 1672×941, below 1080p. A 1440p or 4K second monitor stretches them 1.5 to 2.3 times, and the softness reads as cheap.

The finish answers both. One build-time pass makes every painting look painted, and makes the four places look like one set. The paintings then ship in two resolution tiers, so a big screen gets a sharp painting and a phone never downloads one it can't use.

Kyle chose the look on 9 October from the test in `spike/look/` ("gouache, light": `spike/look/out/detail-*.png`).

## The look

All four steps work in place: nothing moves more than a few pixels. So masks, matched evening states, water and lights still line up, and the arrival, evening and Halloween states of a place get exactly the same treatment.

1. **Brush:** a generalised Kuwahara filter. It has eight overlapping sectors, and each pixel takes the mean of its quietest sectors, weighted by `1/(1+(255Σσ²)^4)`. Its radius is 4 px at 1672 wide and scales with the tier, so the strokes are the same size on every screen. Flat areas become soft dabs of paint, and edges stay crisp.
2. **Inks:** one set for every place.
   - Chroma is eased off the top: in Lab, `C' = 75·tanh(C/75)`.
   - The darkest tone is indigo (`#090819`), never black, and the lightest is warm paper (`#fbf6ed`), never white.
   - Shadows lean slightly cool and lights slightly warm.

   Each place keeps its own key colours. Only the extremes are pulled in.
3. **Glow:** the soft halo round every lamp, window and neon sign that lofi backgrounds share. It's a screen blend of the bright areas, blurred at two sizes, and slightly warmer than the light itself (strength 0.15).
4. **Paper:** a faint cold-press grain, made of a slow mottle, fine tooth and fibres. It shows most in the light washes (strength 0.03) and is seeded by position, so every state of a place shares one sheet.

The parameters live in one place, `scripts/finish.py`, whose header records Kyle's choice and why. The spike's other looks (print, heavier gouache, watercolour, ink and wash) are noted there as tried and declined.

## Tiers

There are two tiers. A middle 2560 tier would add 32 files and a second upgrade rule to serve 1440p monitors, and they can downscale full instead.

| Tier | Width | For | AVIF after the finish |
| --- | --- | --- | --- |
| base | 1672 | first paint everywhere, phones and tablets, and screens that don't need more | ≤ 350 KB (G3's budget) |
| full | 3840 | desktop screens whose painting covers more device pixels than base has | measured; target ≤ 1.3 MB |

The brush flattens fine noise, so finished files should come out smaller than today's at the same quality. That's measured as part of the work, not assumed.

- **Upscaling:** full is made by upscaling each master four times with Real-ESRGAN, run locally on the 4090 through its portable Vulkan build (`realesrgan-ncnn-vulkan -i … -o … -n realesrgan-x4plus-anime`). It needs no keys, it's free, and nothing leaves the machine.
  - **The model:** `-x4plus-anime` or `-x4plus` is chosen by eye on one painting in the first step.
  - **Then:** the result is downsampled with Lanczos to 3840 and finished at that width. The brush smooths over the upscaler's invented micro-detail, which is exactly the kind of detail that gives an image model away.
  - **Seams:** the portable build upscales in tiles and can leave faint seams between them, so the frames for Kyle are also checked for seams.
- **Caching:** the upscaled intermediates are cached in a gitignored `.cache/scenes/`.

### Choosing a tier in the browser

- **First paint always uses base**, so G3 is untouched.
- **The upgrade rule:** afterwards, on a fine pointer (`pointer: fine`), the renderer works out how many device pixels the painting covers: the cover-crop image width × `devicePixelRatio`. If that is more than 1.15 × 1672, it loads full for the arrival and evening states together.
- **No upgrade** where the browser reports `navigator.connection.saveData` or an `effectiveType` slower than 4G (where the Network Information API exists).
- **The swap:** when both full states have decoded, the composite is rebuilt at the new size at its next two-second update. The swap is softened by the renderer's existing screen-sized `previous`-frame blend, never by holding a second full-size composite (CLAUDE.md allows one, plus one while a clip is made). Under reduced motion it swaps at once. The strokes are the same size at both tiers, so the swap reads as the picture coming into focus, not a different picture.
- **Late loads:** a full tier that arrives after you've left the place is dropped (the same rule as late evening images, CLAUDE.md). Returning to a place reuses what it already decoded.
- **Memory:** at full, the active place holds two decoded paintings and one composite, about 100 MB. That's fine on desktops. Phones and tablets stay on base, so their memory is unchanged.

## Masters and files

- **Masters move to `art/scenes/`.** The original PNGs, their `.png.json` provenance and `ARTWORK.md` leave `public/scenes/`. They stay committed but are no longer served: the shipped files are all finished, and serving an unfinished PNG as a last resort would show the old look.
- **Served formats:** AVIF, then WebP. If both fail, the painting's existing visible retry appears.
- **Logical names:** `edition.ts` names each painting without an extension. The loader builds `/scenes/<name>[@3840].<avif|webp>` from the name. Every other reference to a served PNG moves to the logical name in the same change: clip export, share pages and preview cards, `verify-scenes`, `render-clip` and the tests. `rg "/scenes/.*\.png"` must come back empty.
- **The pipeline:**
  - `scripts/finish.py` (uv, OpenCV): masters → upscale (cached) → tiers → finish → finished PNGs in `.cache/scenes/finished/`.
  - `scripts/encode-scenes.mjs` then encodes the tiers, thumbnails, preview cards and the made page's pictures from those finished PNGs, not from the masters.
  - The encoded files are committed as today. The full tier adds roughly 16 × 1 MB, about the size of the PNGs that are no longer served.
- **Clips** use the base tier, as now, so clip rendering is unchanged.

## Checks

- **Existing:** `npm test` and `npm run build`. `tests/halloween.test.ts` still pins ordinary days composing identically.
- **`verify-scenes.mjs`:**
  - every painting has both tiers in both formats;
  - tier dimensions are exact;
  - the base tier stays within G3's budget;
  - the upgrade happens on a 2560×1440 window and never on a phone viewport;
  - a late tier for a place you've left is dropped;
  - a failed full tier keeps base on screen with no error shown, because base is enough;
  - one full-size composite at most.
- **G2 also runs at 2560×1440,** because the score's 1280×720 window would only ever exercise base. CPU must stay within the YouTube reference at both sizes.
- **G5:** unchanged.
- **Frames for Kyle before merging:**
  - each place's arrival and evening at full tier, side by side with today's;
  - the four places together, to see the set read as one.

## Docs that change with it

- **`made/index.html`,** "The paintings": it would mention the finish, Motes' own painting pass. The wording is Kyle's call.
- **DESIGN.md:** the finish and the tiers under the paintings.
- **README:** the pipeline commands.
- **CLAUDE.md:** masters live in `art/scenes/`. Every painting, seasonal ones included, goes through the finish. Only the active place holds a high tier.
- **`ARTWORK.md`:** add the finish and the upscaler (Real-ESRGAN, BSD-3-Clause) to the provenance.

## Out of scope

- **New places:** a generator that prompts in this style is its own spec. Whatever it makes goes through the same finish.
- **Live effects:** no change to rain, water, light or motion.

## For Kyle

1. **Local Real-ESRGAN** for the upscale (recommended: free, private, deterministic), or a hosted upscaler through fal like chassis uses (some cost and a key; the creative upscalers add detail the brush then removes).
2. **Stop serving the PNG masters** (recommended), or keep an unfinished PNG as the last-resort format.
