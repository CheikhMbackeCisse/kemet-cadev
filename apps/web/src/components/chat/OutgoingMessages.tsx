import { fr } from "../../i18n/fr.js";
import type { OutgoingMessage } from "../../lib/chat/outgoing.js";
import { cn } from "../../lib/cn.js";
import { Button } from "../ui/Button.js";
import { UserName } from "../ui/UserName.js";

function excerpt(body: string) {
  return body.length > 40 ? `${body.slice(0, 40)}…` : body;
}

interface OutgoingMessagesProps {
  messages: OutgoingMessage[];
  authorDisplayName: string;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
}

export function OutgoingMessages({
  messages,
  authorDisplayName,
  onRetry,
  onDiscard,
}: OutgoingMessagesProps) {
  return (
    <div className="flex gap-3">
      <div className="w-8 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <UserName name={authorDisplayName} />
        {messages.map((message) => (
          <div key={message.clientId} className="flex flex-col gap-1">
            {message.body && (
              <p
                className={cn(
                  "whitespace-pre-wrap break-words text-base",
                  message.status === "sending" ? "text-muted" : "text-text",
                )}
              >
                {message.body}
              </p>
            )}
            {message.attachmentIds.length > 0 && (
              <p className="text-xs text-subtle">
                {fr.chat.outgoingAttachments(message.attachmentIds.length)}
              </p>
            )}
            {message.status === "sending" ? (
              <p className="text-xs text-subtle">{fr.chat.sending}</p>
            ) : (
              <div role="alert" className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-danger">
                  {message.failure?.message ?? fr.chat.sendFailed}
                </p>
                {(message.failure?.retryable ?? true) && (
                  <Button
                    variant="ghost"
                    className="px-2 text-xs"
                    aria-label={fr.chat.retrySending(excerpt(message.body))}
                    onClick={() => onRetry(message.clientId)}
                  >
                    {fr.chat.retry}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="px-2 text-xs"
                  aria-label={fr.chat.discardSending(excerpt(message.body))}
                  onClick={() => onDiscard(message.clientId)}
                >
                  {fr.chat.discardMessage}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
