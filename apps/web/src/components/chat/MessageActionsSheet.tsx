import { Copy, Flag, MessageSquareReply, SmilePlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { Sheet } from "../ui/Sheet.js";

interface MessageActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReact: () => void;
  onReplyInThread?: () => void;
  onCopy?: () => void;
  onReport?: () => void;
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex h-control-mobile w-full items-center gap-3 rounded-control px-3 text-base text-text hover:bg-surface-2"
      >
        <Icon className="size-5 text-text-2" aria-hidden="true" />
        {label}
      </button>
    </li>
  );
}

/** Actions d'un message sur écran tactile, ouvertes par un appui long. */
export function MessageActionsSheet({
  open,
  onOpenChange,
  onReact,
  onReplyInThread,
  onCopy,
  onReport,
}: MessageActionsSheetProps) {
  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" title={fr.chat.messageActions}>
      <ul className="flex flex-col gap-1">
        <Action icon={SmilePlus} label={fr.chat.addReaction} onClick={() => run(onReact)} />
        {onReplyInThread && (
          <Action
            icon={MessageSquareReply}
            label={fr.chat.replyInThread}
            onClick={() => run(onReplyInThread)}
          />
        )}
        {onCopy && <Action icon={Copy} label={fr.chat.copyText} onClick={() => run(onCopy)} />}
        {onReport && (
          <Action icon={Flag} label={fr.moderation.reportAction} onClick={() => run(onReport)} />
        )}
      </ul>
    </Sheet>
  );
}
