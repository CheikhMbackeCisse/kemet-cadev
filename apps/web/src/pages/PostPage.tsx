import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PostFeedbackEntry, PostReply, PostSummary } from "@kemet/shared";
import {
  ChatApiError,
  createPostFeedback,
  createPostReply,
  deletePost,
  deletePostReply,
  getPost,
  listPostFeedback,
  listPostReplies,
  markPostReplySolution,
  sharePost,
  togglePostReaction,
} from "../lib/chat/api.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Textarea } from "../components/ui/Textarea.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";
import { PostCard, PostCardSkeleton } from "../components/feed/PostCard.js";
import { RichText } from "../components/content/RichText.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { AccountMenu } from "../components/shell/AccountMenu.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";
import { SuspendedBanner } from "../components/shell/SuspendedBanner.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readPostId(pathname: string): string {
  return pathname.replace(/^\/fil\//, "");
}

export function PostPage() {
  const toast = useToast();
  const postId = readPostId(window.location.pathname);
  const { status, profile, isSuspended } = useSession();
  const canInteract = status === "ready" && !isSuspended;
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [post, setPost] = useState<PostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [replies, setReplies] = useState<PostReply[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyToDelete, setReplyToDelete] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<PostFeedbackEntry[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadPost = useCallback(() => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    getPost(postId)
      .then((result) => setPost(result.post))
      .catch((err) => {
        if (err instanceof ChatApiError && err.statusCode === 404) setNotFound(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => loadPost(), [loadPost]);

  useEffect(() => {
    listPostReplies(postId)
      .then((page) => setReplies(page.items))
      .catch(() => {});
  }, [postId]);

  useEffect(() => {
    if (post?.format !== "a_tester") return;
    listPostFeedback(postId)
      .then((result) => setFeedback(result.items))
      .catch(() => {});
  }, [postId, post?.format]);

  async function handleReact() {
    if (!post) return;
    try {
      const result = await togglePostReaction(post.id);
      setPost({ ...post, utileCount: result.utileCount, reactedByMe: result.reactedByMe });
    } catch {
      toast.show(fr.feed.reactError, "danger");
    }
  }

  async function handleShare() {
    if (!post) return;
    try {
      await sharePost(post.id);
      toast.show(fr.feed.shared, "success");
    } catch {
      toast.show(fr.feed.shareError, "danger");
    }
  }

  async function handleDeletePost() {
    if (!post) return;
    setDeleteOpen(false);
    try {
      await deletePost(post.id);
      window.location.href = "/fil";
    } catch {
      toast.show(fr.feed.postDeleteError, "danger");
    }
  }

  async function handleReply() {
    const body = replyDraft.trim();
    if (!body) return;
    try {
      const { reply } = await createPostReply(postId, { body });
      setReplies((current) => [...current, reply]);
      setReplyDraft("");
      setPost((current) =>
        current ? { ...current, replyCount: current.replyCount + 1 } : current,
      );
    } catch {
      toast.show(fr.feed.replySendError, "danger");
    }
  }

  async function handleDeleteReply(replyId: string) {
    setReplyToDelete(null);
    try {
      await deletePostReply(replyId);
      setReplies((current) => current.filter((reply) => reply.id !== replyId));
      setPost((current) =>
        current ? { ...current, replyCount: Math.max(0, current.replyCount - 1) } : current,
      );
    } catch {
      toast.show(fr.feed.replyDeleteError, "danger");
    }
  }

  async function handleToggleSolution(reply: PostReply) {
    try {
      const { reply: updated } = await markPostReplySolution(reply.id, !reply.isSolution);
      setReplies((current) =>
        current.map((item) => (item.id === updated.id ? updated : { ...item, isSolution: false })),
      );
    } catch {
      toast.show(fr.feed.solutionError, "danger");
    }
  }

  async function handleSubmitFeedback() {
    setFeedbackError(null);
    try {
      const { feedback: created } = await createPostFeedback(postId, feedbackBody.trim());
      setFeedback((current) => [created, ...current]);
      setFeedbackOpen(false);
      setFeedbackBody("");
      toast.show(fr.feed.feedbackSent, "success");
    } catch (err) {
      setFeedbackError(
        err instanceof ChatApiError && err.statusCode === 409
          ? fr.feed.feedbackAlready
          : fr.feed.feedbackError,
      );
    }
  }

  const header = (
    <div className="flex items-center justify-between">
      <a href="/fil" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {fr.feed.back}
      </a>
      <div className="flex items-center gap-2">
        <AccountMenu />
      </div>
    </div>
  );

  if (loading || notFound || error || !post) {
    return (
      <ReadingPage
        activeSection="fil"
        header={header}
        state={
          loading
            ? { kind: "loading" }
            : notFound
              ? {
                  kind: "notFound",
                  message: fr.feed.postNotFound,
                  retry: { label: fr.feed.back, onClick: () => (window.location.href = "/fil") },
                }
              : {
                  kind: "error",
                  message: fr.feed.loadingError,
                  retry: { label: fr.chat.retry, onClick: loadPost },
                }
        }
        loadingSkeleton={<PostCardSkeleton />}
      />
    );
  }

  const isOwnPost = profile !== null && profile.id === post.authorId && !post.deletedAt;
  const hasGivenFeedback =
    profile !== null && feedback.some((entry) => entry.authorId === profile.id);

  return (
    <>
      <ReadingPage
        activeSection="fil"
        header={header}
        className="pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-8"
      >
        {status === "visitor" && <VisitorBanner />}
        {isSuspended && <SuspendedBanner />}

        <PostCard
          post={post}
          canInteract={canInteract}
          isOwnPost={isOwnPost}
          canFeedback={canInteract && post.format === "a_tester" && !hasGivenFeedback}
          canReport={canInteract && !post.deletedAt}
          onReact={handleReact}
          onShare={handleShare}
          onFeedback={() => setFeedbackOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onReply={() => replyTextareaRef.current?.focus()}
        />

        {post.format === "a_tester" && feedback.length > 0 && (
          <Card padding="compact" className="flex flex-col gap-2">
            <p className="text-md font-semibold text-text">{fr.feed.feedbackTitle}</p>
            {feedback.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-0.5">
                <a
                  href={`/u/${entry.authorHandle}`}
                  className="flex w-fit items-center gap-2 hover:underline"
                >
                  <Avatar
                    name={entry.authorDisplayName}
                    src={entry.authorAvatarUrl ?? undefined}
                    size={32}
                    countryCode={entry.authorCountry}
                  />
                  <UserName name={entry.authorDisplayName} />
                </a>
                <RichText source={entry.body} className="text-sm text-text-2" />
              </div>
            ))}
          </Card>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-md font-semibold text-text">{fr.feed.replyCount(post.replyCount)}</p>
          {replies.length === 0 ? (
            <EmptyState message={fr.feed.noReplies} />
          ) : (
            replies.map((reply) => (
              <div key={reply.id} className="flex gap-3">
                <a
                  href={`/u/${reply.authorHandle}`}
                  aria-label={fr.profile.viewProfile(reply.authorDisplayName)}
                >
                  <Avatar
                    name={reply.authorDisplayName}
                    src={reply.authorAvatarUrl ?? undefined}
                    countryCode={reply.authorCountry}
                  />
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <a href={`/u/${reply.authorHandle}`} className="hover:underline">
                      <UserName name={reply.authorDisplayName} />
                    </a>
                    <span className="text-xs text-subtle">{formatTime(reply.createdAt)}</span>
                    {reply.isSolution && <Badge tone="success">{fr.feed.solutionBadge}</Badge>}
                  </div>
                  {reply.deletedAt ? (
                    <p className="mt-0.5 text-sm text-text">{fr.chat.messageDeleted}</p>
                  ) : (
                    <RichText source={reply.body} className="mt-0.5 text-sm text-text" />
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    {isOwnPost && post.format === "question" && !reply.deletedAt && (
                      <button
                        type="button"
                        onClick={() => handleToggleSolution(reply)}
                        className="text-xs text-link hover:underline"
                      >
                        {reply.isSolution ? fr.feed.unmarkSolution : fr.feed.markSolution}
                      </button>
                    )}
                    {profile?.id === reply.authorId && !reply.deletedAt && (
                      <IconButton
                        aria-label={fr.feed.delete}
                        onClick={() => setReplyToDelete(reply.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {canInteract && (
            <div className="flex gap-2">
              <Textarea
                ref={replyTextareaRef}
                placeholder={fr.feed.replyPlaceholder}
                aria-label={fr.feed.replyPlaceholder}
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleReply();
                  }
                }}
                className="min-h-9 max-md:min-h-11 flex-1 py-2"
              />
              <Button onClick={handleReply} disabled={!replyDraft.trim()}>
                {fr.feed.reply}
              </Button>
            </div>
          )}
        </div>

        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen} title={fr.feed.feedbackTitle}>
          <div className="flex flex-col gap-3">
            <Textarea
              placeholder={fr.feed.feedbackPlaceholder}
              aria-label={fr.feed.feedbackPlaceholder}
              value={feedbackBody}
              onChange={(event) => setFeedbackBody(event.target.value)}
              className="min-h-24"
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
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={fr.feed.delete}
          description={fr.feed.deleteConfirm}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {fr.feed.cancel}
            </Button>
            <Button variant="danger" onClick={handleDeletePost}>
              {fr.feed.delete}
            </Button>
          </div>
        </Dialog>

        <Dialog
          open={replyToDelete !== null}
          onOpenChange={(open) => !open && setReplyToDelete(null)}
          title={fr.feed.delete}
          description={fr.feed.replyDeleteConfirm}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReplyToDelete(null)}>
              {fr.feed.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => replyToDelete && handleDeleteReply(replyToDelete)}
            >
              {fr.feed.delete}
            </Button>
          </div>
        </Dialog>
      </ReadingPage>
    </>
  );
}
