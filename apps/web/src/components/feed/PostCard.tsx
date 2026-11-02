import type { MouseEvent } from "react";
import { CheckCircle2, MessageSquare, Share2, Sparkles, Trash2 } from "lucide-react";
import type { PostFormat, PostSummary } from "@kemet/shared";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { IconButton } from "../ui/IconButton.js";
import { Skeleton } from "../ui/Skeleton.js";
import { UserName } from "../ui/UserName.js";
import { ReportMenu } from "../moderation/ReportMenu.js";
import { PostImages } from "./PostImages.js";
import { RichText } from "../content/RichText.js";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";

const FORMAT_LABELS: Record<PostFormat, string> = {
  astuce: fr.feed.formatAstuce,
  a_tester: fr.feed.formatATester,
  question: fr.feed.formatQuestion,
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SharedPostPreview({ post }: { post: PostSummary["sharedPost"] }) {
  if (!post) return null;
  if (post.deletedAt) {
    return (
      <p className="mt-2 rounded-card bg-surface-2 p-3 text-sm text-subtle">
        {fr.feed.postUnavailable}
      </p>
    );
  }
  return (
    <a
      href={`/fil/${post.id}`}
      className="mt-2 block rounded-card bg-surface-2 p-3 hover:bg-accent-soft"
    >
      <div className="flex items-center gap-2">
        <Avatar
          name={post.authorDisplayName}
          src={post.authorAvatarUrl ?? undefined}
          size={32}
          countryCode={post.authorCountry}
        />
        <UserName name={post.authorDisplayName} level={post.authorLevel} />
        <span className="text-xs text-subtle">{formatTime(post.createdAt)}</span>
      </div>
      <p className="mt-1 text-sm text-text-2">{post.body}</p>
      <PostImages attachments={post.attachments} />
    </a>
  );
}

export interface PostCardProps {
  post: PostSummary;
  as?: "li" | "div";
  /** Fourni dans le fil (lien vers la page du post) ; absent sur la page du post (texte statique). */
  bodyHref?: string;
  /** Fourni dans le fil (lien vers la page du post) ; absent sur la page du post, qui donne le focus au composeur de réponse via `onReply`. */
  replyHref?: string;
  canInteract: boolean;
  isOwnPost: boolean;
  canFeedback: boolean;
  canReport: boolean;
  onReact: () => void;
  onShare: () => void;
  onFeedback: () => void;
  onDelete: () => void;
  onReply?: () => void;
}

export function PostCard({
  post,
  as = "div",
  bodyHref,
  replyHref,
  canInteract,
  isOwnPost,
  canFeedback,
  canReport,
  onReact,
  onShare,
  onFeedback,
  onDelete,
  onReply,
}: PostCardProps) {
  // Le corps contient ses propres liens (mentions, adresses) : il ne peut
  // pas être lui-même un lien. La date sert de lien vers le post, au clavier
  // comme à la souris ; un clic ailleurs dans le texte y mène aussi.
  function openPostFromBody(event: MouseEvent<HTMLDivElement>) {
    if (!bodyHref) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    if (window.getSelection()?.toString()) return;
    if (event.ctrlKey || event.metaKey) {
      window.open(bodyHref, "_blank", "noopener");
      return;
    }
    window.location.href = bodyHref;
  }
  const replyLabel = fr.feed.replyAriaLabel(post.replyCount);
  const replyClassName =
    "inline-flex h-control max-md:h-control-mobile items-center gap-1.5 rounded-control px-2 text-xs text-muted hover:bg-surface-2 hover:text-text";

  return (
    <Card as={as}>
      <div className="flex gap-3">
        <a
          href={`/u/${post.authorHandle}`}
          aria-label={fr.profile.viewProfile(post.authorDisplayName)}
        >
          <Avatar
            name={post.authorDisplayName}
            src={post.authorAvatarUrl ?? undefined}
            countryCode={post.authorCountry}
          />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <a href={`/u/${post.authorHandle}`} className="min-w-0 max-w-full hover:underline">
              <UserName name={post.authorDisplayName} level={post.authorLevel} />
            </a>
            {bodyHref ? (
              <a
                href={bodyHref}
                aria-label={fr.feed.openPost(post.authorDisplayName, formatTime(post.createdAt))}
                className="text-xs text-subtle hover:underline"
              >
                {formatTime(post.createdAt)}
              </a>
            ) : (
              <span className="text-xs text-subtle">{formatTime(post.createdAt)}</span>
            )}
            {post.format && <Badge>{FORMAT_LABELS[post.format]}</Badge>}
          </div>
          {post.deletedAt ? (
            <p className="mt-1 text-sm text-text">{fr.feed.postDeleted}</p>
          ) : (
            <div onClick={openPostFromBody} className={cn(bodyHref && "cursor-pointer")}>
              <RichText source={post.body} className="mt-1 text-base text-text" />
            </div>
          )}
          {!post.deletedAt && <PostImages attachments={post.attachments} />}
          {!post.deletedAt && <SharedPostPreview post={post.sharedPost} />}
          {post.format === "a_tester" && post.testUrl && (
            <a
              href={post.testUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-link hover:underline"
            >
              {post.testUrl}
            </a>
          )}
          {post.testAsk && <p className="mt-1 text-sm text-subtle">{post.testAsk}</p>}

          <div className="mt-3 flex items-center gap-2">
            {replyHref ? (
              <a href={replyHref} aria-label={replyLabel} className={replyClassName}>
                <MessageSquare className="size-4" aria-hidden="true" />
                {post.replyCount}
              </a>
            ) : (
              <button
                type="button"
                onClick={onReply}
                aria-label={replyLabel}
                className={replyClassName}
              >
                <MessageSquare className="size-4" aria-hidden="true" />
                {post.replyCount}
              </button>
            )}
            {canInteract && (
              <IconButton aria-label={fr.feed.share} onClick={onShare}>
                <Share2 className="size-4" aria-hidden="true" />
              </IconButton>
            )}
            {canInteract ? (
              <button
                type="button"
                onClick={onReact}
                aria-pressed={post.reactedByMe}
                aria-label={fr.feed.utileAriaLabel(post.utileCount)}
                className={cn(
                  "inline-flex h-control max-md:h-control-mobile items-center gap-1.5 rounded-control px-2 text-xs hover:bg-surface-2",
                  post.reactedByMe ? "text-primary" : "text-muted hover:text-text",
                )}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                {post.utileCount}
              </button>
            ) : (
              <span className="inline-flex h-control max-md:h-control-mobile items-center gap-1.5 rounded-control px-2 text-xs text-muted">
                <Sparkles className="size-4" aria-hidden="true" />
                {post.utileCount}
              </span>
            )}
            {canFeedback && (
              <Button variant="ghost" className="px-2 text-xs" onClick={onFeedback}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {fr.feed.iTested}
              </Button>
            )}
            {isOwnPost ? (
              <Button
                variant="ghost"
                className="ml-auto px-2 text-xs text-danger"
                onClick={onDelete}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {fr.feed.delete}
              </Button>
            ) : (
              canReport && (
                <div className="ml-auto">
                  <ReportMenu
                    contentType="post"
                    contentId={post.id}
                    authorId={post.authorId}
                    authorHandle={post.authorHandle}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Reprend la forme réelle d'un post (avatar rond, lignes de texte) plutôt qu'un simple rectangle. */
export function PostCardSkeleton() {
  return (
    <Card>
      <div className="flex gap-3">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </Card>
  );
}
