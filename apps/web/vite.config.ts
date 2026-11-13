import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fr } from "./src/i18n/fr.js";
import { SERVER_NAVIGATION_DENYLIST } from "./src/pwa/navigation-denylist.js";
import { keepShellEntries } from "./src/pwa/precache-shell.js";
import { preloadFonts } from "./src/vite/preloadFonts.js";

const outDir = resolve(import.meta.dirname, "dist");

export default defineConfig({
  server: {
    proxy: {
      // Développement seulement : permet de lancer l'API sur un autre port
      // quand 3001 est déjà pris sur le poste.
      "/api": process.env.API_PROXY_TARGET ?? "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3002", ws: true },
      "/realtime/health": {
        target: "http://localhost:3002",
        rewrite: (path) => path.replace(/^\/realtime/, ""),
      },
    },
  },
  plugins: [
    react(),
    preloadFonts(),
    VitePWA({
      // Une nouvelle version attend la fermeture de toutes les fenêtres de
      // Kemet : elle ne prend jamais la main sur un écran en cours de lecture.
      registerType: "prompt",
      workbox: {
        navigateFallbackDenylist: SERVER_NAVIGATION_DENYLIST,
        manifestTransforms: [
          (entries) => ({
            manifest: keepShellEntries(entries, readFileSync(resolve(outDir, "index.html"), "utf8")),
            warnings: [],
          }),
        ],
        runtimeCaching: [
          {
            // Noms de fichiers versionnés par Vite : une réponse en cache ne
            // devient jamais fausse, seulement inutile après un déploiement.
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "kemet-assets",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      manifest: {
        name: "Kemet",
        short_name: "Kemet",
        description: "La plateforme d'échange des développeurs africains.",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#0D1320",
        theme_color: "#0D1320",
        shortcuts: [
          { name: fr.install.shortcutPublish, url: "/fil/nouveau" },
          { name: fr.install.shortcutSpaces, url: "/salons" },
        ],
        icons: [
          {
            src: "/icons/app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/app-icon-maskable-512.png",
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
