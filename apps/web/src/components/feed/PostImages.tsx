import type { Attachment } from "@kemet/shared";
import { postAttachmentUrl } from "../../lib/chat/api.js";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";

export interface PostImagesProps {
  attachments: Attachment[];
  className?: string;
  /** Faux quand le bloc est déjà dans un lien (aperçu d'un post partagé). */
  linked?: boolean;
}

// Les dimensions des images ne sont pas connues avant leur arrivée : un cadre
// de proportions fixes garde la place, et le fil ne saute pas pendant leur
// téléchargement (plusieurs secondes en 3G). Une image seule y tient entière ;
// en grille, elle est recadrée et son lien ouvre l'image complète.
function image(attachment: Attachment, frame: string, fit: "contain" | "cover", linked: boolean) {
  const picture = (
    <img
      src={postAttachmentUrl(attachment.id)}
      alt={attachment.originalName}
      loading="lazy"
      decoding="async"
      className={cn("block w-full bg-surface-2", frame, fit === "contain" ? "object-contain" : "object-cover")}
    />
  );
  if (!linked) return <div key={attachment.id}>{picture}</div>;
  return (
    <a
      key={attachment.id}
      href={postAttachmentUrl(attachment.id)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={fr.feed.openImage(attachment.originalName)}
      className="block"
    >
      {picture}
    </a>
  );
}

export function PostImages({ attachments: all, className, linked = true }: PostImagesProps) {
  // Images effacées avec le compte de leur auteur : on le dit, sans cadre vide.
  const attachments = all.filter((attachment) => !attachment.removed);
  if (attachments.length === 0) {
    return all.length > 0 ? (
      <p className={cn("mt-2 text-sm text-subtle", className)}>{fr.chat.imagesRemoved(all.length)}</p>
    ) : null;
  }

  // Pas de grille à 2 colonnes pour 3 images : la troisième laisserait une
  // case vide. Une rangée pleine largeur, puis deux colonnes.
  const layout =
    attachments.length === 3 ? (
      <div className="flex flex-col gap-1">
        {image(attachments[0]!, "aspect-[2/1]", "cover", linked)}
        <div className="grid grid-cols-2 gap-1">
          {image(attachments[1]!, "aspect-[4/3]", "cover", linked)}
          {image(attachments[2]!, "aspect-[4/3]", "cover", linked)}
        </div>
      </div>
    ) : (
      <div className={cn("grid gap-1", attachments.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {attachments.map((attachment) =>
          attachments.length > 1
            ? image(attachment, "aspect-square", "cover", linked)
            : image(attachment, "aspect-[16/9]", "contain", linked),
        )}
      </div>
    );

  return (
    <div className={cn("mt-2 overflow-hidden rounded-card border border-border", className)}>
      {layout}
    </div>
  );
}
