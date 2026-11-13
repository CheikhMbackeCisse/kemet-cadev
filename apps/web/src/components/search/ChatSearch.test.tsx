import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Space } from "@kemet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fr } from "../../i18n/fr.js";
import { ChatApiError } from "../../lib/chat/api.js";
import { ToastProvider } from "../ui/Toast.js";
import { ChatSearch } from "./ChatSearch.js";

const searchSpaces = vi.fn();
const searchPeople = vi.fn();
const joinSpace = vi.fn();
const openConversation = vi.fn();
const navigate = vi.fn();
let sessionStatus: "ready" | "visitor" = "ready";

vi.mock("../../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/chat/api.js")>()),
  searchSpaces: (query: string) => searchSpaces(query),
  searchPeople: (query: string) => searchPeople(query),
  joinSpace: (id: string) => joinSpace(id),
  openConversation: (handles: string[]) => openConversation(handles),
}));

vi.mock("../../lib/navigation/navigate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/navigation/navigate.js")>()),
  navigate: (path: string) => navigate(path),
}));

vi.mock("../../session/SessionProvider.js", () => ({
  useSession: () => ({ status: sessionStatus }),
}));

vi.mock("../../lib/messaging/conversationUnread.js", () => ({
  useConversationUnread: () => ({}),
  messagesBadgeCount: () => 0,
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

const AWA = {
  id: "00000000-0000-4000-8000-000000000020",
  handle: "awa-ndiaye",
  displayName: "Awa Ndiaye",
  country: "SN",
  title: null,
  avatarUrl: null,
  helpsBeginners: false,
  isDemo: false,
};

function renderSearch(
  layout: "panel" | "page",
  options: { onOpenSpace?: (space: Space) => void; section?: "salons" | "messages" } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ChatSearch
          layout={layout}
          section={options.section ?? "salons"}
          onOpenSpace={options.onOpenSpace}
          visitorTitle="Espaces publics"
        >
          <p>Liste ordinaire</p>
        </ChatSearch>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function type(text: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: text } });
}

describe("recherche des salons et messages", () => {
  beforeEach(() => {
    sessionStatus = "ready";
    searchSpaces.mockReset().mockResolvedValue({ items: [HACKATHONS] });
    searchPeople.mockReset().mockResolvedValue({ items: [AWA] });
    joinSpace.mockReset().mockResolvedValue({ joined: true });
    openConversation.mockReset();
    navigate.mockReset();
  });

  it("groupe les espaces puis les personnes, et rend la liste quand le champ est vidé", async () => {
    renderSearch("panel");
    expect(screen.getByText("Liste ordinaire")).toBeInTheDocument();
    type("awa");
    const spaces = await screen.findByRole("region", { name: fr.chatSearch.spacesGroup });
    const people = screen.getByRole("region", { name: fr.chatSearch.peopleGroup });
    expect(await within(spaces).findByText("Hackathons et concours")).toBeInTheDocument();
    expect(await within(people).findByText("Awa Ndiaye")).toBeInTheDocument();
    expect(spaces.compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Liste ordinaire")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: fr.common.clearSearch }));
    expect(screen.getByText("Liste ordinaire")).toBeInTheDocument();
  });

  it("rejoint un espace et l'ouvre en membre", async () => {
    const onOpenSpace = vi.fn();
    renderSearch("panel", { onOpenSpace });
    type("hackathon");
    fireEvent.click(
      await screen.findByRole("button", { name: fr.spaces.joinLabel("Hackathons et concours") }),
    );
    await waitFor(() =>
      expect(onOpenSpace).toHaveBeenCalledWith({ ...HACKATHONS, role: "member", memberCount: 13 }),
    );
    expect(joinSpace).toHaveBeenCalledWith(HACKATHONS.id);
  });

  it("depuis Messages, mène à l'espace touché dans Salons", async () => {
    renderSearch("panel", { section: "messages" });
    type("hackathon");
    fireEvent.click(await screen.findByText("Hackathons et concours"));
    expect(navigate).toHaveBeenCalledWith(`/salons?space=${HACKATHONS.id}`);
  });

  it("ouvre la conversation avec la personne touchée", async () => {
    openConversation.mockResolvedValue({ conversation: { id: "conv-1" } });
    renderSearch("panel");
    type("awa");
    fireEvent.click(await screen.findByRole("button", { name: fr.messages.writeTo("Awa Ndiaye") }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/messages/conv-1"));
    expect(openConversation).toHaveBeenCalledWith(["awa-ndiaye"]);
  });

  it("montre la raison du serveur quand la conversation ne s'ouvre pas", async () => {
    openConversation.mockRejectedValue(
      new ChatApiError("FORBIDDEN", "Tu ne peux pas écrire à ce compte.", 403),
    );
    renderSearch("panel");
    type("awa");
    fireEvent.click(await screen.findByRole("button", { name: fr.messages.writeTo("Awa Ndiaye") }));
    expect(await screen.findByText("Tu ne peux pas écrire à ce compte.")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ne cherche que des espaces pour un visiteur, et l'envoie à la connexion pour rejoindre", async () => {
    sessionStatus = "visitor";
    renderSearch("panel");
    type("hackathon");
    fireEvent.click(
      await screen.findByRole("button", { name: fr.spaces.joinLabel("Hackathons et concours") }),
    );
    expect(navigate).toHaveBeenCalledWith("/connexion");
    expect(joinSpace).not.toHaveBeenCalled();
    expect(searchPeople).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: fr.chatSearch.peopleGroup }),
    ).not.toBeInTheDocument();
  });

  it("dit quand rien ne correspond, groupe par groupe", async () => {
    searchSpaces.mockResolvedValue({ items: [] });
    searchPeople.mockResolvedValue({ items: [] });
    renderSearch("panel");
    type("cuisine");
    expect(await screen.findByText(fr.spaces.searchEmpty("cuisine"))).toBeInTheDocument();
    expect(await screen.findByText(fr.messages.searchEmpty("cuisine"))).toBeInTheDocument();
  });

  it("sur téléphone, la loupe déploie le champ avec le focus, et Fermer le replie", () => {
    renderSearch("page");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    const loupe = screen.getByRole("button", { name: fr.chatSearch.open });
    fireEvent.click(loupe);
    expect(screen.getByRole("searchbox")).toHaveFocus();
    expect(loupe).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: fr.chatSearch.close }));
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(loupe).toHaveFocus();
  });

  it("sur téléphone, Échap sur le champ vide referme la recherche", () => {
    renderSearch("page");
    fireEvent.click(screen.getByRole("button", { name: fr.chatSearch.open }));
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
