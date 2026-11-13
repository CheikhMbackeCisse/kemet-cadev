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

createRoot(root).render(
  <StrictMode>
    {/* Un seul trait pour toutes les icônes (DESIGN.md). */}
    <LucideProvider strokeWidth={1.75}>
      <App />
    </LucideProvider>
  </StrictMode>,
);
