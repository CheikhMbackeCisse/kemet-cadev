import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_MAX_DURATION_MS } from "@kemet/shared";

// Ordre de préférence : Opus en WebM (Chrome, Firefox, Android), AAC en MP4
// (Safari, iPhone), puis Ogg. Le fichier part tel quel, jamais converti.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
// La voix reste intelligible à 32 kbit/s : deux minutes font moins de 500 ko.
const AUDIO_BITS_PER_SECOND = 32_000;
// En dessous, un appui trop court plutôt qu'un vrai message.
export const VOICE_MIN_DURATION_MS = 600;

export type VoiceRecorderFailure = "denied" | "unavailable";

export interface VoiceRecording {
  blob: Blob;
  durationMs: number;
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "MediaRecorder" in window &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

function pickMimeType(): string | undefined {
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

interface Session {
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  chunks: Blob[];
  startedAt: number;
  /** Arrêt demandé avant que le micro ne soit prêt (appui relâché tôt). */
  ending: "send" | "cancel" | null;
  resolve: (recording: VoiceRecording | null) => void;
}

/**
 * Enregistre un message vocal avec MediaRecorder. `start` ouvre le micro ;
 * `finish` rend l'enregistrement, `cancel` le jette. Il s'arrête de lui-même
 * à deux minutes et rend alors l'enregistrement à `onLimit`.
 */
export function useVoiceRecorder(onLimit: (recording: VoiceRecording | null) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [failure, setFailure] = useState<VoiceRecorderFailure | null>(null);
  const session = useRef<Session | null>(null);
  const onLimitRef = useRef(onLimit);
  onLimitRef.current = onLimit;

  const release = useCallback(() => {
    session.current?.stream?.getTracks().forEach((track) => track.stop());
    session.current = null;
    setRecording(false);
    setElapsedMs(0);
  }, []);

  const end = useCallback(
    (mode: "send" | "cancel"): Promise<VoiceRecording | null> => {
      const current = session.current;
      if (!current) return Promise.resolve(null);
      return new Promise((resolve) => {
        current.resolve = resolve;
        current.ending = mode;
        if (!current.recorder) return;
        if (current.recorder.state === "inactive") {
          resolve(null);
          release();
          return;
        }
        current.recorder.stop();
      });
    },
    [release],
  );

  const start = useCallback(async () => {
    if (session.current) return;
    setFailure(null);
    const current: Session = {
      recorder: null,
      stream: null,
      chunks: [],
      startedAt: 0,
      ending: null,
      resolve: () => undefined,
    };
    session.current = current;
    setRecording(true);
    setElapsedMs(0);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = (error as DOMException).name;
      setFailure(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      current.resolve(null);
      release();
      return;
    }
    if (session.current !== current || current.ending === "cancel") {
      stream.getTracks().forEach((track) => track.stop());
      current.resolve(null);
      if (session.current === current) release();
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    current.stream = stream;
    current.recorder = recorder;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) current.chunks.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      const durationMs = Math.min(Date.now() - current.startedAt, VOICE_MAX_DURATION_MS);
      const result =
        current.ending === "send" && durationMs >= VOICE_MIN_DURATION_MS && current.chunks.length > 0
          ? { blob: new Blob(current.chunks, { type: recorder.mimeType }), durationMs }
          : null;
      current.resolve(result);
      if (session.current === current) release();
    });
    current.startedAt = Date.now();
    recorder.start();
    // Relâché pendant l'ouverture du micro : on s'arrête aussitôt.
    if (current.ending) recorder.stop();
  }, [release]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const current = session.current;
      if (!current?.recorder) return;
      const elapsed = Date.now() - current.startedAt;
      setElapsedMs(elapsed);
      if (elapsed >= VOICE_MAX_DURATION_MS && !current.ending) {
        void end("send").then((result) => onLimitRef.current(result));
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [recording, end]);

  // Micro jamais laissé ouvert après le départ de la page.
  useEffect(
    () => () => {
      const current = session.current;
      if (!current) return;
      current.ending = "cancel";
      if (current.recorder?.state === "recording") current.recorder.stop();
      current.stream?.getTracks().forEach((track) => track.stop());
      session.current = null;
    },
    [],
  );

  return {
    recording,
    elapsedMs,
    failure,
    clearFailure: () => setFailure(null),
    start,
    finish: () => end("send"),
    cancel: () => end("cancel"),
  };
}
