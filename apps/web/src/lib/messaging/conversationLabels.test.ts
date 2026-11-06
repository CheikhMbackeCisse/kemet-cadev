import { describe, expect, it } from "vitest";
import type { Conversation, ConversationParticipant } from "@kemet/shared";
import {
  conversationExcerpt,
  conversationTitle,
  formatConversationTime,
  isAwaitingAcceptance,
  parseHandles,
} from "./conversationLabels.js";

function participant(displayName: string, status: ConversationParticipant["status"] = "accepted"): ConversationParticipant {
  return {
    profileId: crypto.randomUUID(),
    handle: displayName.toLowerCase(),
    displayName,
    avatarUrl: null,
    country: "SN",
    level: "apprenti",
    status,
  };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: crypto.randomUUID(),
    channelId: crypto.randomUUID(),
    isGroup: false,
    work: null,
    participants: [participant("Awa")],
    viewerStatus: "accepted",
    lastMessage: null,
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("conversationTitle", () => {
  it("nomme l'autre personne d'une conversation à deux", () => {
    expect(conversationTitle(conversation())).toBe("Awa");
  });

  it("résume un groupe par trois noms et le nombre restant", () => {
    const names = ["Awa", "Binta", "Coumba", "Diarra", "Eli"];
    expect(conversationTitle(conversation({ participants: names.map((name) => participant(name)) }))).toBe(
      "Awa, Binta, Coumba et 2 autres",
    );
  });
});

describe("conversationExcerpt", () => {
  const viewerId = crypto.randomUUID();

  it("préfixe de Toi un message qu'on a écrit et compacte les retours à la ligne", () => {
    const value = conversation({
      lastMessage: { authorId: viewerId, body: "Salut\n\nça va ?", hasAttachments: false, deleted: false, createdAt: new Date().toISOString() },
    });
    expect(conversationExcerpt(value, viewerId)).toBe("Toi : Salut ça va ?");
  });

  it("dit Fichier joint pour un message sans texte et Message supprimé pour un message retiré", () => {
    const base = { authorId: crypto.randomUUID(), body: "", createdAt: new Date().toISOString() };
    expect(conversationExcerpt(conversation({ lastMessage: { ...base, hasAttachments: true, deleted: false } }), viewerId)).toBe(
      "Fichier joint",
    );
    expect(conversationExcerpt(conversation({ lastMessage: { ...base, hasAttachments: false, deleted: true } }), viewerId)).toBe(
      "Message supprimé",
    );
  });
});

describe("isAwaitingAcceptance", () => {
  it("est vrai tant que personne en face n'a accepté", () => {
    expect(isAwaitingAcceptance(conversation({ participants: [participant("Awa", "pending")] }))).toBe(true);
    expect(
      isAwaitingAcceptance(conversation({ participants: [participant("Awa", "pending"), participant("Binta")] })),
    ).toBe(false);
  });
});

describe("formatConversationTime", () => {
  it("donne l'heure pour aujourd'hui et la date sinon", () => {
    const now = new Date(2026, 10, 3, 18, 0);
    expect(formatConversationTime(new Date(2026, 10, 3, 9, 5).toISOString(), now)).toBe("09:05");
    expect(formatConversationTime(new Date(2026, 9, 28, 9, 5).toISOString(), now)).toBe("28 oct.");
  });
});

describe("parseHandles", () => {
  it("accepte virgules, espaces et @, sans doublon", () => {
    expect(parseHandles("@awa-ndiaye, kofi\nawa-ndiaye")).toEqual({ ok: true, handles: ["awa-ndiaye", "kofi"] });
  });

  it("refuse un identifiant invalide et plus de sept personnes", () => {
    expect(parseHandles("awa ndiaye.dev")).toEqual({ ok: false, error: "« ndiaye.dev » n'est pas un identifiant valide." });
    expect(parseHandles("aaa bbb ccc ddd eee fff ggg hhh").ok).toBe(false);
  });
});
