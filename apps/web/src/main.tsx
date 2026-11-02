import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";
import { listenForInstallPrompt } from "./pwa/installPrompt.js";

const root = document.getElementById("root");
if (!root) throw new Error("élément racine introuvable");

listenForInstallPrompt();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
