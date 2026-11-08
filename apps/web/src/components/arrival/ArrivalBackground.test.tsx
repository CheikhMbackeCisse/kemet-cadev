import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArrivalBackground } from "./ArrivalBackground.js";

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("ArrivalBackground", () => {
  afterEach(() => vi.restoreAllMocks());

  it("compte seize éléments flottants au plus", () => {
    const { container } = render(<ArrivalBackground motion="rich" />);
    expect(container.querySelectorAll(".arrival-float").length).toBeLessThanOrEqual(16);
  });

  it("met l'animation en pause quand l'onglet est caché, puis la reprend", () => {
    const { container } = render(<ArrivalBackground motion="calm" />);
    const background = container.querySelector(".arrival-background")!;
    expect(background.hasAttribute("data-paused")).toBe(false);

    setVisibility("hidden");
    expect(background.hasAttribute("data-paused")).toBe(true);

    setVisibility("visible");
    expect(background.hasAttribute("data-paused")).toBe(false);
  });

  it("reste invisible pour un lecteur d'écran", () => {
    const { container } = render(<ArrivalBackground motion="rich" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
