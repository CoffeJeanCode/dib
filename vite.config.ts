import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@/components": path.resolve(__dirname, "src/components"),
      "@/features": path.resolve(__dirname, "src/features"),
      "@/hooks": path.resolve(__dirname, "src/hooks"),
      "@/services": path.resolve(__dirname, "src/services"),
      "@/utils": path.resolve(__dirname, "src/utils"),
      "@/types": path.resolve(__dirname, "src/types"),
      "@/constants": path.resolve(__dirname, "src/constants"),
    },
  },
  build: {
    // No manualChunks on purpose. Naming monaco/xyflow as static chunks made
    // Rollup treat them as eager dependencies of the entry, so the lazy()
    // boundaries around SqlEditor, JsonViewer and SchemaVisualizer emitted
    // separate files that index.html modulepreloaded anyway. Letting Rollup
    // split on the dynamic import boundaries is what actually defers them.
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
