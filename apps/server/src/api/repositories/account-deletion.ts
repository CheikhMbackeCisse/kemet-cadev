import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, or } from "drizzle-orm";
import {
  account,
  competitions,
  credentials,
  follows,
  mcpServers,
  messageAttachments,
  messages,
  opportunities,
  postAttachments,
  postBookmarks,
  postReplies,
  postReposts,
  posts,
  profiles,
  projects,
  readStates,
  session,
  skillRatings,
  spaceMembers,
  submissions,
  user,
  verification,
  votes,
  workAttachments,
  workMedia,
  profileCvs,
  organizationManagers,
  organizationRequests,
  workAuthors,
  type Db,
} from "@kemet/db";
import { DELETED_ACCOUNT_HANDLE_PREFIX } from "@kemet/shared";
import { handOverOwnedSpaces } from "./space-ownership.js";

export const DELETED_ACCOUNT_DISPLAY_NAME = "Compte supprimé";

const HANDLE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomDeletedHandle(): string {
  const suffix = Array.from(
    randomBytes(8),
    (byte) => HANDLE_ALPHABET[byte % HANDLE_ALPHABET.length],
  ).join("");
  return `${DELETED_ACCOUNT_HANDLE_PREFIX}${suffix}`;
}

/** Fournisseurs de connexion liés au compte, hors mot de passe. */
export async function listSocialProviders(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId));
  return rows.map((row) => row.providerId).filter((providerId) => providerId !== "credential");
}

/** Le compte email a un mot de passe ; un compte GitHub, Google ou LinkedIn n'en a pas. */
export async function findPasswordHash(db: Db, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
        isNotNull(account.password),
      ),
    );
  return row?.password ?? null;
}

/**
 * Anonymise un compte en une transaction (ADR 0023) : efface les données qui
 * identifient la personne, garde ses contenus publics sous "Compte supprimé",
 * le registre de points, les signalements et le journal de modération.
 * Renvoie les clés des fichiers à effacer du disque, une fois la transaction
 * validée : un fichier effacé ne se restaure pas si la transaction échoue.
 */
export async function anonymizeAccount(db: Db, userId: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    const [account_] = await tx
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!account_) return [];
    const [profile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId));

    let storageKeys: string[] = [];
    if (profile) {
      storageKeys = await anonymizeProfile(tx, profile.id);
    }

    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));
    // Jetons de vérification d'email et de réinitialisation du mot de passe.
    await tx
      .delete(verification)
      .where(or(eq(verification.identifier, account_.email), eq(verification.value, userId)));
    await tx.delete(user).where(eq(user.id, userId));
    return storageKeys;
  });
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function anonymizeProfile(tx: Tx, profileId: string): Promise<string[]> {
  const now = new Date();

  await tx
    .update(profiles)
    .set({
      userId: null,
      handle: randomDeletedHandle(),
      displayName: DELETED_ACCOUNT_DISPLAY_NAME,
      country: "",
      role: null,
      roleOther: null,
      workMode: null,
      organization: null,
      title: null,
      bio: null,
      stack: [],
      githubUrl: null,
      gitlabUrl: null,
      linkedinUrl: null,
      portfolioUrl: null,
      websiteUrl: null,
      helpsBeginners: false,
      avatarUrl: null,
      bannerUrl: null,
      openToOpportunities: false,
      interests: [],
      interestOther: null,
      intents: [],
      isPlatformAdmin: false,
      deletedAt: now,
    })
    .where(eq(profiles.id, profileId));

  await tx.delete(credentials).where(eq(credentials.profileId, profileId));
  await tx
    .delete(follows)
    .where(or(eq(follows.followerId, profileId), eq(follows.followeeId, profileId)));
  await handOverOwnedSpaces(tx, profileId, now);
  await tx.delete(spaceMembers).where(eq(spaceMembers.profileId, profileId));
  await tx.delete(readStates).where(eq(readStates.profileId, profileId));
  await tx.delete(postBookmarks).where(eq(postBookmarks.profileId, profileId));
  // Une republication sans personne derrière gonflerait le compteur et le fil.
  await tx.delete(postReposts).where(eq(postReposts.profileId, profileId));
  await tx.delete(skillRatings).where(eq(skillRatings.raterId, profileId));
  await tx.delete(mcpServers).where(eq(mcpServers.addedBy, profileId));
  // Le vote d'une compétition close reste : le retirer changerait un
  // classement déjà publié et les points de podium déjà versés.
  await tx
    .delete(votes)
    .where(
      and(
        eq(votes.voterId, profileId),
        inArray(
          votes.submissionId,
          tx
            .select({ id: submissions.id })
            .from(submissions)
            .innerJoin(competitions, eq(competitions.id, submissions.competitionId))
            .where(gt(competitions.votingClosesAt, now)),
        ),
      ),
    );

  // Un contenu déjà supprimé n'était que masqué : son texte part maintenant.
  await tx
    .update(messages)
    .set({ body: "" })
    .where(and(eq(messages.authorId, profileId), isNotNull(messages.deletedAt)));
  await tx
    .update(posts)
    .set({ body: "", testUrl: null, testAsk: null })
    .where(and(eq(posts.authorId, profileId), isNotNull(posts.deletedAt)));
  await tx
    .update(postReplies)
    .set({ body: "" })
    .where(and(eq(postReplies.authorId, profileId), isNotNull(postReplies.deletedAt)));
  await tx
    .update(projects)
    .set({ name: "", pitch: "", description: "", repoUrl: "", demoUrl: null, stack: [] })
    .where(and(eq(projects.ownerId, profileId), isNotNull(projects.deletedAt)));
  // Une offre appelle à écrire à son auteur : sans compte, elle n'a plus de sens.
  await tx.delete(opportunities).where(eq(opportunities.authorId, profileId));

  const messageFiles = await tx
    .select({ storageKey: messageAttachments.storageKey })
    .from(messageAttachments)
    .where(eq(messageAttachments.authorId, profileId));
  const postRows = await tx
    .select({
      storageKey: postAttachments.storageKey,
      posterStorageKey: postAttachments.posterStorageKey,
    })
    .from(postAttachments)
    .where(eq(postAttachments.authorId, profileId));
  // L'image d'aperçu d'une vidéo est un second fichier sur le disque.
  const postFiles = postRows.flatMap((row) => [
    { storageKey: row.storageKey },
    ...(row.posterStorageKey ? [{ storageKey: row.posterStorageKey }] : []),
  ]);
  // Le PDF d'un travail porte en général le nom de son auteur : il part avec
  // le compte, comme les images de post. Le travail reste, sans pièce jointe.
  const workFiles = await tx
    .delete(workAttachments)
    .where(eq(workAttachments.authorId, profileId))
    .returning({ storageKey: workAttachments.storageKey });
  // Même règle pour la couverture, la galerie et les vidéos : un visage, une
  // voix. Les liens YouTube partent aussi, ils pointent vers une chaîne.
  const mediaFiles = await tx
    .delete(workMedia)
    .where(eq(workMedia.authorId, profileId))
    .returning({ storageKey: workMedia.storageKey });
  const cvFiles = await tx
    .delete(profileCvs)
    .where(eq(profileCvs.profileId, profileId))
    .returning({ storageKey: profileCvs.storageKey });
  await tx
    .delete(workAuthors)
    .where(and(eq(workAuthors.profileId, profileId), eq(workAuthors.status, "pending")));
  // Une demande de référencement encore en attente part avec le compte. La
  // page d'une organisation déjà acceptée reste : elle n'est pas à la
  // personne, qui perd seulement le droit d'y publier.
  const requestLogos = await tx
    .delete(organizationRequests)
    .where(
      and(
        eq(organizationRequests.requesterId, profileId),
        eq(organizationRequests.status, "pending"),
      ),
    )
    .returning({ storageKey: organizationRequests.logoStorageKey });
  await tx.delete(organizationManagers).where(eq(organizationManagers.managerId, profileId));
  return [
    ...[...messageFiles, ...postFiles, ...workFiles, ...cvFiles].map((file) => file.storageKey),
    ...requestLogos.flatMap((file) => (file.storageKey ? [file.storageKey] : [])),
    ...mediaFiles.flatMap((file) => (file.storageKey ? [file.storageKey] : [])),
  ];
}
