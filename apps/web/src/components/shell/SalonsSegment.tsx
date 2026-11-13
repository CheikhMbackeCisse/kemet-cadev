import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import {
  messagesBadgeCount,
  useConversationUnread,
} from "../../lib/messaging/conversationUnread.js";
import { useSession } from "../../session/SessionProvider.js";

export interface SalonsSegmentProps {
  active: "salons" | "messages";
}

/**
 * Sous lg, l'onglet Salons porte aussi les messages privés : deux liens
 * soulignés en haut de page plutôt qu'un sixième onglet que la barre du bas
 * n'a pas la place d'afficher. Absent pour un visiteur, qui n'a pas de messages.
 * Posé dans la ligne de la recherche (ChatSearch), qui porte le filet du bas.
 */
export function SalonsSegment({ active }: SalonsSegmentProps) {
  const { status } = useSession();
  const unread = messagesBadgeCount(useConversationUnread(status === "ready"));
  if (status !== "ready") return null;

  const items = [
    { id: "salons" as const, label: fr.messages.segmentSalons, href: "/salons", count: 0 },
    {
      id: "messages" as const,
      label: fr.messages.segmentMessages,
      href: "/messages",
      count: unread,
    },
  ];

  return (
    <nav aria-label={fr.messages.segmentLabel} className="shrink-0 px-3 lg:hidden">
      <ul className="grid grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              aria-current={item.id === active ? "page" : undefined}
              className={cn(
                "relative flex h-14 items-center justify-center gap-2 text-sm font-medium transition-colors duration-150",
                "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
                item.id === active
                  ? "text-text after:opacity-100"
                  : "text-muted after:opacity-0 hover:text-text",
              )}
            >
              {item.label}
              {item.count > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium leading-none text-white tabular-nums">
                  <span aria-hidden="true">{item.count > 9 ? "9+" : item.count}</span>
                  <span className="sr-only">{fr.messages.unreadPrivateSuffix(item.count)}</span>
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
