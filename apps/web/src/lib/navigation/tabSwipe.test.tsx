import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifySwipe,
  isSwipeBlocked,
  neighbourTab,
  useInnerTabSwipe,
  useTabSwipe,
} from "./tabSwipe.js";
import { navigate } from "./navigate.js";

vi.mock("./navigate.js", () => ({ navigate: vi.fn() }));

function point(x: number, y = 300, time = 0) {
  return { x, y, time };
}

function touch(target: Element, type: "touchstart" | "touchend", x: number, y = 300) {
  const event = new Event(type, { bubbles: true });
  const list = [{ clientX: x, clientY: y }];
  Object.defineProperty(event, type === "touchstart" ? "touches" : "changedTouches", {
    value: list,
  });
  if (type === "touchend") Object.defineProperty(event, "touches", { value: [] });
  target.dispatchEvent(event);
}

function swipe(target: Element, fromX: number, toX: number) {
  touch(target, "touchstart", fromX);
  touch(target, "touchend", toX);
}

function stubScreen({ phone = true, reducedMotion = false } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width") ? phone : reducedMotion,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("classifySwipe", () => {
  it("reconnaît un geste franc vers la gauche ou la droite", () => {
    expect(classifySwipe(point(300), point(150, 310, 200))).toBe("next");
    expect(classifySwipe(point(100), point(250, 290, 200))).toBe("previous");
  });

  it("ignore un geste court, lent, trop vertical ou parti du bord", () => {
    expect(classifySwipe(point(300), point(250, 300, 100))).toBeNull();
    expect(classifySwipe(point(300), point(100, 300, 900))).toBeNull();
    expect(classifySwipe(point(300, 100), point(180, 200, 200))).toBeNull();
    expect(classifySwipe(point(10), point(200, 300, 200))).toBeNull();
  });
});

describe("isSwipeBlocked", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("laisse le geste aux champs, au code, aux dialogues et aux zones marquées", () => {
    document.body.innerHTML = `
      <input id="field" />
      <pre><span id="code">x</span></pre>
      <div role="dialog"><p id="dialog">x</p></div>
      <div data-no-tab-swipe><img id="gallery" /></div>
      <p id="text">x</p>`;
    for (const id of ["field", "code", "dialog", "gallery"]) {
      expect(isSwipeBlocked(document.getElementById(id))).toBe(true);
    }
    expect(isSwipeBlocked(document.getElementById("text"))).toBe(false);
  });

  it("laisse le geste à une rangée qui défile de côté", () => {
    document.body.innerHTML = `<div id="row" style="overflow-x: auto"><span id="chip">x</span></div>`;
    const row = document.getElementById("row")!;
    Object.defineProperty(row, "scrollWidth", { value: 800 });
    Object.defineProperty(row, "clientWidth", { value: 360 });
    expect(isSwipeBlocked(document.getElementById("chip"))).toBe(true);
  });
});

describe("neighbourTab", () => {
  it("suit l'ordre de la barre du bas sans en sortir", () => {
    expect(neighbourTab("fil", "next")).toBe("salons");
    expect(neighbourTab("salons", "previous")).toBe("fil");
    expect(neighbourTab("fil", "previous")).toBeNull();
    expect(neighbourTab("moi", "next")).toBeNull();
    expect(neighbourTab("", "next")).toBeNull();
  });
});

describe("useTabSwipe", () => {
  let surface: HTMLElement;

  beforeEach(() => {
    vi.mocked(navigate).mockClear();
    surface = document.createElement("p");
    document.body.append(surface);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("passe à l'onglet voisin sur téléphone", () => {
    stubScreen();
    renderHook(() => useTabSwipe(true, "fil"));
    swipe(surface, 300, 120);
    expect(navigate).toHaveBeenCalledWith("/salons");
  });

  it("ne fait rien sur ordinateur, avec le mouvement réduit ou dans un salon ouvert", () => {
    stubScreen({ phone: false });
    const desktop = renderHook(() => useTabSwipe(true, "fil"));
    swipe(surface, 300, 120);
    desktop.unmount();

    stubScreen({ reducedMotion: true });
    const reduced = renderHook(() => useTabSwipe(true, "fil"));
    swipe(surface, 300, 120);
    reduced.unmount();

    stubScreen();
    renderHook(() => useTabSwipe(false, "salons"));
    swipe(surface, 300, 120);

    expect(navigate).not.toHaveBeenCalled();
  });

  it("laisse les onglets internes prendre le geste, sauf au dernier", () => {
    stubScreen();
    const onValueChange = vi.fn();
    const values = ["pour-toi", "projets", "opportunites"];
    renderHook(() => useTabSwipe(true, "fil"));
    const inner = renderHook(({ value }) => useInnerTabSwipe(true, values, value, onValueChange), {
      initialProps: { value: "pour-toi" },
    });

    swipe(surface, 300, 120);
    expect(onValueChange).toHaveBeenCalledWith("projets", "next");
    expect(navigate).not.toHaveBeenCalled();

    inner.rerender({ value: "opportunites" });
    swipe(surface, 300, 120);
    expect(navigate).toHaveBeenCalledWith("/salons");
  });
});
