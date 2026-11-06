import { fr } from "../../i18n/fr.js";
import { UNREAD_SEPARATOR_ATTRIBUTE } from "../../lib/chat/useMessageListScroll.js";

export function DaySeparator({ label }: { label: string }) {
  return (
    <div
      role="separator"
      aria-label={label}
      className="flex items-center gap-3 text-xs font-medium text-subtle"
    >
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

export function UnreadSeparator() {
  return (
    <div
      {...{ [UNREAD_SEPARATOR_ATTRIBUTE]: "" }}
      role="separator"
      aria-label={fr.chat.newMessages}
      className="flex items-center gap-3 text-xs font-semibold"
    >
      <span className="h-px flex-1 bg-primary" aria-hidden="true" />
      {/* --link plutôt que --primary : même teinte en clair, plus
          claire en sombre où --primary n'atteint pas 4,5:1 sur --bg. */}
      <span className="text-link" aria-hidden="true">
        {fr.chat.newMessages}
      </span>
      <span className="h-px flex-1 bg-primary" aria-hidden="true" />
    </div>
  );
}
