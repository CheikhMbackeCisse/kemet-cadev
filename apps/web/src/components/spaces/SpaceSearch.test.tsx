import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Space } from "@kemet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fr } from "../../i18n/fr.js";
import { ToastProvider } from "../ui/Toast.js";
import { SpaceSearch } from "./SpaceSearch.js";

const searchSpaces = vi.fn();
const joinSpace = vi.fn();
const navigate = vi.fn();

vi.mock("../../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/chat/api.js")>()),
  searchSpaces: (query: string) => searchSpaces(query),
  joinSpace: (id: string) => joinSpace(id),
}));

vi.mock("../../lib/navigation/navigate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/navigation/navigate.js")>()),
  navigate: (path: string) => navigate(path),
}));

const HACKATHONS: Space = {
  id: "00000000-0000-4000-8000-000000000010",
  name: "Hackathons et concours",
  slug: "hackathons-concours",
  description: "Annonces et équipes.",
  visibility: "public",
  role: null,
  memberCount: 12,
  hasUnread: false,
  createdAt: "2026-11-01T00:00:00.000Z",
};

function renderSearch(canJoin: boolean, onOpen = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SpaceSearch layout="page" canJoin={canJoin} onOpen={onOpen}>
          <p>Liste des espaces</p>
        </SpaceSearch>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onOpen;
}

function type(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: fr.spaces.searchLabel }), {
    target: { value: text },
  });
}

describe("SpaceSearch", () => {
  beforeEach(() => {
    searchSpaces.mockReset().mockResolvedValue({ items: [HACKATHONS] });
    joinSpace.mockReset().mockResolvedValue({ joined: true });
    navigate.mockReset();
  });

  it("remplace la liste par les résultats, puis la rend quand le champ est vidé", async () => {
    renderSearch(true);
    expect(screen.getByText("Liste des espaces")).toBeInTheDocument();
    type("hackathon");
    expect(await screen.findByText("Hackathons et concours")).toBeInTheDocument();
    expect(searchSpaces).toHaveBeenCalledWith("hackathon");
    expect(screen.queryByText("Liste des espaces")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: fr.common.clearSearch }));
    expect(screen.getByText("Liste des espaces")).toBeInTheDocument();
  });

  it("rejoint l'espace et l'ouvre en membre", async () => {
    const onOpen = renderSearch(true);
    type("hackathon");
    fireEvent.click(
      await screen.findByRole("button", { name: fr.spaces.joinLabel("Hackathons et concours") }),
    );
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith({ ...HACKATHONS, role: "member", memberCount: 13 }),
    );
    expect(joinSpace).toHaveBeenCalledWith(HACKATHONS.id);
  });

  it("envoie un visiteur à la connexion au lieu de rejoindre", async () => {
    renderSearch(false);
    type("hackathon");
    fireEvent.click(
      await screen.findByRole("button", { name: fr.spaces.joinLabel("Hackathons et concours") }),
    );
    expect(navigate).toHaveBeenCalledWith("/connexion");
    expect(joinSpace).not.toHaveBeenCalled();
  });

  it("dit quand rien ne correspond", async () => {
    searchSpaces.mockResolvedValue({ items: [] });
    renderSearch(true);
    type("cuisine");
    expect(await screen.findByRole("status")).toHaveTextContent(fr.spaces.searchEmpty("cuisine"));
  });
});
