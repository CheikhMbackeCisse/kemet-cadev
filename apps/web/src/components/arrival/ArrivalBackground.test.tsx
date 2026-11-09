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

  it("compte vingt et un éléments flottants au plus, onze sur téléphone", () => {
    const { container } = render(<ArrivalBackground motion="rich" />);
    const items = container.querySelectorAll(".arrival-float");
    expect(items.length).toBeLessThanOrEqual(21);
    const onPhone = [...items].filter((item) => !item.classList.contains("max-md:hidden"));
    expect(onPhone.length).toBeLessThanOrEqual(11);
  });

  it("pose le réseau des capitales sur l'accueil, logos dans leurs couleurs", () => {
    const { container } = render(<ArrivalBackground motion="rich" />);
    expect(container.querySelectorAll(".capital-dot").length).toBeGreaterThanOrEqual(30);
    expect(container.querySelectorAll(".network-link").length).toBeGreaterThanOrEqual(40);
    expect(container.querySelector('svg[fill="#3776AB"]')).not.toBeNull();
  });

  it("garde le fond discret ailleurs dans le parcours", () => {
    const { container } = render(<ArrivalBackground motion="calm" />);
    expect(container.querySelector(".capital-dot")).toBeNull();
    expect(container.querySelector(".arrival-tile")).toBeNull();
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

  it("reste immobile en économie de données", () => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    try {
      const { container } = render(<ArrivalBackground motion="rich" />);
      expect(container.querySelector(".arrival-background")!.hasAttribute("data-still")).toBe(true);
    } finally {
      Reflect.deleteProperty(navigator, "connection");
    }
  });

  it("s'anime sur une connexion normale", () => {
    const { container } = render(<ArrivalBackground motion="rich" />);
    expect(container.querySelector(".arrival-background")!.hasAttribute("data-still")).toBe(false);
  });
});
