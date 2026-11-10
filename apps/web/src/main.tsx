import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";
import { listenForInstallPrompt } from "./pwa/installPrompt.js";
import { watchForUpdate } from "./pwa/updatePrompt.js";

const root = document.getElementById("root");
if (!root) throw new Error("élément racine introuvable");

listenForInstallPrompt();
watchForUpdate();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
