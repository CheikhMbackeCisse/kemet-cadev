import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../ui/Tooltip.js";
import { ActivityBar } from "./ActivityBar.js";
import { SidePanelProvider } from "./sidePanel.js";

vi.mock("./AccountMenu.js", () => ({ AccountMenu: () => null }));

function renderBar(unreadCounts?: Partial<Record<string, number>>) {
  return render(
    <TooltipProvider>
      <SidePanelProvider>
        <ActivityBar activeSection="fil" hasSidePanel={false} unreadCounts={unreadCounts} />
      </SidePanelProvider>
    </TooltipProvider>,
  );
}

describe("barre d'activité", () => {
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
});
