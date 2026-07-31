import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { sites } from "./build/sites-vite-plugin";

function staticSitesWorker(): Plugin {
  let root = process.cwd();

  return {
    name: "static-sites-worker",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      await rm(resolve(root, "dist"), { recursive: true, force: true });
    },
    async closeBundle() {
      const serverDirectory = resolve(root, "dist", "server");

      await mkdir(serverDirectory, { recursive: true });
      await cp(
        resolve(root, "worker", "index.js"),
        resolve(serverDirectory, "index.js"),
      );
    },
  };
}

export default defineConfig({
  plugins: [vue(), sites(), staticSitesWorker()],
  build: {
    outDir: "dist/client",
    target: "es2022",
  },
});
