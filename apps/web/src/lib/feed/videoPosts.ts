import type { Attachment, PostSummary } from "@kemet/shared";
import type { QueryClient } from "@tanstack/react-query";
import { postQueryKey, type FeedData } from "./feedQuery.js";

/** La vidéo d'un post, s'il en a une encore lisible. Une vidéo se publie seule. */
export function postVideo(post: PostSummary): Attachment | null {
  if (post.deletedAt) return null;
  const first = post.attachments[0];
  return first && first.kind === "video" && !first.removed ? first : null;
}

/**
 * Les posts vidéo du fil où se trouve `postId`, dans l'ordre du fil : la vue
 * plein écran fait défiler ceux-là, comme le fil qu'on vient de quitter.
 * Vide si aucun fil en cache ne contient ce post (lien ouvert directement).
 */
export function videoPostsAround(feeds: (FeedData | undefined)[], postId: string): PostSummary[] {
  const feed = feeds.find((data) => data?.posts.some((post) => post.id === postId));
  return feed ? feed.posts.filter((post) => postVideo(post) !== null) : [];
}

export function videoPostsFromCache(queryClient: QueryClient, postId: string): PostSummary[] {
  const feeds = queryClient
    .getQueriesData<FeedData>({ queryKey: ["feed"] })
    .map(([, data]) => data);
  return videoPostsAround(feeds, postId);
}

/** Un cœur ou un enregistrement donné en plein écran se retrouve dans le fil et sur la page du post. */
export function updatePostInCaches(
  queryClient: QueryClient,
  postId: string,
  change: Partial<PostSummary>,
) {
  queryClient.setQueriesData<FeedData>({ queryKey: ["feed"] }, (data) =>
    data
      ? {
          ...data,
          posts: data.posts.map((post) => (post.id === postId ? { ...post, ...change } : post)),
        }
      : data,
  );
  queryClient.setQueryData<PostSummary | null>(postQueryKey(postId), (post) =>
    post ? { ...post, ...change } : post,
  );
}
