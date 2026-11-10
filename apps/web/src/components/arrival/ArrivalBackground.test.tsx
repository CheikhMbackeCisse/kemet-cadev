import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArrivalBackground } from "./ArrivalBackground.js";
import { ArrivalLayout } from "./ArrivalLayout.js";

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("ArrivalBackground", () => {
  it("pose le continent entier sur chaque écran du parcours", () => {
    for (const motion of ["rich", "calm"] as const) {
      const { container, unmount } = render(<ArrivalBackground motion={motion} />);
      expect(container.querySelectorAll(".africa-watermark path")).toHaveLength(1);
      unmount();
    }
  });

  it("fait battre cinq capitales au plus sur l'accueil, aucune ailleurs", () => {
    const rich = render(<ArrivalBackground motion="rich" />);
    const capitals = rich.container.querySelectorAll(".capital-dot").length;
    expect(capitals).toBeGreaterThan(0);
    expect(capitals).toBeLessThanOrEqual(5);
    rich.unmount();

    const calm = render(<ArrivalBackground motion="calm" />);
    expect(calm.container.querySelector(".capital-dot")).toBeNull();
  });

  it("reste invisible pour un lecteur d'écran", () => {
    const { container } = render(<ArrivalBackground motion="rich" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ArrivalLayout", () => {
  afterEach(() => vi.restoreAllMocks());

  function root(container: HTMLElement) {
    return container.querySelector(".arrival-root")!;
  }

  it("pose les logos en couleur sur l'accueil, en blanc ailleurs", () => {
    const rich = render(<ArrivalLayout motion="rich">contenu</ArrivalLayout>);
    expect(rich.container.querySelector('svg[fill="#3776AB"]')).not.toBeNull();
    expect(rich.container.querySelector(".arrival-tile")).not.toBeNull();
    rich.unmount();

    const calm = render(<ArrivalLayout motion="calm">contenu</ArrivalLayout>);
    expect(calm.container.querySelector(".arrival-tile")).toBeNull();
    expect(calm.container.querySelector(".arrival-decor-calm")).not.toBeNull();
  });

  it("cache le décor aux lecteurs d'écran", () => {
    const { container } = render(<ArrivalLayout motion="rich">contenu</ArrivalLayout>);
    const bands = container.querySelectorAll(".arrival-band");
    expect(bands).toHaveLength(2);
    for (const band of bands) expect(band.getAttribute("aria-hidden")).toBe("true");
  });

  it("met l'animation en pause quand l'onglet est caché, puis la reprend", () => {
    const { container } = render(<ArrivalLayout motion="calm">contenu</ArrivalLayout>);
    expect(root(container).hasAttribute("data-paused")).toBe(false);

    setVisibility("hidden");
    expect(root(container).hasAttribute("data-paused")).toBe(true);

    setVisibility("visible");
    expect(root(container).hasAttribute("data-paused")).toBe(false);
  });

  it("reste immobile en économie de données", () => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    });
    try {
      const { container } = render(<ArrivalLayout motion="rich">contenu</ArrivalLayout>);
      expect(root(container).hasAttribute("data-still")).toBe(true);
    } finally {
      Reflect.deleteProperty(navigator, "connection");
    }
  });

  it("s'anime sur une connexion normale", () => {
    const { container } = render(<ArrivalLayout motion="rich">contenu</ArrivalLayout>);
    expect(root(container).hasAttribute("data-still")).toBe(false);
  });
});
