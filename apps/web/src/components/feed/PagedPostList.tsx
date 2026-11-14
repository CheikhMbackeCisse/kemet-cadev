import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PostSummary } from "@kemet/shared";
import { navigate } from "../../lib/navigation/navigate.js";
import { deletePost, setPostBookmark, togglePostReaction, type Page } from "../../lib/chat/api.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { useToast } from "../ui/Toast.js";
import { PostCard, PostCardSkeleton } from "./PostCard.js";

export interface PagedPostListProps {
  loadPage: (cursor?: string) => Promise<Page<PostSummary>>;
  /** Première page déjà lue par le parent, pour ne pas la redemander. */
  initialPage?: Page<PostSummary>;
  loadError: string;
  empty: { icon: LucideIcon; message: string; action?: { label: string; href: string } };
}

/**
 * Liste paginée de posts du profil (enregistrés, republiés). Retirer un
 * enregistrement laisse le post dans la liste jusqu'au prochain chargement :
 * un appui de trop se rattrape sur place.
 */
export function PagedPostList({ loadPage, initialPage, loadError, empty }: PagedPostListProps) {
  const { status, isSuspended, profile } = useSession();
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const toast = useToast();
  const [posts, setPosts] = useState<PostSummary[] | null>(initialPage?.items ?? null);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage?.nextCursor ?? null);
  const [error, setError] = useState(false);
  const canInteract = status === "ready" && !isSuspended;

  const load = useCallback(() => {
    setError(false);
    setPosts(null);
    loadPage()
      .then((page) => {
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => setError(true));
  }, [loadPage]);

  const hasInitialPage = initialPage !== undefined;
  useEffect(() => {
    if (status === "ready" && !hasInitialPage) load();
  }, [status, load, hasInitialPage]);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const page = await loadPage(nextCursor);
      setPosts((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      toast.show(loadError, "danger");
    }
  }

  function update(postId: string, change: Partial<PostSummary>) {
    setPosts(
      (current) =>
        current?.map((post) => (post.id === postId ? { ...post, ...change } : post)) ?? null,
    );
  }

  async function handleSave(post: PostSummary) {
    try {
      const result = await setPostBookmark(post.id, !post.savedByMe);
      update(post.id, result);
      toast.show(result.savedByMe ? fr.feed.savedToast : fr.feed.unsavedToast, "success");
    } catch {
      toast.show(fr.feed.saveError, "danger");
    }
  }

  async function handleReact(post: PostSummary) {
    try {
      update(post.id, await togglePostReaction(post.id));
    } catch {
      toast.show(fr.feed.reactError, "danger");
    }
  }

  async function handleDelete() {
    if (!postToDelete) return;
    const postId = postToDelete;
    setPostToDelete(null);
    try {
      await deletePost(postId);
      setPosts((current) => current?.filter((post) => post.id !== postId) ?? null);
    } catch {
      toast.show(fr.feed.postDeleteError, "danger");
    }
  }

  if (error) {
    return <ErrorState message={loadError} retry={{ label: fr.chat.retry, onClick: load }} />;
  }
  if (posts === null) {
    return (
      <div className="post-band-list flex flex-col">
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={empty.icon}
        message={empty.message}
        {...(empty.action && {
          action: { label: empty.action.label, onClick: () => navigate(empty.action!.href) },
        })}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="post-band-list flex flex-col">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            as="li"
            bodyHref={`/fil/${post.id}`}
            replyHref={`/fil/${post.id}`}
            canInteract={canInteract}
            isOwnPost={profile?.id === post.authorId && !post.deletedAt}
            canReport={canInteract && !post.deletedAt}
            onReact={() => void handleReact(post)}
            onSave={() => void handleSave(post)}
            // Le retour structuré se donne depuis la page du post.
            onDelete={() => setPostToDelete(post.id)}
            onChange={(change) => update(post.id, change)}
          />
        ))}
      </ul>
      {nextCursor && (
        <Button variant="secondary" onClick={() => void loadMore()} className="self-center">
          {fr.feed.loadMore}
        </Button>
      )}
      <Dialog
        open={postToDelete !== null}
        onOpenChange={(open) => !open && setPostToDelete(null)}
        title={fr.feed.delete}
        description={fr.feed.deleteConfirm}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPostToDelete(null)}>
            {fr.feed.cancel}
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()}>
            {fr.feed.delete}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
