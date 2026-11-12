import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useState } from "react";
import type { PostSummary } from "@kemet/shared";
import {
  listOpportunities,
  listUserPosts,
  setPostBookmark,
  togglePostReaction,
} from "../../lib/chat/api.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";
import { PostCard, PostCardSkeleton } from "../feed/PostCard.js";
import { OpportunityRow } from "../opportunities/OpportunityRow.js";
import { Button } from "../ui/Button.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Tabs, type TabItem } from "../ui/Tabs.js";
import { useToast } from "../ui/Toast.js";

type PostPage = { items: PostSummary[]; nextCursor: string | null };

const TAB_PARAM = "onglet";

/**
 * Onglets d'une organisation : ses posts et ses offres, avec les cartes du
 * fil. Un onglet vide ne s'affiche pas.
 */
export function OrganizationTabs({ handle }: { handle: string }) {
  const { status, isSuspended } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canInteract = status === "ready" && !isSuspended;
  const [selected, setSelected] = useState(() =>
    new URLSearchParams(window.location.search).get(TAB_PARAM),
  );

  const postsKey = ["organization-posts", handle];
  const posts = useInfiniteQuery({
    queryKey: postsKey,
    queryFn: ({ pageParam }) => listUserPosts(handle, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const offers = useInfiniteQuery({
    queryKey: ["opportunities", { author: handle, includeClosed: true }],
    queryFn: ({ pageParam }) =>
      listOpportunities({ author: handle, includeClosed: true }, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

  function updatePost(postId: string, change: Partial<PostSummary>) {
    queryClient.setQueryData<InfiniteData<PostPage>>(postsKey, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((post) => (post.id === postId ? { ...post, ...change } : post)),
            })),
          }
        : data,
    );
  }

  async function handleReact(post: PostSummary) {
    try {
      updatePost(post.id, await togglePostReaction(post.id));
    } catch {
      toast.show(fr.feed.reactError, "danger");
    }
  }

  async function handleSave(post: PostSummary) {
    try {
      const result = await setPostBookmark(post.id, !post.savedByMe);
      updatePost(post.id, result);
      toast.show(result.savedByMe ? fr.feed.savedToast : fr.feed.unsavedToast, "success");
    } catch {
      toast.show(fr.feed.saveError, "danger");
    }
  }

  if (posts.isPending || offers.isPending) {
    return (
      <div className="flex flex-col divide-y divide-border" aria-hidden="true">
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }
  if (posts.isError || offers.isError) {
    return (
      <ErrorState
        message={fr.organizations.postsLoadingError}
        retry={{
          label: fr.chat.retry,
          onClick: () => {
            void posts.refetch();
            void offers.refetch();
          },
        }}
      />
    );
  }

  const postItems = posts.data.pages.flatMap((page) => page.items);
  const offerItems = offers.data.pages.flatMap((page) => page.items);
  const items: TabItem[] = [];
  if (postItems.length > 0) {
    items.push({
      value: "posts",
      label: fr.organizations.tabPosts,
      content: (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-border">
            {postItems.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                as="li"
                bodyHref={`/fil/${post.id}`}
                replyHref={`/fil/${post.id}`}
                canInteract={canInteract}
                isOwnPost={false}
                canFeedback={canInteract && post.format === "a_tester"}
                canReport={canInteract && !post.deletedAt}
                onReact={() => void handleReact(post)}
                onSave={() => void handleSave(post)}
                onFeedback={() => navigate(`/fil/${post.id}`)}
                onDelete={() => undefined}
                onChange={(change) => updatePost(post.id, change)}
              />
            ))}
          </ul>
          {posts.hasNextPage && (
            <Button
              variant="secondary"
              className="self-center"
              disabled={posts.isFetchingNextPage}
              onClick={() => void posts.fetchNextPage()}
            >
              {fr.feed.loadMore}
            </Button>
          )}
        </div>
      ),
    });
  }
  if (offerItems.length > 0) {
    items.push({
      value: "opportunites",
      label: fr.organizations.tabOpportunities,
      content: (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-border">
            {offerItems.map((offer) => (
              <OpportunityRow key={offer.id} opportunity={offer} />
            ))}
          </ul>
          {offers.hasNextPage && (
            <Button
              variant="secondary"
              className="self-center"
              disabled={offers.isFetchingNextPage}
              onClick={() => void offers.fetchNextPage()}
            >
              {fr.opportunities.loadMore}
            </Button>
          )}
        </div>
      ),
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-subtle">{fr.organizations.nothingPublished}</p>;
  }
  const active = items.find((item) => item.value === selected) ?? items[0]!;

  function selectTab(value: string) {
    setSelected(value);
    const url = new URL(window.location.href);
    if (value === items[0]?.value) url.searchParams.delete(TAB_PARAM);
    else url.searchParams.set(TAB_PARAM, value);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }

  return <Tabs value={active.value} onValueChange={selectTab} items={items} scrollable swipeable />;
}
