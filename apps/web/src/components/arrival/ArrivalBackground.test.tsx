import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArrivalBackground } from "./ArrivalBackground.js";
import { ArrivalLayout } from "./ArrivalLayout.js";
import {
  AFRICA_CAPITALS,
  AFRICA_CITIES,
  AFRICA_OUTLINE_HEIGHT,
  AFRICA_OUTLINE_WIDTH,
} from "./africaOutline.js";
import { NETWORK_ARCS } from "./networkLayout.js";

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
      expect(container.querySelectorAll(".africa-watermark svg > path")).toHaveLength(1);
      const layer = container.querySelector(".africa-watermark")!.parentElement!;
      expect(layer.classList.contains("max-md:hidden")).toBe(motion === "calm");
      unmount();
    }
  });

  it("pose le réseau des capitales sur l'accueil, nulle part ailleurs", () => {
    const rich = render(<ArrivalBackground motion="rich" />);
    expect(rich.container.querySelectorAll(".capital-dot")).toHaveLength(AFRICA_CAPITALS.length);
    expect(rich.container.querySelectorAll(".city-dot")).toHaveLength(AFRICA_CITIES.length);
    expect(rich.container.querySelectorAll(".network-arc")).toHaveLength(NETWORK_ARCS.length);
    expect(rich.container.querySelectorAll(".network-glow")).toHaveLength(3);
    rich.unmount();

    const calm = render(<ArrivalBackground motion="calm" />);
    expect(calm.container.querySelector(".network-dot, .network-arc, .network-glow")).toBeNull();
  });

  it("envoie une lueur sur un autre arc à la fin de chaque voyage", () => {
    const { container } = render(<ArrivalBackground motion="rich" />);
    const glow = container.querySelector(".network-glow")!;
    const before = glow.querySelector("path")!.getAttribute("d");
    fireEvent.animationIteration(glow);
    const paths = [...glow.querySelectorAll("path")].map((path) => path.getAttribute("d"));
    expect(paths[0]).not.toBe(before);
    expect(new Set(paths).size).toBe(1);
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

  // Continent à l'échelle 1 (une unité de la boîte, un pixel), carte au
  // centre-est, sur Khartoum. Un point est placé d'après son style ; le logo Python du
  // téléphone est posé sur Dakar, tout autre élément du décor loin de tout.
  function mockLayout() {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const style = (this as HTMLElement).style;
      if (this.classList.contains("arrival-glass")) return rect(600, 300, 300, 200);
      if (this.classList.contains("africa-watermark-network")) {
        return rect(0, 0, AFRICA_OUTLINE_WIDTH, AFRICA_OUTLINE_HEIGHT);
      }
      if (this.classList.contains("network-dot")) {
        const x = (parseFloat(style.left) / 100) * AFRICA_OUTLINE_WIDTH;
        const y = (parseFloat(style.top) / 100) * AFRICA_OUTLINE_HEIGHT;
        return rect(x - 3, y - 3, 6, 6);
      }
      if (this.classList.contains("arrival-decor-item")) {
        return style.left === "16%" && style.top === "45%"
          ? rect(dakar.x - 20, dakar.y - 20, 40, 40)
          : rect(5000, 5000, 40, 40);
      }
      return rect(0, 0, 0, 0);
    });
  }

  const dakar = AFRICA_CAPITALS.find((capital) => capital.id === "dakar")!;

  function dot(container: HTMLElement, id: string) {
    const capital = AFRICA_CAPITALS.find((place) => place.id === id)!;
    const left = `${((capital.x / AFRICA_OUTLINE_WIDTH) * 100).toFixed(2)}%`;
    return [...container.querySelectorAll<HTMLElement>(".capital-dot")].find(
      (element) => element.style.left === left,
    )!;
  }

  it("atténue les capitales et les lueurs que la carte couvre, garde les autres", () => {
    mockLayout();
    const { container } = render(<ArrivalLayout motion="rich">contenu</ArrivalLayout>);
    expect(dot(container, "khartoum").hasAttribute("data-covered")).toBe(true);
    expect(dot(container, "dakar").hasAttribute("data-covered")).toBe(false);
    expect(dot(container, "pretoria").hasAttribute("data-covered")).toBe(false);

    const zone = container.querySelector(".network-covered-zone")!;
    expect(["x", "y", "width", "height"].map((name) => zone.getAttribute(name))).toEqual([
      "600",
      "300",
      "300",
      "200",
    ]);
  });

  it("cache un élément du décor posé sur le réseau", () => {
    mockLayout();
    const { container } = render(<ArrivalLayout motion="rich">contenu</ArrivalLayout>);
    const clashing = [...container.querySelectorAll("[data-clash]")];
    expect(clashing).toHaveLength(1);
    expect(clashing[0]!.querySelector('img[src*="python"]')).not.toBeNull();
  });

  function root(container: HTMLElement) {
    return container.querySelector(".arrival-root")!;
  }

  it("pose les logos en couleur sur l'accueil, en blanc ailleurs", () => {
    const rich = render(<ArrivalLayout motion="rich">contenu</ArrivalLayout>);
    expect(rich.container.querySelector('.arrival-tile img[src*="python"]')).not.toBeNull();
    expect(rich.container.querySelector(".arrival-tile")).not.toBeNull();
    rich.unmount();

    const calm = render(<ArrivalLayout motion="calm">contenu</ArrivalLayout>);
    expect(calm.container.querySelector(".arrival-tile")).toBeNull();
    expect(calm.container.querySelector(".arrival-decor-calm")).not.toBeNull();
    expect(calm.container.querySelector(".arrival-decor-calm img")).toBeNull();
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
