import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../ui/Tooltip.js";
import { ActivityBar } from "./ActivityBar.js";
import { SidePanelProvider } from "./sidePanel.js";

let wide = false;
vi.mock("../../lib/useMediaQuery.js", () => ({ useMediaQuery: () => wide }));

vi.mock("../../lib/useSiteConfig.js", () => ({ useSiteConfig: () => null }));

vi.mock("../../session/SessionProvider.js", () => ({
  useSession: () => ({
    status: "ready",
    isPlatformAdmin: false,
    profile: { displayName: "Awa Ndiaye", handle: "awa", avatarUrl: null },
  }),
}));

function renderBar(
  unreadCounts?: Partial<Record<string, number>>,
  options: { activeSection?: string; hasSidePanel?: boolean } = {},
) {
  return render(
    <TooltipProvider>
      <SidePanelProvider enabled={options.hasSidePanel ?? false}>
        <ActivityBar
          activeSection={options.activeSection ?? "fil"}
          hasSidePanel={options.hasSidePanel ?? false}
          unreadCounts={unreadCounts}
        />
      </SidePanelProvider>
    </TooltipProvider>,
  );
}

describe("barre latérale", () => {
  afterEach(() => {
    wide = false;
  });

  it("annonce les non-lus d'une section dans le nom de son icône", () => {
    renderBar({ salons: 3 });
    expect(screen.getByRole("link", { name: "Salons, 3 non lus" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skills" })).toBeInTheDocument();
  });

  it("plafonne la pastille à 9+", () => {
    renderBar({ salons: 42 });
    expect(screen.getByRole("link", { name: "Salons, 42 non lus" })).toHaveTextContent("9+");
  });

  it("n'affiche aucune pastille sans non-lus", () => {
    renderBar({ salons: 0 });
    expect(screen.getByRole("link", { name: "Salons" })).toHaveTextContent("");
  });

  it("remplit l'icône d'une section ouverte qui s'y prête, épaissit le trait des autres", () => {
    const { unmount } = renderBar(undefined, { activeSection: "fil" });
    const filIcon = screen.getByRole("link", { name: "Fil" }).querySelector("svg")!;
    expect(filIcon).toHaveClass("fill-current");
    unmount();

    renderBar(undefined, { activeSection: "parametres" });
    const settingsIcon = screen.getByRole("link", { name: "Paramètres" }).querySelector("svg")!;
    expect(settingsIcon).not.toHaveClass("fill-current");
    expect(settingsIcon).toHaveAttribute("stroke-width", "2.25");
  });

  it("garde un seul arrêt de tabulation, sur la section ouverte", () => {
    renderBar(undefined, { activeSection: "parametres" });
    const focusable = screen.getAllByRole("link").filter((link) => link.tabIndex === 0);
    expect(focusable.map((link) => link.getAttribute("href"))).toContain("/parametres");
    expect(screen.getByRole("link", { name: "Fil" }).tabIndex).toBe(-1);
  });

  it("sur grand écran, montre les libellés, Enregistrés et le compte, sans Se déconnecter", () => {
    wide = true;
    renderBar();
    expect(screen.getByRole("link", { name: "Fil" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Fil" })).toHaveTextContent("Fil");
    expect(screen.getByRole("link", { name: "Enregistrés" })).toHaveAttribute(
      "href",
      "/enregistres",
    );
    expect(screen.getByRole("link", { name: "Mon profil, Awa Ndiaye, @awa" })).toHaveAttribute(
      "href",
      "/u/awa",
    );
    expect(screen.queryByText("Se déconnecter")).not.toBeInTheDocument();
  });

  it("se resserre en icônes sur une page à panneau latéral", () => {
    wide = true;
    renderBar(undefined, { activeSection: "salons", hasSidePanel: true });
    expect(screen.getByRole("link", { name: "Fil" })).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "Salons" })).toHaveAttribute("aria-expanded");
  });
});
