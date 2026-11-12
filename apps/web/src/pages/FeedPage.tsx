import { Plus, Rss } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  prefersTalentFeed,
  type FeedProject,
  type OpportunitySummary,
  type PostSummary,
} from "@kemet/shared";
import {
  ChatApiError,
  createPostFeedback,
  deletePost,
  listOpportunities,
  listPosts,
  setPostBookmark,
  togglePostReaction,
} from "../lib/chat/api.js";
import {
  POST_ESTIMATED_HEIGHT_PX,
  PostCard,
  PostCardSkeleton,
} from "../components/feed/PostCard.js";
import {
  PROJECT_CARD_ESTIMATED_HEIGHT_PX,
  ProjectFeedCard,
} from "../components/feed/ProjectFeedCard.js";
import { rememberedHeight } from "../lib/navigation/rememberedHeights.js";
import { interleaveProjects } from "../lib/feed/interleave.js";
import { useVisibleFirst } from "../lib/feed/useVisibleFirst.js";
import {
  feedQueryKey,
  fetchFeed,
  forgetPost,
  mergeFreshFirstPage,
  type FeedData,
  type PostFeedView,
} from "../lib/feed/feedQuery.js";
import { OpportunitiesFeed } from "../components/opportunities/OpportunitiesFeed.js";
import { withoutOpportunityParams } from "../lib/opportunities/listState.js";
import {
  OPPORTUNITY_ROW_ESTIMATED_HEIGHT_PX,
  OpportunityRow,
} from "../components/opportunities/OpportunityRow.js";
import { HeaderActionLink } from "../components/ui/HeaderActionLink.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Tabs } from "../components/ui/Tabs.js";
import { OpenProfilesStrip } from "../components/talent/OpenProfilesStrip.js";
import { useToast } from "../components/ui/Toast.js";
import { InstallBanner } from "../components/shell/InstallBanner.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";
import { SuspendedBanner } from "../components/shell/SuspendedBanner.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { DemoNoticeLine } from "../components/shell/DemoNotice.js";
import { ProjectsFeed } from "../components/feed/ProjectsFeed.js";
import { KemetWordmark } from "../components/ui/KemetWordmark.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";

const postHeightKey = (postId: string) => `post:${postId}`;
const projectHeightKey = (projectId: string) => `project:${projectId}`;
const offerHeightKey = (offerId: string) => `offer:${offerId}`;

// Cartes glissées entre les posts : des projets, et des offres pour les RH et
// les entrepreneurs.
type SideCard =
  { type: "project"; project: FeedProject } | { type: "offer"; offer: OpportunitySummary };

/** Une offre, puis un projet, puis une offre... tant qu'il en reste. */
function alternateSideCards(offers: OpportunitySummary[], projects: FeedProject[]): SideCard[] {
  const cards: SideCard[] = [];
  for (let index = 0; index < Math.max(offers.length, projects.length); index += 1) {
    const offer = offers[index];
    const project = projects[index];
    if (offer) cards.push({ type: "offer", offer });
    if (project) cards.push({ type: "project", project });
  }
  return cards;
}

// "Abonnements" n'est plus un onglet : les posts des personnes suivies
// restent favorisés dans "Pour toi". La source reste dans l'API.
type FeedTabValue = "pour-toi" | "projets" | "opportunites";

function initialFeedView(): FeedTabValue {
  const tab = new URLSearchParams(window.location.search).get("onglet");
  return tab === "opportunites" || tab === "projets" ? tab : "pour-toi";
}

// L'onglet s'écrit dans l'adresse : le retour depuis une offre ou un projet y revient.
function writeFeedViewToUrl(view: FeedTabValue) {
  const params = new URLSearchParams(
    view === "opportunites"
      ? window.location.search
      : withoutOpportunityParams(window.location.search),
  );
  if (view === "pour-toi") params.delete("onglet");
  else params.set("onglet", view);
  const search = params.toString();
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + (search ? `?${search}` : ""),
  );
}

function RowPlaceholder({
  heightKey,
  estimatedHeight,
}: {
  heightKey: string;
  estimatedHeight: number;
}) {
  return (
    <li
      aria-hidden="true"
      data-height-key={heightKey}
      style={{ height: rememberedHeight(heightKey) ?? estimatedHeight }}
    />
  );
}

function PostListItem({
  post,
  canInteract,
  viewerProfileId,
  onReact,
  onSave,
  onFeedback,
  onDeleteRequest,
  onChange,
}: {
  post: PostSummary;
  canInteract: boolean;
  viewerProfileId: string | null;
  onReact: (postId: string) => void;
  onSave: (postId: string) => void;
  onFeedback: (postId: string) => void;
  onDeleteRequest: (postId: string) => void;
  onChange: (post: PostSummary, change: Partial<PostSummary>) => void;
}) {
  const isOwnPost =
    viewerProfileId !== null && viewerProfileId === post.authorId && !post.deletedAt;
  return (
    <PostCard
      post={post}
      as="li"
      heightKey={postHeightKey(post.id)}
      bodyHref={`/fil/${post.id}`}
      replyHref={`/fil/${post.id}`}
      canInteract={canInteract}
      isOwnPost={isOwnPost}
      canFeedback={canInteract && post.format === "a_tester"}
      canReport={canInteract && !post.deletedAt}
      onReact={() => onReact(post.id)}
      onSave={() => onSave(post.id)}
      onFeedback={() => onFeedback(post.id)}
      onDelete={() => onDeleteRequest(post.id)}
      onChange={(change) => onChange(post, change)}
    />
  );
}

// RH et entrepreneurs : une carte offre ou projet après chaque groupe de trois posts.
const TALENT_POSTS_PER_PROJECT_CARD = 3;
const TALENT_OFFERS = 4;

export function FeedPage() {
  const toast = useToast();
  const { status, profile, isSuspended } = useSession();
  const canInteract = status === "ready" && !isSuspended;
  const talentFeed = profile !== null && prefersTalentFeed(profile.role);
  // "Pour toi" par defaut pour tout le monde : un nouveau compte ne suit
  // encore personne, et ouvrait donc le fil sur une page vide.
  const [tab, setTab] = useState<FeedTabValue>(initialFeedView);
  const postView: PostFeedView = "pour-toi";
  const queryClient = useQueryClient();
  const queryKey = feedQueryKey(postView);
  const feed = useQuery({
    queryKey,
    queryFn: async () =>
      mergeFreshFirstPage(await fetchFeed(postView), queryClient.getQueryData<FeedData>(queryKey)),
    enabled: tab === "pour-toi",
  });
  const talentPourToi = talentFeed && tab === "pour-toi";
  const talentOffers = useQuery({
    queryKey: ["opportunities", "talent-feed"],
    queryFn: () => listOpportunities({}, null, TALENT_OFFERS),
    enabled: talentPourToi,
  });
  const posts = feed.data?.posts ?? [];
  const projects = feed.data?.projects ?? [];
  const nextCursor = feed.data?.nextCursor ?? null;
  const loading = feed.isPending;
  const error = feed.isError && !feed.data;

  const sideCards: SideCard[] = talentPourToi
    ? alternateSideCards(talentOffers.data?.items ?? [], projects)
    : projects.map((project) => ({ type: "project", project }));
  const entries = interleaveProjects(
    posts,
    sideCards,
    talentPourToi ? TALENT_POSTS_PER_PROJECT_CARD : undefined,
  );
  const entryKeys = entries.map((entry) =>
    entry.kind === "post"
      ? postHeightKey(entry.item.id)
      : entry.item.type === "offer"
        ? offerHeightKey(entry.item.offer.id)
        : projectHeightKey(entry.item.project.id),
  );
  const isBuilt = useVisibleFirst(entryKeys, POST_ESTIMATED_HEIGHT_PX);

  const [feedbackPostId, setFeedbackPostId] = useState<string | null>(null);
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  function updateFeed(update: (data: FeedData) => FeedData) {
    queryClient.setQueryData<FeedData>(queryKey, (data) => (data ? update(data) : data));
  }

  function setPosts(update: (current: PostSummary[]) => PostSummary[]) {
    updateFeed((data) => ({ ...data, posts: update(data.posts) }));
  }

  function reload() {
    void feed.refetch();
  }

  async function loadMore() {
    if (!nextCursor || tab !== "pour-toi") return;
    try {
      const page = await listPosts(postView, nextCursor);
      updateFeed((data) => ({
        ...data,
        posts: [...data.posts, ...page.items],
        nextCursor: page.nextCursor,
      }));
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

  // Suivre l'auteur depuis un post vaut pour tous ses posts de la liste.
  function handlePostChange(target: PostSummary, change: Partial<PostSummary>) {
    setPosts((current) =>
      current.map((post) => {
        if (post.id === target.id) return { ...post, ...change };
        if (change.authorFollowedByMe !== undefined && post.authorId === target.authorId)
          return { ...post, authorFollowedByMe: change.authorFollowedByMe };
        return post;
      }),
    );
  }

  async function handleSave(postId: string) {
    const target = posts.find((post) => post.id === postId);
    if (!target) return;
    try {
      const result = await setPostBookmark(postId, !target.savedByMe);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, savedByMe: result.savedByMe } : post,
        ),
      );
      toast.show(result.savedByMe ? fr.feed.savedToast : fr.feed.unsavedToast, "success");
    } catch {
      toast.show(fr.feed.saveError, "danger");
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
      reload();
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
      forgetPost(queryClient, postId);
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
      retry={{ label: fr.chat.retry, onClick: () => reload() }}
    />
  ) : posts.length === 0 ? (
    <EmptyState icon={Rss} message={fr.feed.noPosts} />
  ) : (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {entries.map((entry, index) =>
          !isBuilt(index) ? (
            <RowPlaceholder
              key={entryKeys[index]}
              heightKey={entryKeys[index] ?? ""}
              estimatedHeight={
                entry.kind === "post"
                  ? POST_ESTIMATED_HEIGHT_PX
                  : entry.item.type === "offer"
                    ? OPPORTUNITY_ROW_ESTIMATED_HEIGHT_PX
                    : PROJECT_CARD_ESTIMATED_HEIGHT_PX
              }
            />
          ) : entry.kind === "project" ? (
            entry.item.type === "offer" ? (
              <OpportunityRow
                key={entryKeys[index]}
                heightKey={entryKeys[index]}
                opportunity={entry.item.offer}
                variant="card"
              />
            ) : (
              <ProjectFeedCard
                key={entryKeys[index]}
                heightKey={entryKeys[index]}
                project={entry.item.project}
                variant="card"
                viewerProfileId={profile?.id ?? null}
              />
            )
          ) : (
            <PostListItem
              key={entryKeys[index]}
              post={entry.item}
              canInteract={canInteract}
              viewerProfileId={profile?.id ?? null}
              onReact={handleReact}
              onSave={handleSave}
              onFeedback={setFeedbackPostId}
              onDeleteRequest={setPostToDelete}
              onChange={handlePostChange}
            />
          ),
        )}
      </ul>
      {nextCursor && (
        <Button variant="secondary" onClick={loadMore} className="self-center">
          {fr.feed.loadMore}
        </Button>
      )}
      <DemoNoticeLine className="lg:hidden" />
    </div>
  );

  const header = (
    // Le mot-symbole au centre, à la place du titre : la page garde son titre
    // "Fil" pour les lecteurs d'écran et le changement de page.
    <div className="grid min-h-control grid-cols-[1fr_auto_1fr] items-center gap-2">
      <span aria-hidden="true" />
      <h1 className="flex justify-center">
        <span className="sr-only">{fr.feed.title}</span>
        <span aria-hidden="true" className="flex">
          <KemetWordmark className="h-[22px] w-auto" />
        </span>
      </h1>
      <div className="flex items-center justify-end gap-2">
        {canInteract &&
          (tab === "opportunites" ? (
            <HeaderActionLink href="/opportunites/nouvelle" icon={Plus}>
              {fr.opportunities.publish}
            </HeaderActionLink>
          ) : tab === "projets" ? (
            <HeaderActionLink href="/projets/nouveau" icon={Plus}>
              {fr.projects.createTitle}
            </HeaderActionLink>
          ) : (
            <HeaderActionLink href="/fil/nouveau" icon={Plus}>
              {fr.feed.newPostLink}
            </HeaderActionLink>
          ))}
      </div>
    </div>
  );

  return (
    <>
      <ReadingPage
        activeSection="fil"
        width="feed"
        header={header}
        className="pb-[calc(76px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-8"
      >
        {status === "visitor" && <VisitorBanner />}
        {status === "ready" && <InstallBanner />}
        {isSuspended && <SuspendedBanner />}

        <Tabs
          layout="centered"
          value={tab}
          onValueChange={(value) => {
            setTab(value as FeedTabValue);
            writeFeedViewToUrl(value as FeedTabValue);
          }}
          items={[
            {
              value: "pour-toi",
              label: fr.feed.tabPourToi,
              content:
                tab === "pour-toi" ? (
                  <div className="flex flex-col gap-4">
                    {talentFeed && <OpenProfilesStrip />}
                    {feedContent}
                  </div>
                ) : null,
            },
            {
              value: "projets",
              label: fr.feed.tabProjets,
              content:
                tab === "projets" ? <ProjectsFeed viewerProfileId={profile?.id ?? null} /> : null,
            },
            {
              value: "opportunites",
              label: fr.opportunities.tab,
              content:
                tab === "opportunites" ? (
                  <OpportunitiesFeed viewerProfileId={profile?.id ?? null} />
                ) : null,
            },
          ]}
        />

        <Dialog
          open={feedbackPostId !== null}
          onOpenChange={(open) => !open && setFeedbackPostId(null)}
          title={fr.feed.feedbackTitle}
        >
          <div className="flex flex-col gap-3">
            <CodeTextarea
              placeholder={fr.feed.feedbackPlaceholder}
              aria-label={fr.feed.feedbackPlaceholder}
              value={feedbackBody}
              onValueChange={setFeedbackBody}
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
