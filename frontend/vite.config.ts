import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker, the indexer API lives at the hostname "indexer".
// Override via VITE_API_URL env var to match the container network.
const apiTarget = process.env.VITE_API_URL || "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext"
  },
  server: { proxy: { "/api": "http://localhost:3001" } },
  test: { environment: "jsdom", globals: true, setupFiles: [] },
});
