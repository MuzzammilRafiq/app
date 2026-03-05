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
  optimizeDeps: {
    exclude: ["parakeet.js", "onnxruntime-web"],
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
          if (id.includes("/node_modules/parakeet.js/")) {
            return "parakeet";
          }
          if (id.includes("/node_modules/onnxruntime-web/")) {
            return "onnxruntime";
          }
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
