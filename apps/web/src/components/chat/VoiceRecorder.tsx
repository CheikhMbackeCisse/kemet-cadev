import { ChevronLeft, Mic, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { VOICE_MAX_DURATION_MS } from "@kemet/shared";
import { ChatApiError, uploadVoiceMessage } from "../../lib/chat/api.js";
import { formatDuration } from "../../lib/chat/formatDuration.js";
import {
  isVoiceRecordingSupported,
  useVoiceRecorder,
  type VoiceRecording,
} from "../../lib/chat/useVoiceRecorder.js";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { useToast } from "../ui/Toast.js";

// Un appui plus bref vient d'un double appui de lecteur d'écran ou d'un
// simple toucher : l'enregistrement continue, arrêté par Envoyer ou la corbeille.
const TAP_MAX_MS = 300;

// Glissé au-delà, vers la gauche, l'enregistrement tenu au doigt est jeté.
const CANCEL_DISTANCE_PX = 96;

interface Hold {
  pointerId: number;
  startX: number;
  startedAt: number;
}

/**
 * Message vocal d'un composeur. Sur écran tactile, on maintient le micro et
 * on relâche pour envoyer, ou on glisse à gauche pour annuler. À la souris
 * ou au clavier, un clic démarre, puis "Envoyer" ou "Annuler" (Échap).
 * Le bouton se pose dans la rangée du composeur, qui doit être en
 * `relative` : la barre d'enregistrement la recouvre. La ligne d'aide
 * (micro refusé, appui trop court) se place sous la rangée.
 */
export function useVoiceMessage({
  channelId,
  disabled,
  onRecorded,
}: {
  channelId: string | null;
  disabled?: boolean;
  onRecorded: (attachmentId: string) => void;
}): { button: ReactNode; overlay: ReactNode; notice: ReactNode } {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [mode, setMode] = useState<"hold" | "click">("click");
  const hold = useRef<Hold | null>(null);
  const touchStarted = useRef(false);
  const sendButton = useRef<HTMLButtonElement>(null);
  const micButton = useRef<HTMLButtonElement>(null);

  async function deliver(recording: VoiceRecording | null) {
    if (!recording || !channelId) return;
    setSending(true);
    try {
      const attachment = await uploadVoiceMessage(channelId, recording.blob, recording.durationMs);
      onRecorded(attachment.id);
    } catch (error) {
      toast.show(
        error instanceof ChatApiError ? error.message : fr.chat.voiceUploadError,
        "danger",
      );
    } finally {
      setSending(false);
    }
  }

  const recorder = useVoiceRecorder((recording) => void deliver(recording));

  useEffect(() => {
    if (recorder.recording && mode === "click") sendButton.current?.focus();
  }, [recorder.recording, mode]);

  if (!isVoiceRecordingSupported()) return { button: null, overlay: null, notice: null };

  function startRecording(nextMode: "hold" | "click") {
    setDragX(0);
    setMode(nextMode);
    void recorder.start();
  }

  async function finishRecording() {
    const recording = await recorder.finish();
    micButton.current?.focus();
    await deliver(recording);
  }

  async function cancelRecording() {
    await recorder.cancel();
    micButton.current?.focus();
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") {
      touchStarted.current = false;
      return;
    }
    if (disabled || sending) return;
    // Pas de menu contextuel ni de sélection pendant l'appui long.
    event.preventDefault();
    touchStarted.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    hold.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startedAt: event.timeStamp,
    };
    startRecording("hold");
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = hold.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const offset = Math.min(0, event.clientX - current.startX);
    setDragX(offset);
    if (offset <= -CANCEL_DISTANCE_PX) {
      hold.current = null;
      navigator.vibrate?.(20);
      void recorder.cancel();
    }
  }

  async function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const current = hold.current;
    if (!current || current.pointerId !== event.pointerId) return;
    hold.current = null;
    if (event.timeStamp - current.startedAt < TAP_MAX_MS) {
      setMode("click");
      return;
    }
    await deliver(await recorder.finish());
  }

  function onPointerCancel() {
    if (!hold.current) return;
    hold.current = null;
    void recorder.cancel();
  }

  function onClick() {
    // Un appui tactile a déjà été géré par onPointerDown et onPointerUp.
    if (touchStarted.current) {
      touchStarted.current = false;
      return;
    }
    if (recorder.recording) void finishRecording();
    else startRecording("click");
  }

  const elapsed = (
    <span className="flex items-center gap-2 font-mono text-sm tabular-nums text-text">
      <span
        className="voice-recording-dot size-2.5 shrink-0 rounded-full bg-danger"
        aria-hidden="true"
      />
      <span aria-hidden="true">{formatDuration(recorder.elapsedMs)}</span>
      <span className="sr-only">
        {fr.chat.voiceElapsed(
          formatDuration(recorder.elapsedMs),
          formatDuration(VOICE_MAX_DURATION_MS),
        )}
      </span>
    </span>
  );

  const button = (
    <IconButton
      ref={micButton}
      aria-label={fr.chat.voiceRecord}
      aria-pressed={recorder.recording}
      disabled={disabled || !channelId}
      loading={sending}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => void onPointerUp(event)}
      onPointerCancel={onPointerCancel}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        "relative z-20 touch-none select-none [-webkit-touch-callout:none]",
        recorder.recording &&
          mode === "hold" &&
          "scale-125 bg-danger text-danger-on hover:bg-danger hover:text-danger-on",
      )}
    >
      <Mic className="size-4" aria-hidden="true" />
    </IconButton>
  );

  const overlay = recorder.recording ? (
    <div
      role="group"
      aria-label={fr.chat.voiceRecording}
      className="absolute inset-0 z-10 flex items-center gap-3 rounded-card bg-bg"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          void cancelRecording();
        }
      }}
    >
      {mode === "click" ? (
        <>
          <IconButton aria-label={fr.chat.voiceCancel} onClick={() => void cancelRecording()}>
            <Trash2 className="size-4" aria-hidden="true" />
          </IconButton>
          <div className="flex-1">{elapsed}</div>
          <Button
            ref={sendButton}
            onClick={() => void finishRecording()}
            aria-label={fr.chat.voiceSend}
            className="max-md:size-control-mobile max-md:px-0"
          >
            <Send className="size-4" aria-hidden="true" />
          </Button>
        </>
      ) : (
        <div className="pointer-events-none flex flex-1 items-center gap-3 pl-2">
          {elapsed}
          <span
            className="flex items-center gap-1 text-sm text-text-2"
            style={{
              transform: `translateX(${dragX}px)`,
              opacity: 1 + dragX / (CANCEL_DISTANCE_PX * 1.5),
            }}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {fr.chat.voiceSlideToCancel}
          </span>
        </div>
      )}
    </div>
  ) : null;

  const message =
    recorder.failure === "denied"
      ? fr.chat.voiceDenied
      : recorder.failure === "unavailable"
        ? fr.chat.voiceUnavailable
        : null;
  // Seuls le début et la fin sont annoncés : la durée, qui change chaque
  // seconde, reste dans la barre, lisible à la demande.
  const notice = (
    <>
      <p className="sr-only" aria-live="polite">
        {recorder.recording ? fr.chat.voiceRecording : ""}
      </p>
      {message && (
        <p role="status" className="text-xs text-text-2">
          {message}
        </p>
      )}
    </>
  );

  return { button, overlay, notice };
}
