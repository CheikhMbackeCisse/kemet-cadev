import { describe, expect, it } from "vitest";
import { shellAssetsOf } from "../pwa/precache-shell.js";
import { deferStylesheetTag } from "./deferAppStylesheet.js";

describe("deferStylesheetTag", () => {
  const html =
    '<head><link rel="stylesheet" crossorigin href="/assets/index-BxVrpDDB.css"></head>';

  it("précharge la feuille de l'application au lieu de la charger en bloquant", () => {
    expect(deferStylesheetTag(html)).toBe(
      '<head><link rel="preload" as="style" crossorigin href="/assets/index-BxVrpDDB.css" data-app-stylesheet></head>',
    );
  });

  it("garde la feuille dans la précache du service worker", () => {
    expect(shellAssetsOf(deferStylesheetTag(html)).has("assets/index-BxVrpDDB.css")).toBe(true);
  });

  it("ne touche pas aux autres feuilles", () => {
    const other = '<link rel="stylesheet" href="/assets/other-x.css">';
    expect(deferStylesheetTag(other)).toBe(other);
  });
});
