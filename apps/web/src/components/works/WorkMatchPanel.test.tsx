import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkMatchResult } from "@kemet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkMatchPanel } from "./WorkMatchPanel.js";

const findWorkMatches = vi.fn();

vi.mock("../../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/chat/api.js")>()),
  findWorkMatches: (subject: unknown) => findWorkMatches(subject),
}));

const SUGGESTION = {
  person: {
    id: "00000000-0000-4000-8000-000000000001",
    handle: "yassine-trabelsi",
    displayName: "Yassine Trabelsi",
    avatarUrl: null,
    country: "TN",
    level: "artisan" as const,
  },
  work: {
    slug: "stock-boutique-hors-ligne",
    title: "Stock hors ligne",
    type: "class_project" as const,
  },
};

describe("WorkMatchPanel", () => {
  beforeEach(() => findWorkMatches.mockReset());

  it("n'interroge l'assistant qu'au clic sur le bouton", async () => {
    findWorkMatches.mockResolvedValue({
      result: {
        mode: "assistant",
        fallbackReason: null,
        suggestions: [{ ...SUGGESTION, justification: "Même file d'attente locale." }],
      } satisfies WorkMatchResult,
    });
    render(<WorkMatchPanel subject={{ type: "work", slug: "memoire" }} signedIn />);
    expect(findWorkMatches).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Qui a travaillé sur ce sujet ?" }));
    expect(await screen.findByText("Même file d'attente locale.")).toBeTruthy();
    expect(findWorkMatches).toHaveBeenCalledWith({ type: "work", slug: "memoire" });
    expect(screen.getByText("Travail : Stock hors ligne").getAttribute("href")).toBe(
      "/travaux/stock-boutique-hors-ligne",
    );
  });

  it("dit quand le résultat vient de la recherche seule, sans l'assistant", async () => {
    findWorkMatches.mockResolvedValue({
      result: {
        mode: "full_text",
        fallbackReason: "unavailable",
        suggestions: [{ ...SUGGESTION, justification: null }],
      } satisfies WorkMatchResult,
    });
    render(
      <WorkMatchPanel
        subject={{ type: "post", id: "00000000-0000-4000-8000-0000000000aa" }}
        signedIn
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Qui a travaillé sur ce sujet ?" }));
    expect(await screen.findByText("Sans l'assistant")).toBeTruthy();
    expect(screen.getByText(/L'assistant est saturé/)).toBeTruthy();
  });

  it("invite un visiteur à se connecter sans rien appeler", () => {
    render(<WorkMatchPanel subject={{ type: "project", slug: "appli" }} signedIn={false} />);
    const button = screen.getByRole("button", { name: "Qui a travaillé sur ce sujet ?" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Connecte-toi pour demander à @kemet.")).toBeTruthy();
    expect(findWorkMatches).not.toHaveBeenCalled();
  });
});
