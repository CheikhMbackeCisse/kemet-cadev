import { fr } from "../../i18n/fr.js";

export type VideoUploadState =
  | { phase: "idle" }
  | { phase: "preparing" }
  | { phase: "uploading"; percent: number }
  | { phase: "done" };

/** Texte affiché sous les boutons : l'avancement au pourcent près. */
export function videoUploadLabel(state: VideoUploadState): string | null {
  if (state.phase === "preparing") return fr.feed.videoPreparing;
  if (state.phase === "uploading") return fr.feed.videoUploading(state.percent);
  return null;
}

/**
 * Texte de la zone lue par un lecteur d'écran : il ne change qu'au début, à
 * 50 % et à la fin, pour ne pas annoncer chaque pourcent d'un envoi en 3G.
 */
export function videoUploadAnnouncement(state: VideoUploadState): string {
  switch (state.phase) {
    case "idle":
      return "";
    case "preparing":
      return fr.feed.videoPreparing;
    case "uploading":
      return state.percent >= 50 ? fr.feed.videoUploading(50) : fr.feed.videoPreparing;
    case "done":
      return fr.feed.videoUploaded;
  }
}
