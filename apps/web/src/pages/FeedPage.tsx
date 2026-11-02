import { Plus, Rss } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FeedTab, PostSummary } from "@kemet/shared";
import {
  ChatApiError,
  createPostFeedback,
  deletePost,
  listPosts,
  sharePost,
  togglePostReaction,
} from "../lib/chat/api.js";
import { PostCard, PostCardSkeleton } from "../components/feed/PostCard.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Tabs } from "../components/ui/Tabs.js";
import { Textarea } from "../components/ui/Textarea.js";
import { useToast } from "../components/ui/Toast.js";
import { AccountMenu } from "../components/shell/AccountMenu.js";
import { InstallBanner } from "../components/shell/InstallBanner.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";
import { SuspendedBanner } from "../components/shell/SuspendedBanner.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

function PostListItem({
  post,
  canInteract,
  viewerProfileId,
  onReact,
  onShare,
  onFeedback,
  onDeleteRequest,
}: {
  post: PostSummary;
  canInteract: boolean;
  viewerProfileId: string | null;
  onReact: (postId: string) => void;
  onShare: (postId: string) => void;
  onFeedback: (postId: string) => void;
  onDeleteRequest: (postId: string) => void;
}) {
  const isOwnPost =
    viewerProfileId !== null && viewerProfileId === post.authorId && !post.deletedAt;
  return (
    <PostCard
      post={post}
      as="li"
      bodyHref={`/fil/${post.id}`}
      replyHref={`/fil/${post.id}`}
      canInteract={canInteract}
      isOwnPost={isOwnPost}
      canFeedback={canInteract && post.format === "a_tester"}
      canReport={canInteract && !post.deletedAt}
      onReact={() => onReact(post.id)}
      onShare={() => onShare(post.id)}
      onFeedback={() => onFeedback(post.id)}
      onDelete={() => onDeleteRequest(post.id)}
    />
  );
}

export function FeedPage() {
  const toast = useToast();
  const { status, profile, isSuspended } = useSession();
  const canInteract = status === "ready" && !isSuspended;
  // "Pour toi" par defaut pour tout le monde : un nouveau compte ne suit
  // encore personne, et ouvrait donc le fil sur une page vide.
  const [tab, setTab] = useState<FeedTab>("pour-toi");
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [feedbackPostId, setFeedbackPostId] = useState<string | null>(null);
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const load = useCallback((currentTab: FeedTab) => {
    setLoading(true);
    setError(false);
    listPosts(currentTab)
      .then((page) => {
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(tab), [tab, load]);

  useEffect(() => {
    if (status === "visitor") setTab("pour-toi");
  }, [status]);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const page = await listPosts(tab, nextCursor);
      setPosts((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      toast.show(fr.feed.loadingError, "danger");
    }
  }

  async function handleReact(postId: string) {
    try {
      const result = await togglePostReaction(postId);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, utileCount: result.utileCount, reactedByMe: result.reactedByMe }
            : post,
        ),
      );
    } catch {
      toast.show(fr.feed.reactError, "danger");
    }
  }

  async function handleShare(postId: string) {
    try {
      await sharePost(postId);
      toast.show(fr.feed.shared, "success");
      load(tab);
    } catch {
      toast.show(fr.feed.shareError, "danger");
    }
  }

  async function handleSubmitFeedback() {
    if (!feedbackPostId) return;
    setFeedbackError(null);
    try {
      await createPostFeedback(feedbackPostId, feedbackBody.trim());
      setFeedbackPostId(null);
      setFeedbackBody("");
      toast.show(fr.feed.feedbackSent, "success");
      load(tab);
    } catch (err) {
      setFeedbackError(
        err instanceof ChatApiError && err.statusCode === 409
          ? fr.feed.feedbackAlready
          : fr.feed.feedbackError,
      );
    }
  }

  async function handleDeletePost() {
    if (!postToDelete) return;
    const postId = postToDelete;
    setPostToDelete(null);
    try {
      await deletePost(postId);
      setPosts((current) => current.filter((post) => post.id !== postId));
    } catch {
      toast.show(fr.feed.postDeleteError, "danger");
    }
  }

  const feedContent = loading ? (
    <div className="flex flex-col divide-y divide-border">
      <PostCardSkeleton />
      <PostCardSkeleton />
    </div>
  ) : error ? (
    <ErrorState
      message={fr.feed.loadingError}
      retry={{ label: fr.chat.retry, onClick: () => load(tab) }}
    />
  ) : posts.length === 0 ? (
    <EmptyState icon={Rss} message={fr.feed.noPosts} />
  ) : (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {posts.map((post) => (
          <PostListItem
            key={post.id}
            post={post}
            canInteract={canInteract}
            viewerProfileId={profile?.id ?? null}
            onReact={handleReact}
            onShare={handleShare}
            onFeedback={setFeedbackPostId}
            onDeleteRequest={setPostToDelete}
          />
        ))}
      </ul>
      {nextCursor && (
        <Button variant="secondary" onClick={loadMore} className="self-center">
          {fr.feed.loadMore}
        </Button>
      )}
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-bold text-text">{fr.feed.title}</h1>
      <div className="flex items-center gap-2">
        {canInteract && (
          <a
            href="/fil/nouveau"
            className="inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden="true" />
            {fr.feed.newPostLink}
          </a>
        )}
        <AccountMenu />
      </div>
    </div>
  );

  return (
    <>
      <ReadingPage
        activeSection="fil"
        header={header}
        className="pb-[calc(76px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-8"
      >
        {status === "visitor" && (
          <>
            <VisitorBanner />
            {/* Ce qui distingue Kemet, dit en une ligne à qui arrive sans compte. */}
            <p className="text-sm text-text-2">
              {fr.skills.principle}{" "}
              <a href="/skills" className="text-link hover:underline">
                {fr.skills.browse}
              </a>
            </p>
          </>
        )}
        {status === "ready" && <InstallBanner />}
        {isSuspended && <SuspendedBanner />}

        {/* Un visiteur n'a pas d'abonnements : une barre d'onglets a un seul
            onglet ressemblerait a un bouton isole. */}
        {status === "visitor" ? (
          feedContent
        ) : (
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as FeedTab)}
            items={[
              {
                value: "pour-toi",
                label: fr.feed.tabPourToi,
                content: tab === "pour-toi" ? feedContent : null,
              },
              {
                value: "abonnements",
                label: fr.feed.tabAbonnements,
                content: tab === "abonnements" ? feedContent : null,
              },
            ]}
          />
        )}

        <Dialog
          open={feedbackPostId !== null}
          onOpenChange={(open) => !open && setFeedbackPostId(null)}
          title={fr.feed.feedbackTitle}
        >
          <div className="flex flex-col gap-3">
            <Textarea
              placeholder={fr.feed.feedbackPlaceholder}
              aria-label={fr.feed.feedbackPlaceholder}
              value={feedbackBody}
              onChange={(event) => setFeedbackBody(event.target.value)}
              autoFocus
            />
            {feedbackError && (
              <p className="text-sm text-danger" role="alert">
                {feedbackError}
              </p>
            )}
            <Button onClick={handleSubmitFeedback} disabled={!feedbackBody.trim()}>
              {fr.feed.feedbackSubmit}
            </Button>
          </div>
        </Dialog>

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
            <Button variant="danger" onClick={handleDeletePost}>
              {fr.feed.delete}
            </Button>
          </div>
        </Dialog>
      </ReadingPage>
    </>
  );
}
