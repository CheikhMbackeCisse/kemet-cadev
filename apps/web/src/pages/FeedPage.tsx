import { CheckCircle2, Hash, MessageSquare, Rss, Share2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FeedTab, PostFormat, PostSummary } from "@kemet/shared";
import {
  ChatApiError,
  createPost,
  createPostFeedback,
  listPosts,
  sharePost,
  togglePostReaction,
} from "../lib/chat/api.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Select } from "../components/ui/Select.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Tabs } from "../components/ui/Tabs.js";
import { Textarea } from "../components/ui/Textarea.js";
import { Input } from "../components/ui/Input.js";
import { Avatar } from "../components/ui/Avatar.js";
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

function SharedPostPreview({ post }: { post: PostSummary["sharedPost"] }) {
  if (!post) return null;
  if (post.deletedAt) {
    return <p className="mt-2 rounded-card border border-border p-3 text-sm text-subtle">{fr.feed.postUnavailable}</p>;
  }
  return (
    <a
      href={`/fil/${post.id}`}
      className="mt-2 block rounded-card border border-border p-3 hover:bg-surface-2"
    >
      <div className="flex items-baseline gap-2">
        <UserName name={post.authorDisplayName} />
        <span className="text-xs text-subtle">{formatTime(post.createdAt)}</span>
      </div>
      <p className="mt-1 text-sm text-text-2">{post.body}</p>
    </a>
  );
}

interface PostCardProps {
  post: PostSummary;
  onReact: (postId: string) => void;
  onShare: (postId: string) => void;
  onFeedback: (postId: string) => void;
}

function PostCard({ post, onReact, onShare, onFeedback }: PostCardProps) {
  return (
    <li className="rounded-card border border-border p-4">
      <div className="flex gap-3">
        <Avatar name={post.authorDisplayName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <UserName name={post.authorDisplayName} />
            <span className="text-xs text-subtle">{formatTime(post.createdAt)}</span>
            {post.format && <Badge>{FORMAT_LABELS[post.format]}</Badge>}
          </div>
          <a href={`/fil/${post.id}`} className="mt-1 block text-sm text-text hover:underline">
            {post.deletedAt ? fr.feed.postDeleted : post.body}
          </a>
          <SharedPostPreview post={post.sharedPost} />
          <div className="mt-3 flex items-center gap-2">
            <a
              href={`/fil/${post.id}`}
              aria-label={fr.feed.replyAriaLabel(post.replyCount)}
              className="inline-flex h-control max-md:h-control-mobile items-center gap-1.5 rounded-control px-2 text-xs text-muted hover:bg-surface-2 hover:text-text"
            >
              <MessageSquare className="size-4" aria-hidden="true" />
              {post.replyCount}
            </a>
            <IconButton aria-label={fr.feed.share} onClick={() => onShare(post.id)}>
              <Share2 className="size-4" aria-hidden="true" />
            </IconButton>
            <button
              type="button"
              onClick={() => onReact(post.id)}
              aria-pressed={post.reactedByMe}
              aria-label={fr.feed.utileAriaLabel(post.utileCount)}
              className={`inline-flex h-control max-md:h-control-mobile items-center gap-1.5 rounded-control px-2 text-xs hover:bg-surface-2 ${post.reactedByMe ? "text-primary" : "text-muted hover:text-text"}`}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {post.utileCount}
            </button>
            {post.format === "a_tester" && (
              <Button variant="ghost" className="px-2 text-xs" onClick={() => onFeedback(post.id)}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {fr.feed.iTested}
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function FeedPage() {
  const toast = useToast();
  const [tab, setTab] = useState<FeedTab>("abonnements");
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [body, setBody] = useState("");
  const [format, setFormat] = useState<"none" | PostFormat>("none");
  const [testUrl, setTestUrl] = useState("");
  const [testAsk, setTestAsk] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);

  const [feedbackPostId, setFeedbackPostId] = useState<string | null>(null);
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

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

  async function handlePublish() {
    setPublishError(null);
    try {
      await createPost({
        body: body.trim(),
        format: format === "none" ? null : format,
        testUrl: format === "a_tester" ? testUrl.trim() : null,
        testAsk: format === "a_tester" ? testAsk.trim() : null,
      });
      setBody("");
      setFormat("none");
      setTestUrl("");
      setTestAsk("");
      load(tab);
    } catch (err) {
      setPublishError(err instanceof ChatApiError ? err.message : fr.feed.createError);
    }
  }

  async function handleReact(postId: string) {
    try {
      const result = await togglePostReaction(postId);
      setPosts((current) =>
        current.map((post) => (post.id === postId ? { ...post, utileCount: result.utileCount, reactedByMe: result.reactedByMe } : post)),
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
        err instanceof ChatApiError && err.statusCode === 409 ? fr.feed.feedbackAlready : fr.feed.feedbackError,
      );
    }
  }

  const feedContent = loading ? (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  ) : error ? (
    <ErrorState message={fr.feed.loadingError} retry={{ label: fr.chat.retry, onClick: () => load(tab) }} />
  ) : posts.length === 0 ? (
    <EmptyState icon={Rss} message={fr.feed.noPosts} />
  ) : (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onReact={handleReact} onShare={handleShare} onFeedback={setFeedbackPostId} />
        ))}
      </ul>
      {nextCursor && (
        <Button variant="secondary" onClick={loadMore} className="self-center">
          {fr.feed.loadMore}
        </Button>
      )}
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">{fr.feed.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="/salons"
            className="inline-flex h-control items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
          >
            <Hash className="size-4" aria-hidden="true" />
            {fr.feed.salonsLink}
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border p-4">
        <Textarea
          placeholder={fr.feed.composerPlaceholder}
          aria-label={fr.feed.composerPlaceholder}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-20"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={fr.feed.formatLabel}
            value={format}
            onValueChange={(value) => setFormat(value as "none" | PostFormat)}
            options={[
              { value: "none", label: fr.feed.formatNone },
              { value: "astuce", label: fr.feed.formatAstuce },
              { value: "a_tester", label: fr.feed.formatATester },
              { value: "question", label: fr.feed.formatQuestion },
            ]}
            className="w-auto"
          />
          {format === "a_tester" && (
            <>
              <Input
                placeholder={fr.feed.testUrlLabel}
                aria-label={fr.feed.testUrlLabel}
                value={testUrl}
                onChange={(event) => setTestUrl(event.target.value)}
                className="flex-1"
              />
              <Input
                placeholder={fr.feed.testAskLabel}
                aria-label={fr.feed.testAskLabel}
                value={testAsk}
                onChange={(event) => setTestAsk(event.target.value)}
                className="flex-1"
              />
            </>
          )}
          <Button
            className="ml-auto"
            onClick={handlePublish}
            disabled={!body.trim() || (format === "a_tester" && !testUrl.trim())}
          >
            {fr.feed.publish}
          </Button>
        </div>
        {publishError && (
          <p className="text-sm text-danger" role="alert">
            {publishError}
          </p>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as FeedTab)}
        items={[
          { value: "abonnements", label: fr.feed.tabAbonnements, content: tab === "abonnements" ? feedContent : null },
          { value: "pour-toi", label: fr.feed.tabPourToi, content: tab === "pour-toi" ? feedContent : null },
        ]}
      />

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
    </main>
  );
}
