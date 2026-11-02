import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isToggleSidePanelShortcut,
  readSidePanelPreference,
  SidePanelProvider,
  useSidePanel,
  writeSidePanelPreference,
} from "./sidePanel.js";

function stubViewport(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const minWidth = Number(/min-width: (\d+)px/.exec(query)?.[1] ?? 0);
    return {
      matches: width >= minWidth,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });
}

function Probe() {
  const { open, toggle } = useSidePanel();
  return (
    <button type="button" onClick={toggle}>
      {open ? "ouvert" : "fermé"}
    </button>
  );
}

function renderPanel() {
  return render(
    <SidePanelProvider>
      <Probe />
    </SidePanelProvider>,
  );
}

describe("panneau latéral", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("est ouvert par défaut à partir de 1280 px et replié en dessous", () => {
    stubViewport(1440);
    const { unmount } = renderPanel();
    expect(screen.getByRole("button")).toHaveTextContent("ouvert");
    unmount();

    stubViewport(1100);
    renderPanel();
    expect(screen.getByRole("button")).toHaveTextContent("fermé");
  });

  it("se replie par Ctrl+B et retrouve ce choix au prochain chargement", () => {
    stubViewport(1440);
    const { unmount } = renderPanel();
    act(() => {
      fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    });
    expect(screen.getByRole("button")).toHaveTextContent("fermé");
    unmount();

    renderPanel();
    expect(screen.getByRole("button")).toHaveTextContent("fermé");
  });

  it("ignore le raccourci sur mobile et tablette", () => {
    stubViewport(800);
    renderPanel();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(window.localStorage.getItem("kemet:side-panel")).toBeNull();
  });

  it("reconnaît Ctrl+B et Cmd+B, pas Ctrl+Maj+B", () => {
    expect(
      isToggleSidePanelShortcut(new KeyboardEvent("keydown", { key: "b", ctrlKey: true })),
    ).toBe(true);
    expect(
      isToggleSidePanelShortcut(new KeyboardEvent("keydown", { key: "B", metaKey: true })),
    ).toBe(true);
    expect(
      isToggleSidePanelShortcut(
        new KeyboardEvent("keydown", { key: "B", ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(false);
    expect(isToggleSidePanelShortcut(new KeyboardEvent("keydown", { key: "b" }))).toBe(false);
  });

  it("tient sans stockage disponible", () => {
    const broken = {
      getItem: () => {
        throw new Error("indisponible");
      },
      setItem: () => {
        throw new Error("indisponible");
      },
    } as unknown as Storage;
    expect(readSidePanelPreference(broken)).toBeNull();
    expect(() => writeSidePanelPreference(broken, "closed")).not.toThrow();
  });
});
