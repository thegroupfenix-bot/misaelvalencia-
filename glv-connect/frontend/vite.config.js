import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth":      { target: "http://localhost:3001", changeOrigin: true },
      "/documents": { target: "http://localhost:3001", changeOrigin: true },
      "/audit":     { target: "http://localhost:3001", changeOrigin: true },
      "/users":     { target: "http://localhost:3001", changeOrigin: true },
    },
  },
  build: { outDir: "dist" },
});
