import { and, asc, eq, isNull } from "drizzle-orm";
import { postAttachments, posts, profiles, spacePinnedPosts, type DbOrTx } from "@kemet/db";
import type { SpacePinnedPost } from "@kemet/shared";

const TITLE_MAX = 120;

/** Première ligne non vide du post, sans la mise en forme Markdown qui l'entoure. */
export function pinTitle(body: string): string {
  const line = body.split("\n").find((candidate) => candidate.trim().length > 0) ?? "";
  const plain = line.replace(/^#+\s*/, "").replace(/\*\*|__|[*_`]/g, "").trim();
  return plain.length > TITLE_MAX ? `${plain.slice(0, TITLE_MAX - 1)}…` : plain;
}

/** Post épinglé d'un espace, s'il existe encore et que son auteur n'a pas supprimé son compte. */
export async function findSpacePinnedPost(db: DbOrTx, spaceId: string): Promise<SpacePinnedPost | null> {
  const [row] = await db
    .select({ id: posts.id, body: posts.body })
    .from(spacePinnedPosts)
    .innerJoin(posts, eq(posts.id, spacePinnedPosts.postId))
    .innerJoin(profiles, eq(profiles.id, posts.authorId))
    .where(and(eq(spacePinnedPosts.spaceId, spaceId), isNull(posts.deletedAt), isNull(profiles.deletedAt)));
  if (!row) return null;
  const [image] = await db
    .select({ id: postAttachments.id })
    .from(postAttachments)
    .where(eq(postAttachments.postId, row.id))
    .orderBy(asc(postAttachments.position), asc(postAttachments.createdAt))
    .limit(1);
  return { postId: row.id, title: pinTitle(row.body), imageId: image?.id ?? null };
}
