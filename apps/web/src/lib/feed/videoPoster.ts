import {
  POST_VIDEO_MAX_BYTES,
  POST_VIDEO_MAX_DURATION_MS,
  POST_VIDEO_MIME_TYPES,
} from "@kemet/shared";
import { fr } from "../../i18n/fr.js";

/** Côté le plus long de l'image d'aperçu : assez pour un téléphone, léger en 3G. */
const POSTER_MAX_SIDE = 720;
const LOAD_TIMEOUT_MS = 15_000;

export class VideoCheckError extends Error {}

export interface PreparedVideo {
  poster: Blob;
  width: number;
  height: number;
}

/** Moment de l'image d'aperçu : une seconde, ou plus tôt pour une vidéo très courte. */
export function posterTime(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0.1;
  return Math.min(1, durationSeconds / 4);
}

/** Taille de l'aperçu : celle de la vidéo, réduite pour que son plus grand côté tienne en 720 px. */
export function posterSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, POSTER_MAX_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function once(target: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new VideoCheckError(fr.feed.videoUnreadable)), LOAD_TIMEOUT_MS);
    target.addEventListener(
      event,
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    target.addEventListener(
      "error",
      () => {
        window.clearTimeout(timer);
        reject(new VideoCheckError(fr.feed.videoUnreadable));
      },
      { once: true },
    );
  });
}

/**
 * Vérifie une vidéo choisie et en tire l'image d'aperçu, dans le navigateur :
 * le serveur ne décode jamais une vidéo. Une vidéo que ce navigateur ne sait
 * pas lire est refusée ici, avant tout envoi.
 */
export async function prepareVideo(file: File): Promise<PreparedVideo> {
  if (!(POST_VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new VideoCheckError(fr.feed.videoWrongType);
  }
  if (file.size > POST_VIDEO_MAX_BYTES) throw new VideoCheckError(fr.feed.videoTooBig);

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const metadata = once(video, "loadedmetadata");
    video.src = url;
    await metadata;
    // Un enregistrement de MediaRecorder annonce une durée infinie : le
    // serveur la lit alors dans le fichier.
    if (Number.isFinite(video.duration) && video.duration * 1000 > POST_VIDEO_MAX_DURATION_MS + 500) {
      throw new VideoCheckError(fr.feed.videoTooLong);
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) throw new VideoCheckError(fr.feed.videoUnreadable);
    const seeked = once(video, "seeked");
    video.currentTime = posterTime(video.duration);
    await seeked;

    const size = posterSize(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d")!.drawImage(video, 0, 0, size.width, size.height);
    const poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!poster) throw new VideoCheckError(fr.feed.videoUnreadable);
    return { poster, ...size };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
