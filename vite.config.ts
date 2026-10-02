import { defineConfig, type Plugin } from "vite";
import { SCENES, SCENE_IDS } from "./src/scenes/edition";
import { pageMeta, withMeta } from "./src/share/pages";

/** Emits /places/<slug>/index.html beside the home page, each with its own link
 * preview. The pages share the same app bundle; the path pins the place. */
function placePages(): Plugin {
  return {
    name: "motes-place-pages",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (!index || index.type !== "asset") throw new Error("Place pages need the built index.html.");
      for (const scene of SCENE_IDS) {
        this.emitFile({ type: "asset", fileName: `places/${SCENES[scene].slug}/index.html`, source: withMeta(String(index.source), pageMeta(scene)) });
      }
    },
  };
}

export default defineConfig({
  build: {
    target: "es2020",
  },
  plugins: [placePages()],
});
