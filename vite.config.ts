import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/socket.io": { target: backend, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: "dist",
  },
});
