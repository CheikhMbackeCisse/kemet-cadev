import type { Message } from "@kemet/shared";
import { describe, expect, it } from "vitest";
import { buildTimeline, formatDayLabel } from "./timeline.js";

let sequence = 0;

function message(authorId: string, createdAt: Date, authorHandle = authorId): Message {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    channelId: "00000000-0000-4000-8000-000000000000",
    parentMessageId: null,
    clientId: "00000000-0000-4000-8000-000000000000",
    authorId,
    authorHandle,
    authorDisplayName: authorHandle,
    authorAvatarUrl: null,
    authorCountry: "SN",
    body: "Bonjour",
    mentionedHandles: [],
    reactions: [],
    replyCount: 0,
    attachments: [],
    createdAt: createdAt.toISOString(),
    editedAt: null,
    deletedAt: null,
  };
}

const NOW = new Date(2026, 9, 29, 15, 0);

describe("formatDayLabel", () => {
  it("nomme aujourd'hui et hier, puis la date", () => {
    expect(formatDayLabel(new Date(2026, 9, 29, 8, 0), NOW)).toBe("Aujourd'hui");
    expect(formatDayLabel(new Date(2026, 9, 28, 23, 59), NOW)).toBe("Hier");
    expect(formatDayLabel(new Date(2026, 9, 18, 10, 0), NOW)).toBe("18 octobre");
  });

  it("ajoute l'année hors de l'année en cours", () => {
    expect(formatDayLabel(new Date(2025, 11, 31, 10, 0), NOW)).toBe("31 décembre 2025");
  });

  it("reconnaît hier au premier jour du mois", () => {
    expect(formatDayLabel(new Date(2026, 9, 31, 10, 0), new Date(2026, 10, 1, 9, 0))).toBe("Hier");
  });
});

describe("buildTimeline", () => {
  it("insère un séparateur à chaque nouveau jour", () => {
    const items = buildTimeline(
      [
        message("awa", new Date(2026, 9, 27, 10, 0)),
        message("awa", new Date(2026, 9, 28, 9, 0)),
        message("moussa", new Date(2026, 9, 29, 9, 0)),
      ],
      NOW,
    );
    expect(items.map((item) => (item.type === "day" ? item.label : "groupe"))).toEqual([
      "27 octobre",
      "groupe",
      "Hier",
      "groupe",
      "Aujourd'hui",
      "groupe",
    ]);
  });

  it("regroupe les messages proches d'une même personne", () => {
    const items = buildTimeline(
      [
        message("awa", new Date(2026, 9, 29, 10, 0)),
        message("awa", new Date(2026, 9, 29, 10, 2)),
        message("moussa", new Date(2026, 9, 29, 10, 3)),
      ],
      NOW,
    );
    const groups = items.filter((item) => item.type === "group");
    expect(groups).toHaveLength(2);
    expect(groups[0]?.type === "group" && groups[0].group.messages).toHaveLength(2);
  });

  it("ne fait jamais traverser minuit à un groupe", () => {
    const items = buildTimeline(
      [message("awa", new Date(2026, 9, 28, 23, 58)), message("awa", new Date(2026, 9, 29, 0, 1))],
      NOW,
    );
    expect(items.filter((item) => item.type === "group")).toHaveLength(2);
    expect(items.filter((item) => item.type === "day")).toHaveLength(2);
  });

  it("ne regroupe jamais une réponse de l'assistant", () => {
    const items = buildTimeline(
      [
        message("kemet-id", new Date(2026, 9, 29, 10, 0), "kemet"),
        message("kemet-id", new Date(2026, 9, 29, 10, 1), "kemet"),
      ],
      NOW,
    );
    expect(items.filter((item) => item.type === "group")).toHaveLength(2);
  });
});

describe("buildTimeline, séparateur des nouveaux messages", () => {
  const kinds = (items: ReturnType<typeof buildTimeline>) =>
    items.map((item) =>
      item.type === "group" ? `group:${item.group.messages.length}` : item.type,
    );

  it("se place juste avant le premier non-lu et coupe le groupe en cours", () => {
    const first = message("awa", new Date(2026, 9, 29, 10, 0));
    const second = message("awa", new Date(2026, 9, 29, 10, 1));
    const items = buildTimeline([first, second], NOW, {
      firstUnreadMessageId: second.id,
      hasOlder: false,
    });
    expect(kinds(items)).toEqual(["day", "group:1", "unread", "group:1"]);
  });

  it("suit le séparateur de jour quand le premier non-lu ouvre une nouvelle journée", () => {
    const yesterday = message("awa", new Date(2026, 9, 28, 22, 0));
    const today = message("moussa", new Date(2026, 9, 29, 9, 0));
    const items = buildTimeline([yesterday, today], NOW, {
      firstUnreadMessageId: today.id,
      hasOlder: false,
    });
    expect(kinds(items)).toEqual(["day", "group:1", "day", "unread", "group:1"]);
  });

  it("se place en tête si le premier non-lu est dans une page pas encore chargée", () => {
    const loaded = [
      message("awa", new Date(2026, 9, 29, 10, 0)),
      message("awa", new Date(2026, 9, 29, 10, 1)),
    ];
    const items = buildTimeline(loaded, NOW, {
      firstUnreadMessageId: "00000000-0000-4000-8000-999999999999",
      hasOlder: true,
    });
    expect(kinds(items)).toEqual(["day", "unread", "group:2"]);
  });

  it("n'apparaît pas sans non-lu, ni pour un non-lu introuvable dans un historique complet", () => {
    const loaded = [message("awa", new Date(2026, 9, 29, 10, 0))];
    expect(
      kinds(buildTimeline(loaded, NOW, { firstUnreadMessageId: null, hasOlder: true })),
    ).toEqual(["day", "group:1"]);
    expect(
      kinds(
        buildTimeline(loaded, NOW, {
          firstUnreadMessageId: "00000000-0000-4000-8000-999999999999",
          hasOlder: false,
        }),
      ),
    ).toEqual(["day", "group:1"]);
  });
});
