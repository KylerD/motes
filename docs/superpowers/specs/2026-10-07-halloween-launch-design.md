# Halloween launch readiness

Written 7 October 2026. The Halloween edition switches on by itself on 24 October. GOAL.md's Phase 1 launch is one clip per daily edition on TikTok/Reels/Shorts, plus Reddit, Show HN and Product Hunt. Three pieces, in order, each on its own branch.

## 1. "How Motes is made" (`feat/how-motes-is-made`)

The GOAL.md Phase 0 to-do. A plain, honest page that answers the questions launch readers will ask first: is the music AI, is the art AI, what does the code actually do, what is tracked.

**Who arrives, and what they need.** A sceptical reader from a Show HN, Reddit or Product Hunt link, or a listener who opened it from the place browser. They want three answers fast (is the music AI, is the art AI, what is tracked) and then the detail. Success: they can repeat those answers after thirty seconds and trust the rest. Mode: Read.

**Where.** `motes.sh/made/`, short enough to say aloud and to put in a Show HN post. It is a second Vite HTML entry (`made/index.html`, added to `build.rollupOptions.input`: the repo's Vite 6.4.1 form; newer Vite moved it to a top-level `input`, verified via Context7). It shares the fonts, tokens and brand assets but none of the app bundle: static HTML and CSS, so it loads instantly and has no canvas, audio or animation.

**Look: the panel, opened to a full page.** The page is the cream control book the app already uses, at reading size:

- Ink-deep ground. A slim masthead: the ivory logo (192px, 158px under 700px) as a link home, and a quiet "Open Motes" text link on the right.
- One cream paper sheet (the panels' `paper`, 16px radius, the panel shadow), at most 720px wide, 56px padding on desktop, 24px under 700px, 20px under 360px, 18px side insets. No cards, no stat boxes, no icons beyond the logo.
- Type: the title in the display style (EB Garamond 400, `clamp(38px,3.5vw,54px)`, −.025em); section headings in the title style (32px, 30px under 700px); body in Nunito Sans at **16px/1.65** in `paper-text`, a new reading size because 13–14px is for controls, not paragraphs; measure about 64ch; secondary notes and captions 12–13px in `paper-muted` (5.59:1). Links in `panel-link`, underlined with a 1px line offset 3px; focus is the panels' 2px brown outline offset 3px.
- **"In short"**, straight under the title: a three-row definition list (Music, Paintings, Privacy), each a serif term and one plain sentence, separated by `paper-line` rules. The reader gets the answers before the detail.
- **The one picture.** In "The paintings", Neon rain's arrival and evening paintings side by side (stacked under 520px) as two small figures, captioned "Arrival" and "Evening". Two separate images show "matched states" more honestly than a blend. They are derived by `encode-scenes.mjs` (640px wide WebP, lazy-loaded with explicit size), not drawn on.
- A dated footer line ("Updated 7 October 2026") and "Back to Motes".
- No motion of any kind; the 700px and 360px breakpoints follow DESIGN.md.

**Sections, in this order, each a short heading and two or three short paragraphs:**

1. **Intro.** One sentence: Motes is four painted places and music written while you listen. Then "In short".
2. **The music.** Composed live in your browser by a seeded engine (`src/music/`, MIT): the date seeds an hour of eighteen arrangements with themes, voice-led harmony and sections. The piano notes are CC0 recordings of a Kawai upright (FreePats); keys, mallets, bass, drums and all of synthwave are synthesised. No recorded songs or loops, and no AI music model. Link to the source.
3. **The paintings.** The disclosure (Kyle's wording call, drafted below). Sixteen images: four places with an arrival and an evening painting each, plus a Halloween pair for each place. Made with an AI image tool from written prompts, then edited into composition-matched states so masks, water and light line up. Every prompt is published in `ARTWORK.md`.
4. **What the code animates.** Light (each place's evening arc, sky, distance, foreground and water at their own pace over about fifty minutes), water (reflections sampling the current painting, ripples where you tap), weather (rain, snow, steam, pollen, fireflies) and events (a train, a boat, birds, butterflies, a passing shower). Seasonal objects are painted, never drawn over the art by code.
5. **Privacy.** No cookies, accounts or identifiers. A handful of milestone events (arrival and its `ref`, first Listen, 5/20/60 listening minutes, one engaged week, shares) go cookieless to PostHog's EU cloud. What the browser keeps (preferences; the week counter, per piece 2's decision). Nothing is sent under Global Privacy Control or Do Not Track. Fonts, paintings and piano are served from motes.sh.
6. **Licences.** App AGPL-3.0 (code up to `abf0a44` stays CC0); music engine MIT; paintings, masks, evening arcs and identity all rights reserved to the extent rights exist, plus TRADEMARKS.md; Mediabunny MPL-2.0; piano CC0; fonts OFL. Each links to its file on GitHub.

A quiet "Back to Motes" link closes the page. It and the masthead's "Open Motes" go to `/?ref=made`.

**Linked quietly.** One text link, "How Motes is made", in the place browser under "Take me to today's place": that panel shows the paintings, so the disclosure sits beside them. Styled like `#daily-place` (12px, `panel-link` colour), no badge. It **opens in a new tab** (`target="_blank" rel="noopener"`, with "opens in a new tab" for assistive technology), because following a link in the same tab would end the listener's music and evening. README links it too.

**Preview card.** `pages.ts` gains the page's meta (`madeMeta`: title "How Motes is made", a one-line description, path `/made/`). The build plugin rewrites `made/index.html`'s tags with `withMeta`, exactly like the place pages, so `pages.ts` stays the single source; `made/index.html` carries the same tag skeleton as `index.html`. The card `og/made.jpg` (1200×630) comes from `encode-scenes.mjs`: the four arrival paintings as four soft-edged vertical bands with the wordmark, built from the masters like the other cards, so it doesn't look like Neon rain's card. Nothing is drawn over a painting.

**Arrivals.** A one-line module (`made/made.ts`) sends one `$pageview` (with `ref` and `page: 'made'`) through `src/measure/analytics.ts`, so arrivals from the Show HN link are counted. No storage. "Open Motes" links to `/?ref=made`, so a reader who goes on to listen is attributed.

**Checks.**
- `tests/pages.test.ts`: the made page carries its own title, description, canonical, `og:url` and card, and the card file exists.
- `score.mjs`: G5 also scans `/made/` on desktop and phone; G6 counts six pages (home, four places, made).
- `verify-scenes.mjs`: the place browser's link points at `/made/` and opens in a new tab.
- Run the Impeccable detector once over the new page and panel change.
- Desktop and phone screenshots of the page and of the panel link, shown to Kyle with the disclosure wording **before merging**.

### Disclosure wording (to choose)

The page states the fact plainly in its first sentence and doesn't apologise or argue. Draft options go to Kyle with the screenshots; the chosen one goes into the page, README and DESIGN.md.

## 2. Analytics hardening (`feat/analytics-proxy`)

**(a) Proxy.** Add `vercel.json` with PostHog's documented Vercel rewrites (verified via Context7, `posthog.com/docs/advanced/proxy/vercel`), EU variant, specific paths before the catch-all:

```json
{ "rewrites": [
  { "source": "/ingest/static/:path(.*)", "destination": "https://eu-assets.i.posthog.com/static/:path" },
  { "source": "/ingest/array/:path(.*)", "destination": "https://eu-assets.i.posthog.com/array/:path" },
  { "source": "/ingest/:path(.*)", "destination": "https://eu.i.posthog.com/:path" }
] }
```

Cookieless mode hashes the visitor's IP, so the proxy must pass the client IP on. Vercel's proxy sets `x-forwarded-for`/`x-real-ip` on external rewrites; confirm after deploy that events carry real geo-IP, not a Vercel region for everyone. If they don't, every visitor with the same browser would share one daily hash and WEL would collapse: revert the host before anything else.

PostHog's proxy docs warn against obvious prefixes (`/analytics`, `/tracking`, `/telemetry`, `/posthog`). `/ingest` isn't on that list but is PostHog's own example path, so some blockers may learn it; it is Kyle's choice and easy to rename later if capture looks low.

**(b) Host.** Set production `VITE_POSTHOG_HOST=/ingest` on Vercel (`mote`, `kylerd-s-team`) *before* the merge, so the deploy that ships `vercel.json` also bakes the new host. Previews keep no analytics.

**(c) ePrivacy.** Research whether the `motes-week` localStorage counter needs consent under Art. 5(3), and recommend the smallest compliant option. Kyle decides; implement only on agreement.

**(d) Confirm.** Load motes.sh, listen, and check the `$pageview`/`listen_start` events arrive in PostHog EU project 295095 through `/ingest`, with plausible geo-IP. Also check whether local builds (which read `.env`) have been sending events from `127.0.0.1`; if so, gate sending to HTTPS origins so score runs stop polluting the data.

## 3. Launch kit (no shipped code; `captures/launch/`, gitignored)

- Render all eight Halloween clips: `node scripts/render-clip.mjs 2026-10-DD` for 24…31 (the day picks its place: 24 snow, 25 coast, 26 rain, 27 meadow, 28 snow, 29 coast, 30 rain, 31 meadow). Lofi, the default; check each against `verify-clip.mjs`'s criteria (15 s ± 0.05, 1080×1920 H.264, 450 frames, AAC 48 kHz stereo, fast start, darker at the end than the start, true peak ≤ −1 dBTP, louder than −30 LUFS). Run them only when no score run is in progress.
- One short caption per clip in Motes' voice: short, warm, no hype, no puns.
- A posting schedule: each clip goes out **on its own date**, when the home page shows that same place, so a viewer who follows the link finds what they just watched. TikTok, Reels and Shorts each day; Show HN, Reddit and Product Hunt on chosen days of the week.
- Drafts: Show HN (hook: the live-composed music engine; addresses the AI paintings head-on and links `/made/`), Reddit and Product Hunt.
- Every link carries `ref=` (`tiktok`, `reels`, `shorts`, `hn`, `reddit`, `producthunt`). TikTok and Instagram captions can't hold clickable links, so their `ref` link lives in the profile bio and the caption says "link in bio" at most; Shorts descriptions take the link directly.
- One Artifact page to work from: the clips' stills, captions, schedule and drafts, with copy buttons and a posted checklist that remembers what's done.

## Shipping each branch

`npm test`, `npm run build`, `npm run score -- --full` (no file edits while it runs), then merge to `main`, push, and confirm on motes.sh. Docs (README, DESIGN.md, PRODUCT.md, GOAL.md) change with the code they describe.
