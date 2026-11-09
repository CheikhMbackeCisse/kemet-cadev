import { Users } from "lucide-react";
import type { Conversation } from "@kemet/shared";
import { Avatar } from "../ui/Avatar.js";

/** Photo de l'autre personne ; pour un groupe, une icône plutôt qu'un empilement illisible à 40 px. */
export function ConversationAvatar({
  conversation,
}: {
  conversation: Pick<Conversation, "isGroup" | "participants">;
}) {
  const [first] = conversation.participants;
  if (conversation.isGroup || !first) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
      >
        <Users className="size-5" />
      </span>
    );
  }
  return (
    <Avatar
      name={first.displayName}
      src={first.avatarUrl ?? undefined}
      size={40}
      countryCode={first.country}
      className="shrink-0"
    />
  );
}
