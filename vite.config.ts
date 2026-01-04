import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist-renderer",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  resolve: {
    // alias: {
    //   "decode-named-character-reference":
    //     "./node_modules/decode-named-character-reference/index.js",
    // },
  },
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes("/node_modules/shiki/") ||
            id.includes("/node_modules/@shikijs/") ||
            id.includes("/node_modules/vscode-textmate/") ||
            id.includes("/node_modules/vscode-oniguruma/")
          ) {
            return "syntax-highlighter";
          }
        },
      },
    },
  },
});
