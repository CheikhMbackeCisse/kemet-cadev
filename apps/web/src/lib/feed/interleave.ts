/** Une carte projet au plus après chaque groupe de cinq posts : le fil reste d'abord un fil de posts. */
export const POSTS_PER_PROJECT_CARD = 5;

export type FeedEntry<Post, Project> =
  { kind: "post"; item: Post } | { kind: "project"; item: Project };

/**
 * Glisse les projets dans la suite des posts, dans leur ordre de classement,
 * un après chaque groupe complet de `every` posts. Les projets en trop ne
 * sont pas montrés : un fil court n'est pas rempli de cartes projet.
 */
export function interleaveProjects<Post, Project>(
  posts: Post[],
  projects: Project[],
  every = POSTS_PER_PROJECT_CARD,
): FeedEntry<Post, Project>[] {
  const entries: FeedEntry<Post, Project>[] = [];
  let projectIndex = 0;
  posts.forEach((post, index) => {
    entries.push({ kind: "post", item: post });
    const project = projects[projectIndex];
    if ((index + 1) % every === 0 && project !== undefined) {
      entries.push({ kind: "project", item: project });
      projectIndex += 1;
    }
  });
  return entries;
}
