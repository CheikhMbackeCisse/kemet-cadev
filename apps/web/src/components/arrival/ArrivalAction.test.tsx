import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArrivalAction } from "./ArrivalAction.js";

type Callback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;

let notify: Callback = () => {};

class IntersectionObserverStub {
  constructor(callback: Callback) {
    notify = callback;
  }
  observe() {}
  disconnect() {}
}

function renderAction() {
  return render(
    <form className="relative">
      <ArrivalAction>
        <button type="submit">Continuer</button>
      </ArrivalAction>
    </form>,
  );
}

function stuck(container: HTMLElement) {
  return container.querySelector(".arrival-action")!.hasAttribute("data-stuck");
}

describe("ArrivalAction", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pose son fond quand sa place normale est sous le bord de l'écran, le retire ensuite", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
    const { container } = renderAction();
    const rootBounds = { bottom: 664 } as DOMRectReadOnly;

    act(() =>
      notify([
        { isIntersecting: false, rootBounds, boundingClientRect: { top: 780 } as DOMRectReadOnly },
      ]),
    );
    expect(stuck(container)).toBe(true);

    act(() =>
      notify([
        { isIntersecting: true, rootBounds, boundingClientRect: { top: 600 } as DOMRectReadOnly },
      ]),
    );
    expect(stuck(container)).toBe(false);
  });

  it("ne se décolle pas quand le formulaire est passé au-dessus de l'écran", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
    const { container } = renderAction();
    act(() =>
      notify([
        {
          isIntersecting: false,
          rootBounds: { bottom: 664 } as DOMRectReadOnly,
          boundingClientRect: { top: -40 } as DOMRectReadOnly,
        },
      ]),
    );
    expect(stuck(container)).toBe(false);
  });

  it("garde le bouton à sa place sans IntersectionObserver", () => {
    const { container, getByRole } = renderAction();
    expect(getByRole("button", { name: "Continuer" })).toBeTruthy();
    expect(stuck(container)).toBe(false);
  });
});
