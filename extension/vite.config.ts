import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss(), crx({ manifest: manifest as never })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      // crx handles inputs from the manifest
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: { port: 5174 },
  },
});
