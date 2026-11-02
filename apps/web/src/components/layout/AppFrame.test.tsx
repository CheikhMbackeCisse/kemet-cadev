import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../ui/Tooltip.js";
import { AppFrame } from "./AppFrame.js";

const session = vi.hoisted(() => ({
  value: {
    status: "ready",
    profile: null as null | Record<string, string>,
    isPlatformAdmin: false,
  },
}));

vi.mock("../../session/SessionProvider.js", () => ({
  useSession: () => ({ ...session.value, isSuspended: false, signOut: vi.fn() }),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function stubViewport(width: number) {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
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

function renderFrame(withPanel: boolean, activeSection = "salons") {
  return render(
    <TooltipProvider>
      <AppFrame
        activeSection={activeSection}
        activeMobileTab={activeSection}
        sidePanel={
          withPanel
            ? { title: "Salons", content: <button type="button">général</button> }
            : undefined
        }
      >
        <main>contenu</main>
      </AppFrame>
    </TooltipProvider>,
  );
}

function activityBar() {
  return screen.getByRole("navigation", { name: "Sections" });
}

describe("cadre de bureau", () => {
  beforeEach(() => {
    window.localStorage.clear();
    session.value = {
      status: "ready",
      profile: { displayName: "Awa Ndiaye", handle: "awa-ndiaye" },
      isPlatformAdmin: false,
    };
    stubViewport(1440);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("replie et rouvre le panneau par l'icône de la section ouverte", () => {
    renderFrame(true);
    const toggle = within(activityBar()).getByRole("button", { name: "Salons" });
    const panel = screen.getByRole("complementary", { name: "Salons" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-current", "page");
    expect(panel).toHaveClass("visible");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveClass("invisible");
    expect(window.localStorage.getItem("kemet:side-panel")).toBe("closed");

    fireEvent.click(toggle);
    expect(panel).toHaveClass("visible");
  });

  it("rend le focus à l'icône de la section quand Ctrl+B replie le panneau", () => {
    renderFrame(true);
    const inside = screen.getByRole("button", { name: "général" });
    inside.focus();

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    expect(within(activityBar()).getByRole("button", { name: "Salons" })).toHaveFocus();
  });

  it("garde les sections en liens et Ctrl+B libre sur une page sans panneau", () => {
    renderFrame(false, "skills");
    const skills = within(activityBar()).getByRole("link", { name: "Skills" });
    expect(skills).toHaveAttribute("href", "/skills");
    expect(skills).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("se parcourt aux flèches avec un seul arrêt de tabulation", () => {
    renderFrame(false, "fil");
    const bar = activityBar();
    const items = [...within(bar).getAllByRole("link"), ...within(bar).queryAllByRole("button")];
    const tabStops = items.filter((item) => item.tabIndex === 0);
    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]).toHaveAccessibleName("Fil");

    tabStops[0]!.focus();
    fireEvent.keyDown(tabStops[0]!, { key: "ArrowDown" });
    expect(within(bar).getByRole("link", { name: "Salons" })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(within(bar).getByRole("link", { name: "Paramètres" })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(within(bar).getByRole("link", { name: "Fil" })).toHaveFocus();
  });

  it("propose la connexion à un visiteur au pied de la barre", () => {
    session.value = { status: "visitor", profile: null, isPlatformAdmin: false };
    renderFrame(false, "fil");
    const barColumn = activityBar().parentElement!;
    expect(within(barColumn).getByRole("link", { name: "Se connecter" })).toHaveAttribute(
      "href",
      "/connexion",
    );
  });
});
