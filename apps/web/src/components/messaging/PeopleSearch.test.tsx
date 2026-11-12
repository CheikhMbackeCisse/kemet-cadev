import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fr } from "../../i18n/fr.js";
import { ChatApiError } from "../../lib/chat/api.js";
import { ToastProvider } from "../ui/Toast.js";
import { PeopleSearch } from "./PeopleSearch.js";

const searchPeople = vi.fn();
const openConversation = vi.fn();
const navigate = vi.fn();

vi.mock("../../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/chat/api.js")>()),
  searchPeople: (query: string) => searchPeople(query),
  openConversation: (handles: string[]) => openConversation(handles),
}));

vi.mock("../../lib/navigation/navigate.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/navigation/navigate.js")>()),
  navigate: (path: string) => navigate(path),
}));

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

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PeopleSearch layout="page">
          <p>Conversations</p>
        </PeopleSearch>
      </ToastProvider>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("searchbox", { name: fr.messages.searchLabel }), {
    target: { value: "awa" },
  });
}

describe("PeopleSearch", () => {
  beforeEach(() => {
    searchPeople.mockReset().mockResolvedValue({ items: [AWA] });
    openConversation.mockReset();
    navigate.mockReset();
  });

  it("ouvre la conversation avec la personne touchée", async () => {
    openConversation.mockResolvedValue({ conversation: { id: "conv-1" } });
    renderSearch();
    fireEvent.click(await screen.findByRole("button", { name: fr.messages.writeTo("Awa Ndiaye") }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/messages/conv-1"));
    expect(openConversation).toHaveBeenCalledWith(["awa-ndiaye"]);
  });

  it("montre la raison donnée par le serveur quand la conversation est refusée", async () => {
    openConversation.mockRejectedValue(
      new ChatApiError("FORBIDDEN", "Tu ne peux pas écrire à cette personne.", 403),
    );
    renderSearch();
    fireEvent.click(await screen.findByRole("button", { name: fr.messages.writeTo("Awa Ndiaye") }));
    expect(await screen.findByText("Tu ne peux pas écrire à cette personne.")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
