import { navigate } from "../../lib/navigation/navigate.js";
import { heightKeyProps } from "../../lib/navigation/rememberedHeights.js";
import { useEffect, useState, type MouseEvent } from "react";
import { Bookmark, CheckCircle2, Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
import { isDeletedAccountHandle, type PostFormat, type PostSummary } from "@kemet/shared";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { MoreActionsMenu } from "../ui/MoreActionsMenu.js";
import { Skeleton } from "../ui/Skeleton.js";
import { UserName } from "../ui/UserName.js";
import { ReportDialog } from "../moderation/ReportMenu.js";
import { PostImages } from "./PostImages.js";
import { RichText } from "../content/RichText.js";
import { AssistantMessage, skillReferenceFrom } from "../assistant/AssistantMessage.js";
import { WORK_TYPE_LABELS } from "../works/workLabels.js";
import { cn } from "../../lib/cn.js";
import { formatCount } from "../../lib/formatCount.js";
import { formatFullDate, formatRelativeTime } from "../../lib/relativeTime.js";
import { shareLink } from "../../lib/shareLink.js";
import { useToast } from "../ui/Toast.js";
import { followUser, setPostRepost, unfollowUser } from "../../lib/chat/api.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";
import { authorLevel, ProfileLink } from "../ui/ProfileLink.js";

const FORMAT_LABELS: Record<PostFormat, string> = {
  astuce: fr.feed.formatAstuce,
  a_tester: fr.feed.formatATester,
  question: fr.feed.formatQuestion,
};

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
        <time
          dateTime={post.createdAt}
          title={formatFullDate(post.createdAt)}
          className="text-xs text-subtle"
        >
          {formatRelativeTime(post.createdAt)}
        </time>
      </div>
      <p className="mt-1 text-sm text-text-2">{post.body}</p>
      <PostImages attachments={post.attachments} linked={false} />
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
// Le navigateur saute style, mise en page et peinture des posts hors de
// l'écran. Leur hauteur réservée vient de `heightKeyProps`.
const OFFSCREEN_SKIP_CLASS = "[content-visibility:auto]";
export const POST_ESTIMATED_HEIGHT_PX = 220;

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
  onSave: () => void;
  onFeedback: () => void;
  onDelete: () => void;
  onReply?: () => void;
  /** Republication ou abonnement réglés depuis la carte, pour que la liste suive. */
  onChange?: (change: Partial<PostSummary>) => void;
  /** Dans le fil : clé de la hauteur gardée d'un aller-retour à l'autre. */
  heightKey?: string;
}

// Barre d'actions : cinq places régulières, icône grise et compteur, couleur
// seulement quand l'action est active.
const ACTION_CLASS =
  "inline-flex h-control max-md:h-control-mobile min-w-11 items-center gap-1 rounded-control px-2 text-xs tabular-nums text-muted transition-colors hover:bg-surface-2 hover:text-text";
const STATIC_ACTION_CLASS =
  "inline-flex h-control max-md:h-control-mobile min-w-11 items-center gap-1 px-2 text-xs tabular-nums text-muted";
const ACTION_ICON_CLASS = "size-5 shrink-0";

function ActionCount({ value }: { value: number }) {
  return <span aria-hidden="true">{value > 0 ? formatCount(value) : ""}</span>;
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
  onSave,
  onFeedback,
  onDelete,
  onReply,
  onChange,
  heightKey,
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
    navigate(bodyHref);
  }
  const toast = useToast();
  const { profile } = useSession();
  const [reportOpen, setReportOpen] = useState(false);
  // Republication et abonnement se règlent ici, sans détour par la liste :
  // l'état local suit la valeur reçue tant que la liste ne la change pas.
  const [repost, setRepost] = useState({ count: post.repostCount, mine: post.repostedByMe });
  const [following, setFollowing] = useState(post.authorFollowedByMe);
  const [repostPending, setRepostPending] = useState(false);
  useEffect(
    () => setRepost({ count: post.repostCount, mine: post.repostedByMe }),
    [post.repostCount, post.repostedByMe],
  );
  useEffect(() => setFollowing(post.authorFollowedByMe), [post.authorFollowedByMe]);

  const postUrl = `${window.location.origin}/fil/${post.id}`;
  const deletedAuthor = isDeletedAccountHandle(post.authorHandle);

  async function share() {
    const outcome = await shareLink(postUrl, fr.feed.shareTitle(post.authorDisplayName));
    if (outcome === "copied") toast.show(fr.feed.linkCopied, "success");
    if (outcome === "failed") toast.show(fr.feed.shareFailed, "danger");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(postUrl);
      toast.show(fr.feed.linkCopied, "success");
    } catch {
      toast.show(fr.feed.shareFailed, "danger");
    }
  }

  async function toggleRepost() {
    if (repostPending) return;
    setRepostPending(true);
    try {
      const result = await setPostRepost(post.id, !repost.mine);
      setRepost({ count: result.repostCount, mine: result.repostedByMe });
      onChange?.(result);
      toast.show(result.repostedByMe ? fr.feed.repostedToast : fr.feed.unrepostedToast, "success");
    } catch {
      toast.show(fr.feed.repostError, "danger");
    } finally {
      setRepostPending(false);
    }
  }

  async function toggleFollow() {
    try {
      const result = following
        ? await unfollowUser(post.authorHandle)
        : await followUser(post.authorHandle);
      setFollowing(result.following);
      onChange?.({ authorFollowedByMe: result.following });
      toast.show(
        result.following
          ? fr.feed.followedToast(post.authorDisplayName)
          : fr.feed.unfollowedToast(post.authorDisplayName),
        "success",
      );
    } catch {
      toast.show(fr.onboarding.followError, "danger");
    }
  }

  const menuItems = [
    ...(canInteract && !isOwnPost && !deletedAuthor
      ? [{ value: "follow", label: following ? fr.feed.menuUnfollow : fr.feed.menuFollow }]
      : []),
    ...(deletedAuthor ? [] : [{ value: "profile", label: fr.feed.menuViewProfile }]),
    ...(post.deletedAt ? [] : [{ value: "copy", label: fr.feed.menuCopyLink }]),
    ...(canReport && !isOwnPost ? [{ value: "report", label: fr.moderation.reportAction }] : []),
    ...(isOwnPost ? [{ value: "delete", label: fr.feed.delete, danger: true }] : []),
  ];

  function handleMenu(value: string) {
    if (value === "follow") void toggleFollow();
    if (value === "profile") navigate(`/u/${post.authorHandle}`);
    if (value === "copy") void copyLink();
    if (value === "report") setReportOpen(true);
    if (value === "delete") onDelete();
  }

  const relativeTime = formatRelativeTime(post.createdAt);
  const canRepost = canInteract && !isOwnPost && !post.deletedAt;
  const reposter = post.repostedBy ?? null;

  const Tag = as;
  return (
    <Tag
      {...heightKeyProps(heightKey, POST_ESTIMATED_HEIGHT_PX)}
      className={cn(
        POST_ROW_CLASS,
        bodyHref && OFFSCREEN_SKIP_CLASS,
        bodyHref && !heightKey && "[contain-intrinsic-size:auto_220px]",
        bodyHref && "transition-colors duration-150 lg:hover:bg-surface-2",
      )}
    >
      {reposter && (
        <p className="mb-1 flex items-center gap-3 text-xs font-medium text-muted">
          <span className="flex w-8 shrink-0 justify-end">
            <Repeat2 className="size-4" aria-hidden="true" />
          </span>
          {reposter.profileId === profile?.id ? (
            fr.feed.repostedByMe
          ) : (
            <a href={`/u/${reposter.handle}`} className="hover:underline">
              {fr.feed.repostedBy(reposter.displayName)}
            </a>
          )}
        </p>
      )}
      <div className="flex gap-3">
        <ProfileLink
          handle={post.authorHandle}
          aria-label={fr.profile.viewProfile(post.authorDisplayName)}
        >
          <Avatar
            deleted={deletedAuthor}
            name={post.authorDisplayName}
            src={post.authorAvatarUrl ?? undefined}
            countryCode={post.authorCountry}
          />
        </ProfileLink>
        <div className="relative min-w-0 flex-1">
          {/* En haut à droite, hors de la rangée d'actions : sur téléphone,
            cette rangée débordait et le menu passait seul à la ligne. */}
          {menuItems.length > 0 && (
            <div className="absolute -top-2 right-0">
              <MoreActionsMenu
                label={fr.feed.moreActions}
                orientation="vertical"
                items={menuItems}
                onSelect={handleMenu}
              />
            </div>
          )}
          <div
            className={cn("flex flex-wrap items-baseline gap-x-2", menuItems.length > 0 && "pr-11")}
          >
            <UserName
              name={post.authorDisplayName}
              handle={post.authorHandle}
              level={authorLevel(post.authorHandle, post.authorLevel)}
            />
            <span aria-hidden="true" className="text-xs text-subtle">
              ·
            </span>
            {bodyHref ? (
              <a
                href={bodyHref}
                aria-label={fr.feed.openPost(
                  post.authorDisplayName,
                  formatFullDate(post.createdAt),
                )}
                title={formatFullDate(post.createdAt)}
                className="text-xs text-subtle hover:underline"
              >
                <time dateTime={post.createdAt}>{relativeTime}</time>
              </a>
            ) : (
              <time
                dateTime={post.createdAt}
                title={formatFullDate(post.createdAt)}
                className="text-xs text-subtle"
              >
                {relativeTime}
              </time>
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
          {!post.deletedAt && (
            <PostImages
              attachments={post.attachments}
              credit={post.mediaCredit}
              postId={post.id}
              authorName={post.authorDisplayName}
            />
          )}
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
          {canFeedback && (
            <Button variant="secondary" className="mt-2 whitespace-nowrap" onClick={onFeedback}>
              <CheckCircle2 className="size-5" aria-hidden="true" />
              {fr.feed.iTested}
            </Button>
          )}

          <div className="-ml-2 mt-2 flex max-w-md items-center justify-between">
            {replyHref ? (
              <a
                href={replyHref}
                aria-label={fr.feed.replyAriaLabel(post.replyCount)}
                className={ACTION_CLASS}
              >
                <MessageCircle className={ACTION_ICON_CLASS} aria-hidden="true" />
                <ActionCount value={post.replyCount} />
              </a>
            ) : (
              <button
                type="button"
                onClick={onReply}
                aria-label={fr.feed.replyAriaLabel(post.replyCount)}
                className={ACTION_CLASS}
              >
                <MessageCircle className={ACTION_ICON_CLASS} aria-hidden="true" />
                <ActionCount value={post.replyCount} />
              </button>
            )}
            {canRepost ? (
              <button
                type="button"
                onClick={() => void toggleRepost()}
                aria-pressed={repost.mine}
                aria-label={fr.feed.repostAriaLabel(repost.count)}
                title={repost.mine ? fr.feed.unrepost : fr.feed.repost}
                className={cn(ACTION_CLASS, repost.mine && "text-success hover:text-success")}
              >
                <Repeat2
                  className={ACTION_ICON_CLASS}
                  strokeWidth={repost.mine ? 2.25 : undefined}
                  aria-hidden="true"
                />
                <ActionCount value={repost.count} />
              </button>
            ) : (
              <span title={fr.feed.repost} className={STATIC_ACTION_CLASS}>
                <Repeat2 className={ACTION_ICON_CLASS} aria-hidden="true" />
                <span className="sr-only">{fr.feed.repostCount(repost.count)}</span>
                <ActionCount value={repost.count} />
              </span>
            )}
            {/* Le cœur garde le sens et les points de "Utile". */}
            {canInteract ? (
              <button
                type="button"
                onClick={onReact}
                aria-pressed={post.reactedByMe}
                aria-label={fr.feed.utileAriaLabel(post.utileCount)}
                title={fr.feed.utile}
                className={cn(ACTION_CLASS, post.reactedByMe && "text-danger hover:text-danger")}
              >
                <Heart
                  className={cn(ACTION_ICON_CLASS, post.reactedByMe && "fill-current")}
                  aria-hidden="true"
                />
                <ActionCount value={post.utileCount} />
              </button>
            ) : (
              <span title={fr.feed.utile} className={STATIC_ACTION_CLASS}>
                <Heart className={ACTION_ICON_CLASS} aria-hidden="true" />
                <span className="sr-only">{fr.feed.utileCount(post.utileCount)}</span>
                <ActionCount value={post.utileCount} />
              </span>
            )}
            {canInteract && !post.deletedAt && (
              <button
                type="button"
                aria-label={fr.feed.save}
                aria-pressed={post.savedByMe}
                onClick={onSave}
                className={cn(ACTION_CLASS, post.savedByMe && "text-primary hover:text-primary")}
              >
                <Bookmark
                  className={cn(ACTION_ICON_CLASS, post.savedByMe && "fill-current")}
                  aria-hidden="true"
                />
              </button>
            )}
            {!post.deletedAt && (
              <button
                type="button"
                aria-label={fr.feed.share}
                onClick={() => void share()}
                className={ACTION_CLASS}
              >
                <Share2 className={ACTION_ICON_CLASS} aria-hidden="true" />
              </button>
            )}
          </div>
          {post.kemetAnswer && !post.deletedAt && (
            <AssistantMessage
              className="mt-2"
              content={<RichText source={post.kemetAnswer.body} />}
              skill={
                post.kemetAnswer.assistant?.skill
                  ? skillReferenceFrom(post.kemetAnswer.assistant.skill)
                  : undefined
              }
              recorded={post.kemetAnswer.assistant?.recorded ?? false}
              hideFeedback
            />
          )}
        </div>
      </div>
      {canReport && !isOwnPost && (
        <ReportDialog
          contentType="post"
          contentId={post.id}
          authorId={post.authorId}
          authorHandle={post.authorHandle}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
        />
      )}
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
