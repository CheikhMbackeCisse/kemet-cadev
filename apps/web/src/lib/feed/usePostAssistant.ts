import { useCallback, useEffect, useRef, useState } from "react";
import type { PostReply, PostReplyAssistantStart } from "@kemet/shared";
import { getPostAssistantStatus } from "../chat/api.js";

// Le fil n'a pas de temps réel : l'état de la réponse est relu à intervalle
// court, et l'attente abandonnée bien après le délai de toute la chaîne.
export const POST_ASSISTANT_POLL_MS = 1500;
export const POST_ASSISTANT_GIVE_UP_MS = 120_000;

export interface PostAssistantFailure {
  errorCode: string;
  /** Invocation à relancer ; `null` quand elle n'a jamais été créée (quota atteint). */
  invocationId: string | null;
}

/**
 * Suit la réponse de @kemet à une question posée sous un post, pour la
 * personne qui l'a posée : attente, réponse arrivée, échec.
 */
export function usePostAssistant(onAnswer: (reply: PostReply) => void) {
  const [pending, setPending] = useState<{ invocationId: string; startedAt: number } | null>(null);
  const [failure, setFailure] = useState<PostAssistantFailure | null>(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;

  const track = useCallback((start: PostReplyAssistantStart | null) => {
    if (!start) return;
    setFailure(null);
    if (start.invocationId) setPending({ invocationId: start.invocationId, startedAt: Date.now() });
    else setFailure({ errorCode: start.errorCode ?? "internal_error", invocationId: null });
  }, []);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (Date.now() - pending.startedAt > POST_ASSISTANT_GIVE_UP_MS) {
        setPending(null);
        setFailure({ errorCode: "internal_error", invocationId: pending.invocationId });
        return;
      }
      getPostAssistantStatus(pending.invocationId)
        .then((status) => {
          if (cancelled) return;
          if (status.status === "done" && status.reply) {
            setPending(null);
            onAnswerRef.current(status.reply);
          } else if (status.status === "failed") {
            setPending(null);
            setFailure({
              errorCode: status.errorCode ?? "internal_error",
              invocationId: pending.invocationId,
            });
          }
        })
        // Une lecture manquée (réseau) n'arrête pas l'attente : la suivante réessaie.
        .catch(() => {});
    }, POST_ASSISTANT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pending]);

  const dismissFailure = useCallback(() => setFailure(null), []);

  return { isPending: pending !== null, failure, track, dismissFailure };
}
