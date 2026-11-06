import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Conversation } from "@kemet/shared";
import type { ConversationListState } from "../../lib/messaging/useConversationList.js";
import { ConversationList } from "./ConversationList.js";

const viewerId = "00000000-0000-4000-8000-000000000001";

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    channelId: "00000000-0000-4000-8000-0000000000bb",
    isGroup: false,
    work: null,
    participants: [
      {
        profileId: "00000000-0000-4000-8000-000000000002",
        handle: "awa",
        displayName: "Awa Ndiaye",
        avatarUrl: null,
        country: "SN",
        level: "artisan",
        status: "accepted",
      },
    ],
    viewerStatus: "accepted",
    lastMessage: {
      authorId: viewerId,
      body: "On se voit demain ?",
      hasAttachments: false,
      deleted: false,
      createdAt: new Date().toISOString(),
    },
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function state(overrides: Partial<ConversationListState> = {}): ConversationListState {
  return {
    items: [],
    status: "ready",
    hasMore: false,
    loadingMore: false,
    reload: vi.fn(),
    loadMore: vi.fn(),
    ...overrides,
  };
}

describe("liste des conversations", () => {
  it("dit quoi faire quand la boîte est vide, différemment pour les demandes", () => {
    const { rerender } = render(
      <ConversationList box="inbox" list={state()} activeConversationId={null} viewerId={viewerId} />,
    );
    expect(screen.getByRole("button", { name: "Démarrer une conversation" })).toBeInTheDocument();
    rerender(<ConversationList box="requests" list={state()} activeConversationId={null} viewerId={viewerId} />);
    expect(screen.getByText(/Aucune demande en attente/)).toBeInTheDocument();
  });

  it("montre une erreur avec un bouton pour réessayer", () => {
    const reload = vi.fn();
    render(
      <ConversationList box="inbox" list={state({ status: "error", reload })} activeConversationId={null} viewerId={viewerId} />,
    );
    screen.getByRole("button", { name: "Réessayer" }).click();
    expect(reload).toHaveBeenCalled();
  });

  it("annonce les non-lus d'une conversation fermée", () => {
    const item = conversation({ unreadCount: 3 });
    render(<ConversationList box="inbox" list={state({ items: [item] })} activeConversationId={null} viewerId={viewerId} />);
    const link = screen.getByRole("link", { name: /Awa Ndiaye/ });
    expect(link).toHaveAttribute("href", `/messages/${item.id}`);
    expect(link).toHaveTextContent("Toi : On se voit demain ?");
    expect(link).toHaveTextContent("3 messages non lus");
  });

  it("marque la conversation ouverte sans compter ses messages, en train d'être lus", () => {
    const item = conversation({ unreadCount: 3 });
    render(<ConversationList box="inbox" list={state({ items: [item] })} activeConversationId={item.id} viewerId={viewerId} />);
    const link = screen.getByRole("link", { name: /Awa Ndiaye/ });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).not.toHaveTextContent("non lus");
  });

  it("signale une demande envoyée que personne n'a encore acceptée", () => {
    const [participant] = conversation().participants;
    const item = conversation({ participants: [{ ...participant!, status: "pending" }] });
    render(<ConversationList box="inbox" list={state({ items: [item] })} activeConversationId={null} viewerId={viewerId} />);
    expect(screen.getByRole("link", { name: /Awa Ndiaye/ })).toHaveTextContent("En attente");
  });

  it("rappelle le travail d'une conversation d'équipe", () => {
    const item = conversation({ isGroup: true, work: { slug: "memoire", title: "Synchronisation hors ligne" } });
    render(<ConversationList box="requests" list={state({ items: [item] })} activeConversationId={null} viewerId={viewerId} />);
    expect(screen.getByRole("link", { name: /Awa Ndiaye/ })).toHaveTextContent(
      "Équipe du travail « Synchronisation hors ligne »",
    );
  });
});
