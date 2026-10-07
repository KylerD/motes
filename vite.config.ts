import { defineConfig, type Plugin } from "vite";
import { SCENES, SCENE_IDS } from "./src/scenes/edition";
import { madeMeta, pageMeta, withMeta } from "./src/share/pages";

/** Emits /places/<slug>/index.html beside the home page, each with its own link
 * preview. The pages share the same app bundle; the path pins the place. The
 * made page takes its preview from pages.ts too. */
function placePages(): Plugin {
  return {
    name: "motes-place-pages",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"], made = bundle["made/index.html"];
      if (!index || index.type !== "asset") throw new Error("Place pages need the built index.html.");
      if (!made || made.type !== "asset") throw new Error("The made page is missing from the build.");
      made.source = withMeta(String(made.source), madeMeta);
      for (const scene of SCENE_IDS) {
        this.emitFile({ type: "asset", fileName: `places/${SCENES[scene].slug}/index.html`, source: withMeta(String(index.source), pageMeta(scene)) });
      }
    },
  };
}

export default defineConfig({
  build: {
    target: "es2020",
    rollupOptions: { input: { main: "index.html", made: "made/index.html" } },
  },
  plugins: [placePages()],
});
