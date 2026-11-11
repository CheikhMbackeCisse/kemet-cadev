import { FolderGit2, Plus, Rss } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prefersTalentFeed, type PostSummary } from "@kemet/shared";
import {
  ChatApiError,
  createPostFeedback,
  deletePost,
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
  ProjectFeedCardSkeleton,
} from "../components/feed/ProjectFeedCard.js";
import { navigate } from "../lib/navigation/navigate.js";
import { rememberedHeight } from "../lib/navigation/rememberedHeights.js";
import { interleaveProjects } from "../lib/feed/interleave.js";
import { useVisibleFirst } from "../lib/feed/useVisibleFirst.js";
import {
  feedQueryKey,
  fetchFeed,
  forgetPost,
  mergeFreshFirstPage,
  type FeedData,
  type FeedView,
} from "../lib/feed/feedQuery.js";
import { ASK_KEMET_PARAM, isTechnicalPost } from "../lib/feed/technicalPost.js";
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
import { CodeTextarea } from "../components/content/CodeTextarea.js";

const postHeightKey = (postId: string) => `post:${postId}`;
const projectHeightKey = (projectId: string) => `project:${projectId}`;

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
}: {
  post: PostSummary;
  canInteract: boolean;
  viewerProfileId: string | null;
  onReact: (postId: string) => void;
  onSave: (postId: string) => void;
  onFeedback: (postId: string) => void;
  onDeleteRequest: (postId: string) => void;
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
      askKemet={
        canInteract && !post.deletedAt && isTechnicalPost(post.body)
          ? { href: `/fil/${post.id}?${ASK_KEMET_PARAM}=kemet` }
          : undefined
      }
    />
  );
}

// RH et entrepreneurs : une carte projet après chaque groupe de trois posts.
const TALENT_POSTS_PER_PROJECT_CARD = 3;

export function FeedPage() {
  const toast = useToast();
  const { status, profile, isSuspended } = useSession();
  const canInteract = status === "ready" && !isSuspended;
  const talentFeed = profile !== null && prefersTalentFeed(profile.role);
  // "Pour toi" par defaut pour tout le monde : un nouveau compte ne suit
  // encore personne, et ouvrait donc le fil sur une page vide.
  const [tab, setTab] = useState<FeedView>("pour-toi");
  const queryClient = useQueryClient();
  const queryKey = feedQueryKey(tab);
  const feed = useQuery({
    queryKey,
    queryFn: async () =>
      mergeFreshFirstPage(await fetchFeed(tab), queryClient.getQueryData<FeedData>(queryKey)),
  });
  const posts = feed.data?.posts ?? [];
  const projects = feed.data?.projects ?? [];
  const nextCursor = feed.data?.nextCursor ?? null;
  const loading = feed.isPending;
  const error = feed.isError && !feed.data;

  const entries = interleaveProjects(
    posts,
    projects,
    talentFeed && tab === "pour-toi" ? TALENT_POSTS_PER_PROJECT_CARD : undefined,
  );
  const entryKeys = entries.map((entry) =>
    entry.kind === "project" ? projectHeightKey(entry.item.id) : postHeightKey(entry.item.id),
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

  useEffect(() => {
    if (status === "visitor")
      setTab((current) => (current === "abonnements" ? "pour-toi" : current));
  }, [status]);

  async function loadMore() {
    if (!nextCursor || tab === "projets") return;
    try {
      const page = await listPosts(tab, nextCursor);
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

  const projectsContent = loading ? (
    <div className="flex flex-col divide-y divide-border">
      <ProjectFeedCardSkeleton />
      <ProjectFeedCardSkeleton />
    </div>
  ) : error ? (
    <ErrorState
      message={fr.feed.projectsLoadingError}
      retry={{ label: fr.chat.retry, onClick: () => reload() }}
    />
  ) : projects.length === 0 ? (
    <EmptyState
      icon={FolderGit2}
      message={status === "visitor" ? fr.feed.noProjectsVisitor : fr.feed.noProjects}
      action={
        status === "visitor"
          ? { label: fr.feed.browseProjects, onClick: () => navigate("/projets") }
          : { label: fr.feed.publishProject, onClick: () => navigate("/projets/nouveau") }
      }
    />
  ) : (
    <ul className="flex flex-col divide-y divide-border">
      {projects.map((project) => (
        <ProjectFeedCard
          key={project.id}
          project={project}
          variant="row"
          viewerProfileId={profile?.id ?? null}
        />
      ))}
    </ul>
  );

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
                entry.kind === "project"
                  ? PROJECT_CARD_ESTIMATED_HEIGHT_PX
                  : POST_ESTIMATED_HEIGHT_PX
              }
            />
          ) : entry.kind === "project" ? (
            <ProjectFeedCard
              key={entryKeys[index]}
              heightKey={entryKeys[index]}
              project={entry.item}
              variant="card"
              viewerProfileId={profile?.id ?? null}
            />
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
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-bold text-text">{fr.feed.title}</h1>
      <div className="flex items-center gap-2">
        {canInteract && (
          <HeaderActionLink href="/fil/nouveau" icon={Plus}>
            {fr.feed.newPostLink}
          </HeaderActionLink>
        )}
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

        {/* Un visiteur n'a pas d'abonnements : seulement "Pour toi" et "Projets". */}
        <Tabs
          layout="centered"
          value={tab}
          onValueChange={(value) => setTab(value as FeedView)}
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
            ...(status === "visitor"
              ? []
              : [
                  {
                    value: "abonnements",
                    label: fr.feed.tabAbonnements,
                    content: tab === "abonnements" ? feedContent : null,
                  },
                ]),
            {
              value: "projets",
              label: fr.feed.tabProjets,
              content: tab === "projets" ? projectsContent : null,
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
