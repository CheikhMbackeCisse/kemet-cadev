import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3002", ws: true },
      "/realtime/health": {
        target: "http://localhost:3002",
        rewrite: (path) => path.replace(/^\/realtime/, ""),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Kemet",
        short_name: "Kemet",
        description: "La plateforme d'échange des développeurs africains.",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#0D1320",
        theme_color: "#1265DD",
        icons: [
          {
            src: "/brand/kemet-app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/brand/kemet-app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/brand/kemet-app-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
