import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArrivalBackground } from "./ArrivalBackground.js";
import { ArrivalLayout } from "./ArrivalLayout.js";

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("ArrivalBackground", () => {
  it("pose le continent entier sur chaque écran du parcours, rien sous la carte calme d'un téléphone", () => {
    for (const motion of ["rich", "calm"] as const) {
      const { container, unmount } = render(<ArrivalBackground motion={motion} />);
      expect(container.querySelectorAll(".africa-watermark path")).toHaveLength(1);
      const layer = container.querySelector(".africa-watermark")!.parentElement!;
      expect(layer.classList.contains("max-md:hidden")).toBe(motion === "calm");
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

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

describe("ArrivalLayout", () => {
  beforeEach(() => vi.stubGlobal("ResizeObserver", ResizeObserverStub));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("cache les capitales que la carte couvre, garde les autres", () => {
    // Carte de 400 x 300 au centre d'un écran de 1440 x 900 ; Dakar loin à
    // gauche, toutes les autres capitales sous la carte.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      if (this.classList.contains("arrival-glass")) return rect(520, 300, 400, 300);
      if (this.classList.contains("capital-dot")) {
        return (this as HTMLElement).style.left === "0.13%"
          ? rect(100, 330, 6, 6)
          : rect(700, 450, 6, 6);
      }
      return rect(0, 0, 0, 0);
    });
    const { container } = render(<ArrivalLayout motion="rich">contenu</ArrivalLayout>);
    const dots = [...container.querySelectorAll(".capital-dot")];
    expect(dots.filter((dot) => !dot.hasAttribute("data-covered"))).toHaveLength(1);
  });

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
