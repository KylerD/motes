// screenshot.mjs — Takes a single screenshot of the landing page after the world has populated.
// Usage: node scripts/screenshot.mjs [wait-seconds] [output-file]

import { chromium } from "playwright";
import { createServer } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const waitSec = parseInt(process.argv[2] || "8", 10);
const outFile = process.argv[3] || "captures-landing/page.png";

async function main() {
  const server = await createServer({
    root: projectRoot,
    server: { port: 5199, strictPort: true },
    logLevel: "warn",
  });
  await server.listen();

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });

  await page.goto("http://localhost:5199/?speed=10");
  await page.click("canvas");
  await page.waitForTimeout(waitSec * 1000);
  await page.screenshot({ path: resolve(projectRoot, outFile), fullPage: true });
  console.log(`Saved: ${outFile}`);

  await browser.close();
  await server.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
