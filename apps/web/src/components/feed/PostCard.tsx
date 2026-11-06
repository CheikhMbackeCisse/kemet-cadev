import type { MouseEvent } from "react";
import { CheckCircle2, MessageSquare, Share2, ThumbsUp } from "lucide-react";
import { isDeletedAccountHandle, type PostFormat, type PostSummary } from "@kemet/shared";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { MoreActionsMenu } from "../ui/MoreActionsMenu.js";
import { Skeleton } from "../ui/Skeleton.js";
import { UserName } from "../ui/UserName.js";
import { ReportMenu } from "../moderation/ReportMenu.js";
import { PostImages } from "./PostImages.js";
import { RichText } from "../content/RichText.js";
import { WORK_TYPE_LABELS } from "../works/workLabels.js";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";
import { authorLevel, ProfileLink } from "../ui/ProfileLink.js";

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

function WorkPreview({ work }: { work: PostSummary["work"] }) {
  if (!work) return null;
  return (
    <a
      href={`/travaux/${work.slug}`}
      className="mt-2 block rounded-card bg-surface-2 p-3 hover:bg-accent-soft"
    >
      <p className="text-xs text-muted">{WORK_TYPE_LABELS[work.type]}</p>
      <p className="mt-0.5 text-sm font-medium text-text">{work.title}</p>
      <p className="mt-1 line-clamp-3 text-sm text-text-2">{work.excerpt}</p>
    </a>
  );
}

// Un post est une ligne de la colonne de lecture, pas une carte : les posts
// se suivent séparés par un filet (posé par la liste), le fond ne change
// qu'au survol, sur bureau, quand la ligne mène au post.
const POST_ROW_CLASS = "-mx-4 px-4 py-4 lg:-mx-3 lg:px-3";

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

  const Tag = as;
  return (
    <Tag className={cn(POST_ROW_CLASS, bodyHref && "transition-colors duration-150 lg:hover:bg-surface-2")}>
      <div className="flex gap-3">
        <ProfileLink
          handle={post.authorHandle}
          aria-label={fr.profile.viewProfile(post.authorDisplayName)}
        >
          <Avatar
            deleted={isDeletedAccountHandle(post.authorHandle)}
            name={post.authorDisplayName}
            src={post.authorAvatarUrl ?? undefined}
            countryCode={post.authorCountry}
          />
        </ProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <ProfileLink handle={post.authorHandle} className="min-w-0 max-w-full">
              <UserName
                name={post.authorDisplayName}
                level={authorLevel(post.authorHandle, post.authorLevel)}
              />
            </ProfileLink>
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
            {post.work && !post.deletedAt && (
              <span className="text-xs text-subtle">{fr.works.feedAnnouncement}</span>
            )}
          </div>
          {post.deletedAt ? (
            <p className="mt-1 text-sm text-text">{fr.feed.postDeleted}</p>
          ) : (
            post.body && (
              <div onClick={openPostFromBody} className={cn(bodyHref && "cursor-pointer")}>
                <RichText source={post.body} className="mt-1 text-base text-text" />
              </div>
            )
          )}
          {!post.deletedAt && <PostImages attachments={post.attachments} />}
          {!post.deletedAt && <SharedPostPreview post={post.sharedPost} />}
          {!post.deletedAt && <WorkPreview work={post.work} />}
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
                <ThumbsUp className="size-4" aria-hidden="true" />
                <span className="max-md:hidden">{fr.feed.utile}</span>
                {post.utileCount}
              </button>
            ) : (
              <span className="inline-flex h-control max-md:h-control-mobile items-center gap-1.5 rounded-control px-2 text-xs text-muted">
                <ThumbsUp className="size-4" aria-hidden="true" />
                <span className="max-md:hidden">{fr.feed.utile}</span>
                {post.utileCount}
              </span>
            )}
            {canFeedback && (
              <Button variant="ghost" className="whitespace-nowrap px-2 text-xs" onClick={onFeedback}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {fr.feed.iTested}
              </Button>
            )}
            {isOwnPost ? (
              <div className="ml-auto">
                <MoreActionsMenu
                  label={fr.feed.moreActions}
                  items={[{ value: "delete", label: fr.feed.delete, danger: true }]}
                  onSelect={onDelete}
                />
              </div>
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
    </Tag>
  );
}

/** Reprend la forme réelle d'un post (avatar rond, lignes de texte) plutôt qu'un simple rectangle. */
export function PostCardSkeleton() {
  return (
    <div className={POST_ROW_CLASS}>
      <div className="flex gap-3">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
