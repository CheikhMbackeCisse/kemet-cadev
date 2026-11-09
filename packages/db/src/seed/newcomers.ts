import { randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { POINTS_ASSISTANT_SKILL_HELPFUL } from "../points-rules.js";
import {
  account,
  assistantInvocations,
  BEGINNERS_SPACE_ID,
  helpRequests,
  messages,
  pointsLedger,
  postReplies,
  posts,
  profileCvs,
  profiles,
  projects,
  skills,
  spaceMembers,
  spaces,
  user,
} from "../schema/index.js";
import { DEMO_ACCOUNTS } from "./accounts.js";
import { avatarDataUri } from "./avatar.js";
import { DEMO_ASSETS_DIR } from "./demo-media.js";
import { demoUuid } from "./demo-uuid.js";
import {
  BEGINNER_SPACE_MEMBERS,
  BEGINNER_SPACE_MESSAGES,
  DEMO_ACCOUNT_INTERESTS,
  DEMO_BEGINNER_HELPERS,
  DEMO_CVS,
  DEMO_PROFILE_LINKS,
  KOBO_PROJECT,
  NEWCOMER_ACCOUNTS,
  NEWCOMER_POSTS,
  NEWCOMER_SKILLS,
  type NewcomerPost,
} from "./newcomers-content.js";
import { hoursAgo } from "./time.js";

const ASSISTANT_HANDLE = "kemet";

export type NewcomersResult =
  | { status: "skipped"; reason: string }
  | {
      status: "done";
      accounts: number;
      cvs: number;
      posts: number;
      spaceMessages: number;
      filesWritten: boolean;
    };

/** Adresse de démonstration d'un nouveau compte, jamais destinataire d'un email. */
export function newcomerEmail(handle: string): string {
  return `${handle.replace("-", ".")}@demo.kemetlabs.dev`;
}

// Le profil système de l'assistant n'est pas un profil de démonstration.
async function profileIdsByHandle(db: DbOrTx, handles: string[]): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(
      and(
        inArray(profiles.handle, handles),
        or(eq(profiles.isDemo, true), eq(profiles.handle, ASSISTANT_HANDLE)),
      ),
    );
  return new Map(rows.map((row) => [row.handle, row.id]));
}

async function createAccounts(db: DbOrTx, passwordHash: string): Promise<number> {
  const existing = await profileIdsByHandle(
    db,
    NEWCOMER_ACCOUNTS.map((entry) => entry.handle),
  );
  let created = 0;
  for (const entry of NEWCOMER_ACCOUNTS) {
    if (existing.has(entry.handle)) continue;
    const userId = randomUUID();
    await db.insert(user).values({
      id: userId,
      name: entry.name,
      email: newcomerEmail(entry.handle),
      emailVerified: true,
    });
    await db.insert(account).values({
      id: randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    });
    await db.insert(profiles).values({
      userId,
      handle: entry.handle,
      displayName: entry.name,
      country: entry.country,
      role: entry.role,
      title: entry.title,
      bio: entry.bio,
      stack: entry.stack,
      interests: entry.interests,
      intents: entry.intents,
      avatarUrl: avatarDataUri(entry.handle),
      helpsBeginners: false,
      isDemo: true,
      onboardingCompletedAt: new Date(),
    });
    created += 1;
  }
  return created;
}

// Les comptes d'origine n'avaient aucun sujet : sans eux, ils compteraient
// comme débutants. On ne remplit que ce qui est vide.
async function completeDemoProfiles(db: DbOrTx, ids: Map<string, string>): Promise<void> {
  for (const [handle, interests] of Object.entries(DEMO_ACCOUNT_INTERESTS)) {
    const id = ids.get(handle);
    if (!id) continue;
    await db
      .update(profiles)
      .set({ interests })
      .where(and(eq(profiles.id, id), sql`cardinality(${profiles.interests}) = 0`));
  }
  const helpers = DEMO_BEGINNER_HELPERS.map((handle) => ids.get(handle)).filter(
    (id): id is string => id !== undefined,
  );
  if (helpers.length > 0)
    await db.update(profiles).set({ helpsBeginners: true }).where(inArray(profiles.id, helpers));

  for (const [handle, links] of Object.entries(DEMO_PROFILE_LINKS)) {
    const id = ids.get(handle);
    if (!id) continue;
    if (links.portfolioUrl)
      await db
        .update(profiles)
        .set({ portfolioUrl: links.portfolioUrl })
        .where(and(eq(profiles.id, id), isNull(profiles.portfolioUrl)));
    if (links.websiteUrl)
      await db
        .update(profiles)
        .set({ websiteUrl: links.websiteUrl })
        .where(and(eq(profiles.id, id), isNull(profiles.websiteUrl)));
  }
}

async function attachCvs(
  db: DbOrTx,
  ids: Map<string, string>,
  files: { uploadsDir: string; assetsDir: string },
): Promise<number> {
  let attached = 0;
  for (const cv of DEMO_CVS) {
    const profileId = ids.get(cv.handle);
    if (!profileId) continue;
    const [present] = await db
      .select({ profileId: profileCvs.profileId })
      .from(profileCvs)
      .where(eq(profileCvs.profileId, profileId));
    if (present) continue;
    const asset = `cv-${cv.handle}.pdf`;
    const storageKey = demoUuid(`file:cv:${cv.handle}`);
    const target = join(files.uploadsDir, storageKey);
    await mkdir(files.uploadsDir, { recursive: true });
    await copyFile(join(files.assetsDir, asset), target);
    await db.insert(profileCvs).values({
      profileId,
      storageKey,
      originalName: `CV ${cv.handle}.pdf`,
      byteSize: (await stat(target)).size,
      visibility: cv.visibility,
    });
    attached += 1;
  }
  return attached;
}

async function createSkills(db: DbOrTx, ids: Map<string, string>): Promise<Map<string, string>> {
  const skillIds = new Map<string, string>();
  for (const entry of NEWCOMER_SKILLS) {
    const id = demoUuid(`newcomer-skill:${entry.key}`);
    await db
      .insert(skills)
      .values({
        id,
        authorId: ids.get(entry.authorHandle)!,
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        content: entry.content,
        tags: entry.tags,
        visibility: "public",
        isBeginner: true,
        isDemo: true,
        createdAt: hoursAgo(24 * 12),
      })
      .onConflictDoNothing();
    const [row] = await db
      .select({ id: skills.id })
      .from(skills)
      .where(and(eq(skills.slug, entry.slug), eq(skills.isDemo, true)));
    if (row) skillIds.set(entry.key, row.id);
  }
  return skillIds;
}

async function createAssistantReply(
  db: DbOrTx,
  post: NewcomerPost,
  postId: string,
  ids: Map<string, string>,
  skillIds: Map<string, string>,
): Promise<void> {
  const exchange = post.assistant!;
  const askedBy = ids.get(exchange.trigger.authorHandle)!;
  const askedAt = hoursAgo(exchange.trigger.hoursAgo);
  const answeredAt = new Date(askedAt.getTime() + 20_000);
  const triggerId = demoUuid(`newcomer-reply:${exchange.trigger.key}`);
  const answerId = demoUuid(`newcomer-reply:${exchange.trigger.key}:kemet`);
  await db.insert(postReplies).values([
    { id: triggerId, postId, authorId: askedBy, body: exchange.trigger.body, createdAt: askedAt },
    {
      id: answerId,
      postId,
      authorId: ids.get(ASSISTANT_HANDLE)!,
      body: exchange.answer,
      createdAt: answeredAt,
    },
  ]);
  const skillId = skillIds.get(exchange.skillKey);
  const [invocation] = await db
    .insert(assistantInvocations)
    .values({
      postId,
      triggerReplyId: triggerId,
      responseReplyId: answerId,
      requestedBy: askedBy,
      skillIds: skillId ? [skillId] : [],
      status: "done",
      recorded: true,
      helpful: exchange.helpful,
      createdAt: askedAt,
      completedAt: answeredAt,
    })
    .returning({ id: assistantInvocations.id });

  const skill = NEWCOMER_SKILLS.find((entry) => entry.key === exchange.skillKey);
  if (exchange.helpful && skill)
    await db
      .insert(pointsLedger)
      .values({
        profileId: ids.get(skill.authorHandle)!,
        source: "assistant_skill_helpful",
        sourceId: invocation!.id,
        amount: POINTS_ASSISTANT_SKILL_HELPFUL,
        givenByProfileId: askedBy,
        createdAt: answeredAt,
      })
      .onConflictDoNothing();
}

async function createPosts(
  db: DbOrTx,
  ids: Map<string, string>,
  skillIds: Map<string, string>,
): Promise<number> {
  const existing = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      inArray(
        posts.id,
        NEWCOMER_POSTS.map((post) => demoUuid(`newcomer-post:${post.key}`)),
      ),
    );
  const existingIds = new Set(existing.map((row) => row.id));

  let created = 0;
  for (const post of NEWCOMER_POSTS) {
    const id = demoUuid(`newcomer-post:${post.key}`);
    if (existingIds.has(id)) continue;
    await db.insert(posts).values({
      id,
      authorId: ids.get(post.authorHandle)!,
      body: post.body,
      format: post.format ?? null,
      isBeginner: post.isBeginner ?? false,
      createdAt: hoursAgo(post.hoursAgo),
    });
    if (post.replies?.length)
      await db.insert(postReplies).values(
        post.replies.map((reply) => ({
          id: demoUuid(`newcomer-reply:${reply.key}`),
          postId: id,
          authorId: ids.get(reply.authorHandle)!,
          body: reply.body,
          createdAt: hoursAgo(reply.hoursAgo),
        })),
      );
    if (post.assistant) await createAssistantReply(db, post, id, ids, skillIds);
    created += 1;
  }
  return created;
}

async function createKoboProject(db: DbOrTx, ids: Map<string, string>): Promise<void> {
  const ownerId = ids.get(KOBO_PROJECT.ownerHandle)!;
  const projectId = demoUuid(`newcomer-project:${KOBO_PROJECT.slug}`);
  await db
    .insert(projects)
    .values({
      id: projectId,
      ownerId,
      slug: KOBO_PROJECT.slug,
      name: KOBO_PROJECT.name,
      pitch: KOBO_PROJECT.pitch,
      description: KOBO_PROJECT.description,
      repoUrl: KOBO_PROJECT.repoUrl,
      stack: KOBO_PROJECT.stack,
      createdAt: hoursAgo(24 * 6),
    })
    .onConflictDoNothing();
  const [project] = await db
    .select({ id: projects.id, ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.slug, KOBO_PROJECT.slug));
  // Un vrai compte a pu prendre ce slug : on ne lui ajoute rien.
  if (!project || project.ownerId !== ownerId) return;
  await db
    .insert(helpRequests)
    .values(
      KOBO_PROJECT.helpRequests.map((request, index) => ({
        id: demoUuid(`newcomer-help:${request.key}`),
        projectId: project.id,
        authorId: ownerId,
        kind: request.kind,
        title: request.title,
        description: request.description,
        stack: request.stack,
        createdAt: hoursAgo(24 * 5 - index),
      })),
    )
    .onConflictDoNothing();
}

async function fillBeginnerSpace(db: DbOrTx, ids: Map<string, string>): Promise<number> {
  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.id, BEGINNERS_SPACE_ID));
  if (!space) return 0;
  const members = BEGINNER_SPACE_MEMBERS.map((handle) => ids.get(handle)).filter(
    (id): id is string => id !== undefined,
  );
  await db
    .insert(spaceMembers)
    .values(
      members.map((profileId) => ({ spaceId: space.id, profileId, joinedAt: hoursAgo(24 * 10) })),
    )
    .onConflictDoNothing();
  const inserted = await db
    .insert(messages)
    .values(
      BEGINNER_SPACE_MESSAGES.map((message) => ({
        channelId: message.channelId,
        authorId: ids.get(message.authorHandle)!,
        clientId: `demo-beginners-${message.key}`,
        body: message.body,
        createdAt: hoursAgo(message.hoursAgo),
      })),
    )
    .onConflictDoNothing()
    .returning({ id: messages.id });
  return inserted.length;
}

/**
 * Comptes moins techniques (recruteurs, entrepreneure, étudiants, lycéens),
 * posts de débutants et de carrière, espace "Débuter en informatique" et
 * bibliothèques remplies. Relançable : ne crée que ce qui manque et ne touche
 * qu'aux profils de démonstration. Sans `uploadsDir`, les CV sont repris au
 * passage suivant.
 */
export async function seedNewcomers(
  db: DbOrTx,
  options: {
    passwordHash: () => Promise<string>;
    uploadsDir: string | undefined;
    assetsDir?: string;
  },
): Promise<NewcomersResult> {
  const original = await profileIdsByHandle(db, [
    ...DEMO_ACCOUNTS.map((entry) => entry.handle),
    ASSISTANT_HANDLE,
  ]);
  if (original.size !== DEMO_ACCOUNTS.length + 1)
    return { status: "skipped", reason: "comptes de démonstration absents ou incomplets" };

  // Un vrai compte a pu prendre l'un de ces identifiants : on ne crée alors
  // rien plutôt que de faire échouer tout le seed sur la contrainte d'unicité.
  const taken = await db
    .select({ handle: profiles.handle })
    .from(profiles)
    .where(
      and(
        inArray(
          profiles.handle,
          NEWCOMER_ACCOUNTS.map((entry) => entry.handle),
        ),
        eq(profiles.isDemo, false),
      ),
    );
  if (taken.length > 0)
    return {
      status: "skipped",
      reason: `identifiant déjà pris par un vrai compte : ${taken.map((row) => row.handle).join(", ")}`,
    };

  const missing = await profileIdsByHandle(
    db,
    NEWCOMER_ACCOUNTS.map((entry) => entry.handle),
  );
  const passwordHash = missing.size < NEWCOMER_ACCOUNTS.length ? await options.passwordHash() : "";

  return db.transaction(async (tx) => {
    const accounts = await createAccounts(tx, passwordHash);
    const ids = await profileIdsByHandle(tx, [
      ...DEMO_ACCOUNTS.map((entry) => entry.handle),
      ...NEWCOMER_ACCOUNTS.map((entry) => entry.handle),
      ASSISTANT_HANDLE,
    ]);
    await completeDemoProfiles(tx, ids);
    const files = options.uploadsDir
      ? { uploadsDir: options.uploadsDir, assetsDir: options.assetsDir ?? DEMO_ASSETS_DIR }
      : null;
    const cvs = files ? await attachCvs(tx, ids, files) : 0;
    const skillIds = await createSkills(tx, ids);
    const createdPosts = await createPosts(tx, ids, skillIds);
    await createKoboProject(tx, ids);
    const spaceMessages = await fillBeginnerSpace(tx, ids);
    return {
      status: "done",
      accounts,
      cvs,
      posts: createdPosts,
      spaceMessages,
      filesWritten: files !== null,
    };
  });
}
