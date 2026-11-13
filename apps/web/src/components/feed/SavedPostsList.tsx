import { Bookmark } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PostSummary } from "@kemet/shared";
import { navigate } from "../../lib/navigation/navigate.js";
import {
  deletePost,
  listBookmarkedPosts,
  setPostBookmark,
  togglePostReaction,
} from "../../lib/chat/api.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { useToast } from "../ui/Toast.js";
import { PostCard, PostCardSkeleton } from "./PostCard.js";

/**
 * Posts enregistrés, du plus récent enregistrement au plus ancien. Retirer
 * un post le laisse dans la liste jusqu'au prochain chargement : un appui de
 * trop se rattrape sur place.
 */
export function SavedPostsList() {
  const { status, isSuspended, profile } = useSession();
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const toast = useToast();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const canInteract = status === "ready" && !isSuspended;

  const load = useCallback(() => {
    setError(false);
    setPosts(null);
    listBookmarkedPosts()
      .then((page) => {
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const page = await listBookmarkedPosts(nextCursor);
      setPosts((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      toast.show(fr.saved.loadError, "danger");
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
    return (
      <ErrorState message={fr.saved.loadError} retry={{ label: fr.chat.retry, onClick: load }} />
    );
  }
  if (posts === null) {
    return (
      <div className="flex flex-col divide-y divide-border">
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        message={fr.saved.empty}
        action={{ label: fr.saved.goToFeed, onClick: () => navigate("/fil") }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            as="li"
            bodyHref={`/fil/${post.id}`}
            replyHref={`/fil/${post.id}`}
            canInteract={canInteract}
            isOwnPost={profile?.id === post.authorId && !post.deletedAt}
            canFeedback={canInteract && post.format === "a_tester"}
            canReport={canInteract && !post.deletedAt}
            onReact={() => void handleReact(post)}
            onSave={() => void handleSave(post)}
            // Le retour structuré se donne depuis la page du post.
            onFeedback={() => navigate(`/fil/${post.id}`)}
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
