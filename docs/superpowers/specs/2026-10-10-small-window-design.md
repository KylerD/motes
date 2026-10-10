# A small window (picture-in-picture)

Written 10 October 2026. GOAL.md's Phase 1 lists picture-in-picture. Most listeners keep Motes on a second monitor or in a hidden tab (direction of 9 Oct), so the painting is out of sight for most of an hour. A small always-on-top window keeps the place in the corner of the screen while they work, the way people keep a lofi stream in picture-in-picture. It should raise settling (first sessions that reach 20 minutes) and, through it, Weekly Engaged Listeners.

## What the listener sees

- **One header action**, an icon button beside fullscreen in the same toasted-brown style: a window with a smaller window in its corner. Its label and title are **Keep this place in a small window**; while the window is open, **Bring this place back**. It exists only where the browser supports Document Picture-in-Picture (Chrome and Edge on desktop), and, like fullscreen, it is hidden at 700px and narrower. Every other browser sees exactly today's header.
- **The small window** opens at 512 × 288 (16:9, the paintings' shape; Chrome remembers any size and position the listener gives it). It shows only the living painting, cover-cropped like the page, with every crop rule, mask and light unchanged. One control sits 12px in from the bottom-left corner: the radio's Listen action reduced to its icon, a 44px amber square with the radio's 10px corners, ink play/pause glyph, cream focus outline and the same Listen to music / Pause music labels. It is always visible while the music is paused; while playing it appears only on hover or keyboard focus (a 160ms fade, none under reduced motion), so the picture stays clean. Space toggles the music there too, and water taps ripple as on the page. The window's document is `lang="en"` and titled with the place (`Neon rain · Motes`). Chrome adds its own "back to tab" and close buttons.
- **The page, while the place is away:** the controls stay where they are and keep working. The painting area rests on the place's own deep colour (the colour the renderer paints under the art), and the loading card's ink surface, in the same spot and type, says **This place is in its small window.** above a **Bring it back** button styled like Try again. The loading/failure card is hidden while the place is away. Hide controls and fullscreen disappear while the place is away, since there is no scene to show. Closing the window any way at all (our buttons, Chrome's close, Chrome's back to tab) returns the place to the page as it was, and keyboard focus to the header action when it was in the card.

## How it works

- **One canvas, moved rather than copied.** Opening the window moves the existing scene canvas into it, and closing moves it back. There is still one renderer, one lighting composite and one set of decoded paintings, so the CPU gate and the bounded-memory rules hold unchanged. A second render would double the picture's cost.
- **Painting follows the window that shows the canvas.** Today painting stops while the tab is hidden. With the place away, the page's visibility no longer matters; painting is scheduled with the small window's own `requestAnimationFrame` and timers (a hidden tab's timers are throttled) and stops only if that window is hidden. The frame budget and the still-picture checks are unchanged. Visual time keeps using the page's `performance.now()`, because the two windows have different time origins.
- **Size and sharpness follow the small window.** The renderer already measures the canvas each frame. It also listens for the small window's resizes and takes the device pixel ratio from the window that holds the canvas. A full tier already held stays, since it is the active place's and is released as usual on leaving; a small window never asks for one.
- **Styles** come from the page's own stylesheets, copied into the small window with a `<base>` so fonts and paths resolve. The small window's rules live in `src/style.css` under `.small-window`.
- **Painting gate.** Both documents' `visibilitychange` call the same handler; painting runs while the document that holds the canvas is visible. That one rule replaces today's `document.hidden` checks.
- **Sound.** Opening the window takes a click on the page, which gives the page the sticky user activation the audio needs, so Listen inside the small window can start the music even if it is pressed there first.
- **Lifecycle.** One small window at a time; the action toggles it. If the browser refuses (no user activation, another tab's window), the status says **The small window couldn't open. The place is still here.** Changing place or day, Still, reduced motion, pause and after hours work exactly as on the page. Clips are untouched: they render on their own canvas. Leaving the page closes the small window with it (the browser does this).
- **Code:** `src/scenes/small-window.ts` opens the window, moves the canvas, builds the Listen button and restores everything on close; it keeps no module state and hands back a handle. `main.ts` wires it into painting, the player and the header. TypeScript's DOM library leaves out Chromium-only APIs, so the module declares the small part of `documentPictureInPicture` it uses (verified via context7, `/wicg/document-picture-in-picture`: `requestWindow({width,height})` needs a user gesture and rejects with NotAllowedError or NotSupportedError; the window fires `pagehide` when it closes).

## Not now

- **Opening by itself when the listener switches tabs** (the Media Session `enterpictureinpicture` action). It would be a surprise, which Motes avoids; revisit once the `small_window` count shows people want it.
- A second, separately sized render for the small window, or captions and track names in it. The small window is the picture and one control.

## Measurement

One milestone event, `small_window`, the first time a page opens it, with the place. It counts how many listen starts lead to the small window. How Motes is made lists it with the other events. No other tracking.

## Checks

- `scripts/verify-small-window.mjs` (desktop Chromium on localhost): the action appears only where the API exists; it opens a window holding the canvas, which keeps painting at the window's size while the page reports itself hidden; the Listen button there starts and pauses the music; the page shows the resting card with focusable Bring it back; closing by our button and by closing the window returns the canvas, which paints at the page's size again; the action is absent at 390px and when the API is missing; no errors.
- `npm test`, `npm run build`, `npm run score` (G5 now meets the new action and card).
- A real tab switch in Chrome with the small window open: the painting keeps moving while the Motes tab is hidden, and the music carries on.
- Desktop and phone screenshots of the header, the small window and the resting page.
