import { describe, expect, it } from "vitest";
import { routableHref } from "./navigate.js";

function anchor(html: string): HTMLAnchorElement {
  document.body.innerHTML = html;
  return document.querySelector("a")!;
}

describe("routableHref", () => {
  it("suit sans recharger un lien interne ordinaire", () => {
    expect(routableHref(anchor('<a href="/fil">Fil</a>'))).toBe("/fil");
  });

  it("laisse recharger un lien marqué data-full-reload", () => {
    expect(routableHref(anchor('<a data-full-reload href="/decouvrir?lang=en">EN</a>'))).toBeNull();
  });
});
