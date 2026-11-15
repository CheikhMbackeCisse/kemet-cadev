import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LucideProvider } from "lucide-react";
import { App } from "./App.js";
import "./index.css";
import { listenForInstallPrompt } from "./pwa/installPrompt.js";
import { watchForUpdate } from "./pwa/updatePrompt.js";
import { trackInputModality } from "./lib/inputModality.js";

const root = document.getElementById("root");
if (!root) throw new Error("élément racine introuvable");

listenForInstallPrompt();
watchForUpdate();
trackInputModality();

// En production, la feuille de style est préchargée sans bloquer l'affichage
// (src/vite/deferAppStylesheet.ts) : l'accueil statique d'index.html se
// peint avant elle. React attend qu'elle soit appliquée pour ne rien montrer
// sans style.
function applyAppStylesheet(): Promise<void> {
  const preload = document.querySelector<HTMLLinkElement>("link[data-app-stylesheet]");
  if (!preload) return Promise.resolve();
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = preload.href;
  if (preload.crossOrigin !== null) stylesheet.crossOrigin = preload.crossOrigin;
  return new Promise((resolve) => {
    stylesheet.addEventListener("load", () => resolve(), { once: true });
    stylesheet.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(stylesheet);
  });
}

void applyAppStylesheet().then(() => {
  createRoot(root).render(
    <StrictMode>
      {/* Un seul trait pour toutes les icônes (DESIGN.md). */}
      <LucideProvider strokeWidth={1.75}>
        <App />
      </LucideProvider>
    </StrictMode>,
  );
});
