import { ArrowLeft, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Message } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import type { OutgoingMessage } from "../../lib/chat/outgoing.js";
import { RichText } from "../content/RichText.js";
import { Button } from "../ui/Button.js";
import { ErrorState } from "../ui/ErrorState.js";
import { IconButton } from "../ui/IconButton.js";
import { Skeleton } from "../ui/Skeleton.js";
import { Textarea } from "../ui/Textarea.js";
import { UserName } from "../ui/UserName.js";
import { OutgoingMessages } from "./OutgoingMessages.js";

interface ThreadViewProps {
  parent: Message;
  replies: Message[];
  outgoing: OutgoingMessage[];
  loading: boolean;
  error: boolean;
  onReload: () => void;
  onSend: (body: string) => void;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onClose: () => void;
  /** Plein écran sur mobile : on revient au salon plutôt que de fermer un panneau. */
  fullScreen: boolean;
  canWrite: boolean;
  enterSends: boolean;
  ownDisplayName: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function ThreadMessage({ message }: { message: Message }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <a href={`/u/${message.authorHandle}`} className="hover:underline">
          <UserName name={message.authorDisplayName} />
        </a>
        <span className="text-xs text-subtle">{formatTime(message.createdAt)}</span>
      </div>
      {message.deletedAt ? (
        <p className="text-base text-muted">{fr.chat.messageDeleted}</p>
      ) : (
        <RichText source={message.body} className="text-base text-text" />
      )}
    </div>
  );
}

export function ThreadView({
  parent,
  replies,
  outgoing,
  loading,
  error,
  onReload,
  onSend,
  onRetry,
  onDiscard,
  onClose,
  fullScreen,
  canWrite,
  enterSends,
  ownDisplayName,
}: ThreadViewProps) {
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Le fil est rendu en fin de page : sans ça, il faudrait traverser tout le
  // salon au clavier pour l'atteindre.
  useEffect(() => {
    if (canWrite) composerRef.current?.focus();
    else headingRef.current?.focus();
  }, [parent.id, canWrite]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    onSend(body);
  }

  return (
    <section aria-label={fr.chat.thread} className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2">
        {fullScreen && (
          <Button variant="ghost" onClick={onClose} className="px-2">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {fr.chat.backToChannel}
          </Button>
        )}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className={fullScreen ? "sr-only" : "flex-1 px-2 text-md font-semibold text-text"}
        >
          {fr.chat.thread}
        </h2>
        {!fullScreen && (
          <IconButton aria-label={fr.chat.closeThread} onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>
      <div role="log" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <ThreadMessage message={parent} />
        <p className="flex items-center gap-3 text-xs font-medium text-subtle">
          {fr.chat.replyCount(replies.length)}
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </p>
        {loading ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        ) : error ? (
          <ErrorState
            message={fr.chat.loadThreadError}
            retry={{ label: fr.chat.retry, onClick: onReload }}
          />
        ) : replies.length === 0 && outgoing.length === 0 ? (
          <p className="text-sm text-muted">
            {canWrite ? fr.chat.threadEmptyCanWrite : fr.chat.threadEmpty}
          </p>
        ) : (
          replies.map((reply) => <ThreadMessage key={reply.id} message={reply} />)
        )}
        {outgoing.length > 0 && ownDisplayName && (
          <OutgoingMessages
            messages={outgoing}
            authorDisplayName={ownDisplayName}
            onRetry={onRetry}
            onDiscard={onDiscard}
          />
        )}
      </div>
      {canWrite && (
        <div className="flex shrink-0 gap-2 border-t border-border p-3">
          <Textarea
            ref={composerRef}
            placeholder={fr.chat.threadComposerPlaceholder}
            aria-label={fr.chat.threadComposerPlaceholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            enterKeyHint={enterSends ? "send" : "enter"}
            onKeyDown={(event) => {
              if (
                enterSends &&
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send();
              }
            }}
            maxHeight={144}
            className="min-h-9 max-md:min-h-11 flex-1 py-2"
          />
          <Button
            onClick={send}
            onPointerDown={(event) => event.preventDefault()}
            aria-label={fr.chat.send}
            className="max-md:size-control-mobile max-md:px-0"
          >
            <Send className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </section>
  );
}
