import { afterEach, describe, expect, it } from "vitest";
import { trackInputModality } from "./inputModality.js";

describe("trackInputModality", () => {
  let stop: () => void = () => {};
  afterEach(() => {
    stop();
    delete document.documentElement.dataset.input;
  });

  it("part du pointeur, passe au clavier sur une touche et revient au clic", () => {
    stop = trackInputModality();
    const root = document.documentElement;
    expect(root.dataset.input).toBe("pointer");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(root.dataset.input).toBe("keyboard");

    document.dispatchEvent(new Event("pointerdown"));
    expect(root.dataset.input).toBe("pointer");
  });

  it("ignore un raccourci avec Ctrl, Cmd ou Alt", () => {
    stop = trackInputModality();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
    expect(document.documentElement.dataset.input).toBe("pointer");
  });
});
