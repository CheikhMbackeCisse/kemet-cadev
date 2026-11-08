import { Play } from "lucide-react";
import { useState } from "react";
import { workMediaContentPath, type WorkVideo as WorkVideoData } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";

/**
 * Vidéo d'un travail. Un fichier envoyé passe par le lecteur du navigateur,
 * qui lit par plages. Un lien YouTube n'est chargé qu'au clic, depuis
 * youtube-nocookie : aucune requête vers YouTube avant que la personne le
 * demande.
 */
export function WorkVideo({ video, title }: { video: WorkVideoData; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (video.kind === "file") {
    return (
      <video
        controls
        preload="metadata"
        className="aspect-video w-full rounded-card border border-border bg-black"
        aria-label={title}
      >
        <source src={workMediaContentPath(video.id)} type={video.mimeType} />
        {fr.works.videoUnsupported}
      </video>
    );
  }

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface-2 text-text-2 hover:bg-accent-soft"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
          <Play className="size-5" aria-hidden="true" />
        </span>
        <span className="text-base font-medium text-text">{fr.works.playYoutube}</span>
        <span className="px-4 text-center text-xs text-subtle">{fr.works.youtubeNotice}</span>
      </button>
    );
  }

  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtubeId)}?autoplay=1&rel=0`}
      title={title}
      className="aspect-video w-full rounded-card border border-border"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      // Le lecteur refuse de démarrer sans l'origine de la page en référent.
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
    />
  );
}
