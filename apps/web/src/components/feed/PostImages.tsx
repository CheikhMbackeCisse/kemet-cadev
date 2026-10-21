import type { Attachment } from "@kemet/shared";
import { postAttachmentUrl } from "../../lib/chat/api.js";
import { cn } from "../../lib/cn.js";

export interface PostImagesProps {
  attachments: Attachment[];
  className?: string;
}

function image(attachment: Attachment, className: string) {
  return (
    <img
      key={attachment.id}
      src={postAttachmentUrl(attachment.id)}
      alt={attachment.originalName}
      className={cn("w-full object-cover", className)}
    />
  );
}

export function PostImages({ attachments, className }: PostImagesProps) {
  if (attachments.length === 0) return null;

  // Pas de grille à 2 colonnes pour 3 images : le placement automatique CSS
  // laisserait une case vide à côté de la troisième. Une rangée pleine
  // largeur puis deux colonnes évite le trou sans copier la mosaïque de X ou
  // LinkedIn (DESIGN.md, principe 6).
  const layout =
    attachments.length === 3 ? (
      <div className="flex flex-col gap-1">
        {image(attachments[0]!, "max-h-64")}
        <div className="grid grid-cols-2 gap-1">
          {image(attachments[1]!, "max-h-48")}
          {image(attachments[2]!, "max-h-48")}
        </div>
      </div>
    ) : (
      <div className={cn("grid gap-1", attachments.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {attachments.map((attachment) => image(attachment, "max-h-80"))}
      </div>
    );

  return (
    <div className={cn("mt-2 overflow-hidden rounded-card border border-border", className)}>
      {layout}
    </div>
  );
}
