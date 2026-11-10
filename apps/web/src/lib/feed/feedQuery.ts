import type { FeedProject, FeedTab, PostSummary } from "@kemet/shared";
import type { QueryClient } from "@tanstack/react-query";
import { listFeedProjects, listPosts } from "../chat/api.js";

// Onglet "Projets" : seulement les cartes projet, sans les posts. "debuter"
// reste une source de l'API, plus montrée dans l'interface.
export type FeedView = Exclude<FeedTab, "debuter"> | "projets";

export interface FeedData {
  posts: PostSummary[];
  projects: FeedProject[];
  nextCursor: string | null;
}

// Assez de cartes pour une carte tous les cinq posts sur une page de vingt.
const PROJECTS_PER_POST_PAGE = 6;
const PROJECTS_TAB_SIZE = 20;

export function feedQueryKey(view: FeedView) {
  return ["feed", view] as const;
}

export async function fetchFeed(view: FeedView): Promise<FeedData> {
  if (view === "projets") {
    const result = await listFeedProjects("pour-toi", PROJECTS_TAB_SIZE);
    return { posts: [], projects: result.items, nextCursor: null };
  }
  // Les cartes projet accompagnent le fil : sans elles, il reste lisible.
  const [page, projectResult] = await Promise.all([
    listPosts(view),
    listFeedProjects(view, PROJECTS_PER_POST_PAGE).catch(() => ({ items: [] })),
  ]);
  return { posts: page.items, projects: projectResult.items, nextCursor: page.nextCursor };
}

/**
 * Mise à jour en arrière-plan d'un fil déjà affiché : la première page
 * fraîche remplace la tête, les pages chargées ensuite restent en place pour
 * que la position de lecture ne saute pas.
 */
export function mergeFreshFirstPage(fresh: FeedData, cached: FeedData | undefined): FeedData {
  if (!cached || cached.posts.length <= fresh.posts.length) return fresh;
  const freshIds = new Set(fresh.posts.map((post) => post.id));
  const tail = cached.posts.slice(fresh.posts.length).filter((post) => !freshIds.has(post.id));
  return { ...fresh, posts: [...fresh.posts, ...tail], nextCursor: cached.nextCursor };
}

export function postQueryKey(postId: string) {
  return ["post", postId] as const;
}

export function postRepliesQueryKey(postId: string) {
  return ["post", postId, "replies"] as const;
}

export function postFeedbackQueryKey(postId: string) {
  return ["post", postId, "feedback"] as const;
}

/** Le post tel que le fil déjà chargé le connaît, pour l'afficher sans attendre. */
export function postFromFeedCache(
  queryClient: QueryClient,
  postId: string,
): PostSummary | undefined {
  for (const [, data] of queryClient.getQueriesData<FeedData>({ queryKey: ["feed"] })) {
    const post = data?.posts.find((candidate) => candidate.id === postId);
    if (post) return post;
  }
  return undefined;
}

/**
 * Un post supprimé ou introuvable disparaît de tous les fils en cache. Sa
 * propre entrée est seulement marquée périmée : la retirer pendant que sa
 * page est affichée la ferait relire aussitôt.
 */
export function forgetPost(queryClient: QueryClient, postId: string) {
  queryClient.setQueriesData<FeedData>({ queryKey: ["feed"] }, (data) =>
    data ? { ...data, posts: data.posts.filter((post) => post.id !== postId) } : data,
  );
  void queryClient.invalidateQueries({ queryKey: postQueryKey(postId), refetchType: "none" });
}
