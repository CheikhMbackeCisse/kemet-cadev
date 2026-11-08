import { Bookmark } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PostSummary } from "@kemet/shared";
import { PostCard, PostCardSkeleton } from "../components/feed/PostCard.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { Button } from "../components/ui/Button.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { useToast } from "../components/ui/Toast.js";
import { listBookmarkedPosts, setPostBookmark, togglePostReaction } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

/**
 * Posts enregistrés, du plus récent enregistrement au plus ancien. Retirer
 * un post le laisse dans la liste jusqu'au prochain chargement : un appui de
 * trop se rattrape sur place.
 */
export function SavedPostsPage() {
  const { status, isSuspended } = useSession();
  const toast = useToast();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const canInteract = status === "ready" && !isSuspended;

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

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
    setPosts((current) => current?.map((post) => (post.id === postId ? { ...post, ...change } : post)) ?? null);
  }

  async function handleSave(post: PostSummary) {
    try {
      update(post.id, await setPostBookmark(post.id, !post.savedByMe));
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

  const header = <h1 className="text-lg font-bold text-text">{fr.saved.title}</h1>;

  return (
    <ReadingPage
      activeSection="moi"
      header={header}
      className="pb-[calc(76px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-8"
    >
      {error ? (
        <ErrorState message={fr.saved.loadError} retry={{ label: fr.chat.retry, onClick: load }} />
      ) : posts === null ? (
        <div className="flex flex-col divide-y divide-border">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon={Bookmark} message={fr.saved.empty} />
      ) : (
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
                isOwnPost={false}
                canFeedback={false}
                canReport={false}
                onReact={() => void handleReact(post)}
                onSave={() => void handleSave(post)}
                onFeedback={() => {}}
                onDelete={() => {}}
              />
            ))}
          </ul>
          {nextCursor && (
            <Button variant="secondary" onClick={() => void loadMore()} className="self-center">
              {fr.feed.loadMore}
            </Button>
          )}
        </div>
      )}
    </ReadingPage>
  );
}
