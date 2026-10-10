import { ArrowLeft, CheckCircle2, Share2, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PostFeedbackEntry, PostFormat, PostReply, PostSummary } from "@kemet/shared";
import {
  ChatApiError,
  createPostFeedback,
  createPostReply,
  deletePost,
  deletePostReply,
  getMe,
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
import { Dialog } from "../components/ui/Dialog.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Input } from "../components/ui/Input.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Textarea } from "../components/ui/Textarea.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";
import { ThemeToggle } from "../theme/ThemeToggle.js";
import { fr } from "../i18n/fr.js";

const FORMAT_LABELS: Record<PostFormat, string> = {
  astuce: fr.feed.formatAstuce,
  a_tester: fr.feed.formatATester,
  question: fr.feed.formatQuestion,
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function readPostId(pathname: string): string {
  return pathname.replace(/^\/fil\//, "");
}

export function PostPage() {
  const toast = useToast();
  const postId = readPostId(window.location.pathname);

  const [post, setPost] = useState<PostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

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

  useEffect(() => {
    loadPost();
    getMe().then((me) => setMyProfileId(me.profile?.id ?? null)).catch(() => {});
  }, [loadPost]);

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
      setPost((current) => (current ? { ...current, replyCount: current.replyCount + 1 } : current));
    } catch {
      toast.show(fr.feed.replySendError, "danger");
    }
  }

  async function handleDeleteReply(replyId: string) {
    setReplyToDelete(null);
    try {
      await deletePostReply(replyId);
      setReplies((current) => current.filter((reply) => reply.id !== replyId));
      setPost((current) => (current ? { ...current, replyCount: Math.max(0, current.replyCount - 1) } : current));
    } catch {
      toast.show(fr.feed.replyDeleteError, "danger");
    }
  }

  async function handleToggleSolution(reply: PostReply) {
    try {
      const { reply: updated } = await markPostReplySolution(reply.id, !reply.isSolution);
      setReplies((current) => current.map((item) => (item.id === updated.id ? updated : { ...item, isSolution: false })));
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
        err instanceof ChatApiError && err.statusCode === 409 ? fr.feed.feedbackAlready : fr.feed.feedbackError,
      );
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-4 px-4 py-8">
        <ErrorState message={fr.feed.postNotFound} retry={{ label: fr.feed.back, onClick: () => (window.location.href = "/fil") }} />
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-4 px-4 py-8">
        <ErrorState message={fr.feed.loadingError} retry={{ label: fr.chat.retry, onClick: loadPost }} />
      </main>
    );
  }

  const isAuthor = myProfileId !== null && myProfileId === post.authorId;
  const hasGivenFeedback = myProfileId !== null && feedback.some((entry) => entry.authorId === myProfileId);

  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <a href="/fil" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fr.feed.back}
        </a>
        <ThemeToggle />
      </div>

      <div className="flex gap-3">
        <Avatar name={post.authorDisplayName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <UserName name={post.authorDisplayName} />
            <span className="text-xs text-subtle">{formatTime(post.createdAt)}</span>
            {post.format && <Badge>{FORMAT_LABELS[post.format]}</Badge>}
          </div>
          <p className="mt-2 text-sm text-text">{post.deletedAt ? fr.feed.postDeleted : post.body}</p>
          {post.format === "a_tester" && post.testUrl && (
            <a href={post.testUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-link hover:underline">
              {post.testUrl}
            </a>
          )}
          {post.testAsk && <p className="mt-1 text-sm text-subtle">{post.testAsk}</p>}

          <div className="mt-3 flex items-center gap-2">
            <IconButton aria-label={fr.feed.share} onClick={handleShare}>
              <Share2 className="size-4" aria-hidden="true" />
            </IconButton>
            <button
              type="button"
              onClick={handleReact}
              aria-pressed={post.reactedByMe}
              aria-label={fr.feed.utileAriaLabel(post.utileCount)}
              className={`inline-flex h-control max-md:h-control-mobile items-center gap-1.5 rounded-control px-2 text-xs hover:bg-surface-2 ${post.reactedByMe ? "text-primary" : "text-muted hover:text-text"}`}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {post.utileCount}
            </button>
            {post.format === "a_tester" && !hasGivenFeedback && (
              <Button variant="ghost" className="px-2 text-xs" onClick={() => setFeedbackOpen(true)}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {fr.feed.iTested}
              </Button>
            )}
            {isAuthor && !post.deletedAt && (
              <Button variant="ghost" className="ml-auto px-2 text-xs text-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" aria-hidden="true" />
                {fr.feed.delete}
              </Button>
            )}
          </div>
        </div>
      </div>

      {post.format === "a_tester" && feedback.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-border p-3">
          <p className="text-sm font-medium text-text">{fr.feed.feedbackTitle}</p>
          {feedback.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-0.5">
              <UserName name={entry.authorDisplayName} />
              <p className="text-sm text-text-2">{entry.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text">{fr.feed.replyCount(post.replyCount)}</p>
        {replies.length === 0 ? (
          <p className="text-sm text-subtle">{fr.feed.noReplies}</p>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <Avatar name={reply.authorDisplayName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <UserName name={reply.authorDisplayName} />
                  <span className="text-xs text-subtle">{formatTime(reply.createdAt)}</span>
                  {reply.isSolution && <Badge tone="success">{fr.feed.solutionBadge}</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-text">{reply.deletedAt ? fr.chat.messageDeleted : reply.body}</p>
                <div className="mt-1 flex items-center gap-2">
                  {isAuthor && post.format === "question" && !reply.deletedAt && (
                    <button
                      type="button"
                      onClick={() => handleToggleSolution(reply)}
                      className="text-xs text-link hover:underline"
                    >
                      {reply.isSolution ? fr.feed.unmarkSolution : fr.feed.markSolution}
                    </button>
                  )}
                  {myProfileId === reply.authorId && !reply.deletedAt && (
                    <IconButton aria-label={fr.feed.delete} onClick={() => setReplyToDelete(reply.id)}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </IconButton>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div className="flex gap-2">
          <Input
            placeholder={fr.feed.replyPlaceholder}
            aria-label={fr.feed.replyPlaceholder}
            value={replyDraft}
            onChange={(event) => setReplyDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleReply();
            }}
          />
          <Button onClick={handleReply} disabled={!replyDraft.trim()}>
            {fr.feed.reply}
          </Button>
        </div>
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} title={fr.feed.delete} description={fr.feed.deleteConfirm}>
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
          <Button variant="danger" onClick={() => replyToDelete && handleDeleteReply(replyToDelete)}>
            {fr.feed.delete}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
