# CC0 Pixel Art Character Generator

A 32x32 pixel art character generator built from a compositable trait library. Every character is assembled from layered traits — heads, bodies, accessories, eyes, mouths, and backgrounds — drawn from five archetype families: Wanderer, Merchant, Militant, Scholar, and Outcast. The entire output is released under CC0. No rights reserved. Use the characters for anything you want — games, avatars, print, commercial projects, derivatives. No attribution required.

## Licence

All generated characters and all trait art in this repository are released under **CC0 1.0 Universal (Public Domain Dedication)**. You can copy, modify, distribute, and use the work, even for commercial purposes, without asking permission. See [LICENSE](LICENSE) for the full legal text.

## Using the Generator

The generator is available as a static site. Access it at:

```
https://<username>.github.io/mote/
```

Select traits from each layer to compose a character, then download the result as a 32x32 PNG. Share links encode your trait selections in the URL so you can send specific characters to others.

## How the Agent Works

An automated agent runs on a daily cron schedule. On each run, it reads the project manifesto, reviews the trait library and community usage signals, and opens a pull request with up to 3 targeted changes — new traits, trait adjustments, or deprecation proposals. Every PR includes a written rationale citing the signals and design reasoning behind each change. Human maintainers review and merge.

## Contributing

Contributions are welcome. The best way to get involved:

- **Request a trait:** Open an issue with the `trait-request` label. Describe the trait, which archetype family it belongs to, and why it would improve the library.
- **Report a bug:** Open an issue with the `bug` label. Include screenshots or share links if relevant.

## Running Locally

Clone the repository and start the Vite dev server:

```bash
git clone https://github.com/<username>/mote.git
cd mote
npm install
npx vite
```

The generator will be available at `http://localhost:5173`. Trait files are loaded from the `traits/` directory. Changes to trait PNGs or registry metadata will hot-reload in the browser.
