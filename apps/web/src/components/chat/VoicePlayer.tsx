import { Loader2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Attachment } from "@kemet/shared";
import { attachmentUrl } from "../../lib/chat/api.js";
import { formatDuration } from "../../lib/chat/formatDuration.js";
import { fr } from "../../i18n/fr.js";

// Un seul message vocal joue à la fois dans la page.
const PLAY_EVENT = "kemet:voice-play";

/**
 * Lecteur d'un message vocal : lecture et pause, barre de progression qui
 * permet d'avancer, durée. Rien n'est téléchargé avant le premier appui,
 * jamais de lecture automatique. La durée vient du serveur : un WebM de
 * MediaRecorder n'en annonce aucune.
 */
export function VoicePlayer({ attachment }: { attachment: Attachment }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  // Rien n'est téléchargé avant le premier appui : il peut se passer un moment.
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const durationMs = attachment.durationMs ?? 0;

  useEffect(() => {
    const onOtherPlay = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== attachment.id) audio.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, [attachment.id]);

  function toggle() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: attachment.id }));
      // Après un échec, l'élément reste en erreur tant qu'il n'est pas rechargé.
      if (failed) element.load();
      setFailed(false);
      setLoading(true);
      element.play().catch((error: unknown) => {
        // Une pause demandée avant le début de la lecture n'est pas une erreur.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoading(false);
        setFailed(true);
      });
    } else {
      element.pause();
    }
  }

  function seek(value: number) {
    const element = audio.current;
    if (!element) return;
    element.currentTime = value / 1000;
    setPositionMs(value);
  }

  const shownMs = playing || positionMs > 0 ? positionMs : durationMs;

  return (
    <div className="flex w-full max-w-xs flex-col gap-1">
      <div className="flex items-center gap-2 rounded-card bg-surface-2 py-1 pl-1 pr-3">
        <audio
          ref={audio}
          src={attachmentUrl(attachment.id)}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPlaying={() => setLoading(false)}
          onPause={() => {
            setPlaying(false);
            setLoading(false);
          }}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          onTimeUpdate={(event) =>
            setPositionMs(Math.min(event.currentTarget.currentTime * 1000, durationMs))
          }
          onEnded={() => {
            setPlaying(false);
            setPositionMs(0);
          }}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={
            loading
              ? fr.chat.voiceLoading
              : playing
                ? fr.chat.voicePause
                : fr.chat.voicePlay(formatDuration(durationMs))
          }
          className="inline-flex size-control shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover max-md:size-control-mobile"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause className="size-4" fill="currentColor" aria-hidden="true" />
          ) : (
            <Play className="size-4 translate-x-px" fill="currentColor" aria-hidden="true" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(durationMs, 1)}
          step={100}
          value={positionMs}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label={fr.chat.voicePosition}
          aria-valuetext={fr.chat.voiceElapsed(
            formatDuration(positionMs),
            formatDuration(durationMs),
          )}
          className="voice-progress h-1.5 min-w-0 flex-1 cursor-pointer"
        />
        <span className="shrink-0 font-mono text-xs tabular-nums text-text-2">
          {formatDuration(shownMs)}
        </span>
      </div>
      {failed && (
        <p role="alert" className="text-xs text-text-2">
          {fr.chat.voicePlayError}{" "}
          <button
            type="button"
            onClick={toggle}
            className="font-medium text-primary hover:underline"
          >
            {fr.chat.voiceRetry}
          </button>
        </p>
      )}
    </div>
  );
}
