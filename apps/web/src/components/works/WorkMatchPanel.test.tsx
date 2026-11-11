import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { RelatedPeople, WorkMatchResult } from "@kemet/shared";
import type { SessionStatus } from "../../session/SessionProvider.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkMatchPanel } from "./WorkMatchPanel.js";

const findWorkMatches = vi.fn();
const getRelatedPeople = vi.fn();
let sessionStatus: SessionStatus = "ready";

vi.mock("../../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/chat/api.js")>()),
  findWorkMatches: (subject: unknown) => findWorkMatches(subject),
  getRelatedPeople: (subject: unknown) => getRelatedPeople(subject),
}));

vi.mock("../../session/SessionProvider.js", () => ({
  useSession: () => ({ status: sessionStatus }),
}));

function renderPanel(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

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
  beforeEach(() => {
    findWorkMatches.mockReset();
    getRelatedPeople.mockReset();
    sessionStatus = "ready";
  });

  it("n'interroge l'assistant qu'au clic sur le bouton", async () => {
    findWorkMatches.mockResolvedValue({
      result: {
        mode: "assistant",
        fallbackReason: null,
        suggestions: [{ ...SUGGESTION, justification: "Même file d'attente locale." }],
      } satisfies WorkMatchResult,
    });
    renderPanel(<WorkMatchPanel subject={{ type: "work", slug: "memoire" }} />);
    expect(findWorkMatches).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Trouver qui a travaillé sur ce sujet" }));
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
    renderPanel(
      <WorkMatchPanel subject={{ type: "post", id: "00000000-0000-4000-8000-0000000000aa" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trouver qui a travaillé sur ce sujet" }));
    expect(await screen.findByText("Sans l'assistant")).toBeTruthy();
    expect(screen.getByText(/L'assistant est saturé/)).toBeTruthy();
  });

  it("montre à un visiteur les personnes proches par tags, sans appeler l'assistant", async () => {
    sessionStatus = "visitor";
    getRelatedPeople.mockResolvedValue({
      related: { total: 5, people: [SUGGESTION.person] } satisfies RelatedPeople,
    });
    renderPanel(<WorkMatchPanel subject={{ type: "project", slug: "appli" }} />);

    expect(await screen.findByText("5 personnes ont travaillé sur un sujet proche")).toBeTruthy();
    expect(getRelatedPeople).toHaveBeenCalledWith({ type: "project", slug: "appli" });
    expect(screen.getByRole("link", { name: "Yassine Trabelsi" }).getAttribute("href")).toBe(
      "/u/yassine-trabelsi",
    );
    expect(
      screen.getByRole("link", { name: "Connecte-toi pour leur écrire" }).getAttribute("href"),
    ).toBe("/connexion");
    expect(screen.queryByRole("button")).toBeNull();
    expect(findWorkMatches).not.toHaveBeenCalled();
  });

  it("ne montre rien à un visiteur quand personne n'a travaillé sur un sujet proche", async () => {
    sessionStatus = "visitor";
    getRelatedPeople.mockResolvedValue({ related: { total: 0, people: [] } });
    const { container } = renderPanel(<WorkMatchPanel subject={{ type: "work", slug: "seul" }} />);
    await vi.waitFor(() => expect(getRelatedPeople).toHaveBeenCalled());
    await vi.waitFor(() => expect(container.textContent).toBe(""));
  });

  it("invite un visiteur à se connecter sur un post, sans rien appeler", () => {
    sessionStatus = "visitor";
    renderPanel(
      <WorkMatchPanel subject={{ type: "post", id: "00000000-0000-4000-8000-0000000000aa" }} />,
    );
    const link = screen.getByRole("link", { name: "Trouver qui a travaillé sur ce sujet" });
    expect(link.getAttribute("href")).toBe("/connexion");
    expect(findWorkMatches).not.toHaveBeenCalled();
    expect(getRelatedPeople).not.toHaveBeenCalled();
  });
});
