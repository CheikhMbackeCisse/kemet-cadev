import { and, asc, eq, ilike, isNotNull, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { follows, profileBlocks, profiles, type Db } from "@kemet/db";
import { KEMET_ASSISTANT_PROFILE_ID } from "../../chat/kemet-assistant.js";
import { containsPattern, prefixPattern } from "./like-pattern.js";

/**
 * Personnes à qui écrire, par nom ou identifiant. Seulement des comptes
 * réels et actifs : ni figurant, ni profil système (Kocc), ni compte
 * supprimé ou suspendu, ni quelqu'un que la personne a bloqué ou qui l'a
 * bloquée. Une organisation n'a pas de compte (`user_id` vide) : elle ne
 * reçoit pas de messages et n'apparaît donc pas. Les personnes suivies
 * passent en premier, puis le début du nom ou de l'identifiant.
 */
export async function searchPeopleToWrite(
  db: Db,
  viewerProfileId: string,
  query: string,
  limit: number,
) {
  const contains = containsPattern(query);
  const prefix = prefixPattern(query);
  const blockedByViewer = db
    .select({ id: profileBlocks.blockedId })
    .from(profileBlocks)
    .where(eq(profileBlocks.blockerId, viewerProfileId));
  const blockingViewer = db
    .select({ id: profileBlocks.blockerId })
    .from(profileBlocks)
    .where(eq(profileBlocks.blockedId, viewerProfileId));

  const followed = db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, viewerProfileId));

  return db
    .select()
    .from(profiles)
    .where(
      and(
        isNotNull(profiles.userId),
        eq(profiles.kind, "person"),
        eq(profiles.isFiller, false),
        isNull(profiles.deletedAt),
        isNull(profiles.suspendedAt),
        ne(profiles.id, viewerProfileId),
        // Le profil système de Kocc a un compte : seul son identifiant l'écarte.
        ne(profiles.id, KEMET_ASSISTANT_PROFILE_ID),
        notInArray(profiles.id, blockedByViewer),
        notInArray(profiles.id, blockingViewer),
        or(ilike(profiles.handle, contains), ilike(profiles.displayName, contains)),
      ),
    )
    .orderBy(
      sql`case when ${profiles.id} in ${followed} then 0 else 1 end`,
      sql`case when ${profiles.handle} ilike ${prefix} or ${profiles.displayName} ilike ${prefix} then 0 else 1 end`,
      asc(profiles.displayName),
    )
    .limit(limit);
}
