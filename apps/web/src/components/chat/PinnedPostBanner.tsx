import { Pin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSpacePinnedPost, postAttachmentUrl } from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";

/**
 * Bandeau du post épinglé d'un espace, au-dessus des messages de chacun de
 * ses salons. Il ouvre le post entier. Rien n'est affiché pendant le
 * chargement ni en cas d'erreur : le salon reste utilisable sans lui.
 */
export function PinnedPostBanner({ spaceId }: { spaceId: string }) {
  const query = useQuery({
    queryKey: ["spaces", spaceId, "pinned-post"],
    queryFn: () => getSpacePinnedPost(spaceId),
    staleTime: 5 * 60 * 1000,
  });
  const pinned = query.data?.pinned;
  if (!pinned) return null;

  return (
    <a
      href={`/fil/${pinned.postId}`}
      aria-label={fr.spaces.openPinned(pinned.title)}
      className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:px-6"
    >
      {pinned.imageId ? (
        <img
          src={postAttachmentUrl(pinned.imageId)}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="size-10 shrink-0 rounded-control bg-surface-2 object-contain"
        />
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1 text-xs font-medium text-text-2">
          <Pin className="size-3.5" aria-hidden="true" />
          {fr.spaces.pinned}
        </span>
        <span className="truncate text-sm font-semibold text-text">{pinned.title}</span>
      </span>
    </a>
  );
}
