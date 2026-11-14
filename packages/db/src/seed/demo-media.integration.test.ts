import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, avg, count, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import {
  assistantInvocations,
  postAttachments,
  posts,
  profiles,
  skillRatings,
  skills,
  spaceMembers,
  spacePinnedPosts,
  spaces,
  user,
  workMedia,
  works,
} from "../schema/index.js";
import { CADEV_ASSETS_DIR, CADEV_SLIDES, seedCadevPost } from "./cadev-post.js";
import { seedDemoDataset } from "./demo-dataset.js";
import {
  DEMO_ASSET_NAMES,
  DEMO_EXISTING_POST_IMAGES,
  DEMO_MEDIA_POSTS,
  DEMO_SKILL_TARGETS,
  DEMO_WORK_MEDIA,
} from "./demo-media-content.js";
import { seedDemoMedia } from "./demo-media.js";
import { demoUuid } from "./demo-uuid.js";
import { SYSTALINK_DISPLAY_NAME, SYSTALINK_PROFILE_ID } from "./systalink.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("médias de démonstration", () => {
  const db = createDb(databaseUrl ?? "");
  let uploadsDir = "";

  beforeAll(async () => {
    await resetTestDatabase(databaseUrl!);
    uploadsDir = await mkdtemp(join(tmpdir(), "kemet-demo-media-"));
  });

  afterAll(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it("ne fait rien sur une base sans comptes de démonstration", async () => {
    expect(await seedDemoMedia(db, { uploadsDir })).toMatchObject({ status: "skipped" });
    expect(await db.$count(posts)).toBe(0);
  });

  it("complète une base déjà remplie par le seed", async () => {
    await seedDemoDataset(db);
    const result = await seedDemoMedia(db, { uploadsDir });
    expect(result).toEqual({
      status: "done",
      banners: 10,
      posts: DEMO_MEDIA_POSTS.length,
      postImages: DEMO_EXISTING_POST_IMAGES.length,
      postImageSizes: 0,
      cadevPost: "6 image(s), épinglé",
      works: DEMO_WORK_MEDIA.length,
      skillUses: expect.any(Number),
      skillRatings: expect.any(Number),
      filesWritten: true,
    });
  }, 300_000);

  it("rattache à chaque nouveau post son image, écrite sur le disque", async () => {
    for (const post of DEMO_MEDIA_POSTS.filter((candidate) => candidate.image)) {
      const attachments = await db
        .select()
        .from(postAttachments)
        .where(eq(postAttachments.postId, demoUuid(`post:${post.key}`)));
      expect(attachments, post.key).toHaveLength(1);
      const file = await readFile(join(uploadsDir, attachments[0]!.storageKey));
      expect(file.byteLength).toBe(attachments[0]!.byteSize);
      expect(attachments[0]!.mimeType).toBe("image/jpeg");
    }
  });

  it("range les images d'un carrousel dans l'ordre, avec leurs dimensions", async () => {
    for (const post of DEMO_MEDIA_POSTS.filter((candidate) => candidate.images)) {
      const attachments = await db
        .select()
        .from(postAttachments)
        .where(eq(postAttachments.postId, demoUuid(`post:${post.key}`)))
        .orderBy(postAttachments.position);
      expect(attachments.map((row) => row.originalName), post.key).toEqual(
        post.images!.map((image) => DEMO_ASSET_NAMES[image]),
      );
      for (const row of attachments) expect([row.width, row.height]).toEqual([960, 960]);
    }
  });

  it("publie le post CADEV au nom de Systalink, dans son espace, avec ses six visuels tels quels, épinglé", async () => {
    const [post] = await db.select().from(posts).where(eq(posts.id, demoUuid("post:cadev-en-bref")));
    const [space] = await db.select().from(spaces).where(eq(spaces.slug, "cadev-2026"));
    expect(post).toMatchObject({
      authorId: SYSTALINK_PROFILE_ID,
      spaceId: space!.id,
      mediaCredit: null,
      mediaCreditUrl: null,
    });
    const [pin] = await db.select().from(spacePinnedPosts).where(eq(spacePinnedPosts.spaceId, space!.id));
    expect(pin?.postId).toBe(post!.id);
    const images = await db
      .select()
      .from(postAttachments)
      .where(eq(postAttachments.postId, post!.id))
      .orderBy(postAttachments.position);
    expect(images.map((image) => image.originalName)).toEqual(CADEV_SLIDES.map((slide) => slide.alt));
    for (const [position, image] of images.entries()) {
      const stored = await readFile(join(uploadsDir, image.storageKey));
      expect(stored.equals(await readFile(join(CADEV_ASSETS_DIR, CADEV_SLIDES[position]!.file)))).toBe(true);
      expect([image.mimeType, image.width, image.height, image.authorId]).toEqual([
        "image/webp",
        1080,
        1350,
        SYSTALINK_PROFILE_ID,
      ]);
    }
  });

  it("crée Systalink sans aucun moyen de connexion, avec son symbole pour seule image", async () => {
    const [systalink] = await db.select().from(profiles).where(eq(profiles.handle, "systalink"));
    expect(systalink).toMatchObject({
      id: SYSTALINK_PROFILE_ID,
      userId: null,
      displayName: SYSTALINK_DISPLAY_NAME,
      bio: null,
      bannerUrl: null,
      isFiller: false,
      isPlatformAdmin: false,
      deletedAt: null,
    });
    // Symbole en vectoriel, couleur de la marque, jamais une image tramée.
    const svg = decodeURIComponent(systalink!.avatarUrl!.replace("data:image/svg+xml,", ""));
    expect(svg).toContain('fill="#1264DA"');
    expect(svg).toMatch(/scale\(([\d.]+)\)/);
    expect(await db.$count(user, eq(user.name, SYSTALINK_DISPLAY_NAME))).toBe(0);
    const [space] = await db.select().from(spaces).where(eq(spaces.slug, "cadev-2026"));
    expect(
      await db.$count(
        spaceMembers,
        and(eq(spaceMembers.spaceId, space!.id), eq(spaceMembers.profileId, SYSTALINK_PROFILE_ID)),
      ),
    ).toBe(1);
  });

  it("passe à Systalink un post CADEV publié auparavant par un compte de démonstration", async () => {
    const ids = new Map(
      (await db.select({ id: profiles.id, handle: profiles.handle }).from(profiles).where(eq(profiles.isDemo, true)))
        .map((row) => [row.handle, row.id] as const),
    );
    const postId = demoUuid("post:cadev-en-bref");
    const coumba = ids.get("coumba-thiam")!;
    await db.update(posts).set({ authorId: coumba, spaceId: null }).where(eq(posts.id, postId));
    await db.update(postAttachments).set({ authorId: coumba }).where(eq(postAttachments.postId, postId));

    expect(await seedCadevPost(db, ids, uploadsDir)).toBe("6 image(s), épinglé");
    expect(await seedCadevPost(db, ids, uploadsDir)).toBe("6 image(s), épinglé");

    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    expect(post!.authorId).toBe(SYSTALINK_PROFILE_ID);
    expect(post!.spaceId).not.toBeNull();
    expect(await db.$count(postAttachments, eq(postAttachments.authorId, coumba))).toBe(0);
    expect(await db.$count(profiles, eq(profiles.handle, "systalink"))).toBe(1);
  });

  it("garde les mêmes visuels d'un passage à l'autre", async () => {
    const ids = new Map(
      (await db.select({ id: profiles.id, handle: profiles.handle }).from(profiles).where(eq(profiles.isDemo, true)))
        .map((row) => [row.handle, row.id] as const),
    );
    const listIds = async () =>
      (
        await db
          .select({ id: postAttachments.id })
          .from(postAttachments)
          .where(eq(postAttachments.postId, demoUuid("post:cadev-en-bref")))
          .orderBy(postAttachments.position)
      ).map((row) => row.id);
    const before = await listIds();
    expect(await seedCadevPost(db, ids, uploadsDir)).toBe("6 image(s), épinglé");
    expect(await listIds()).toEqual(before);
  });

  it("donne à chaque travail une couverture, sa galerie et ses vidéos", async () => {
    for (const plan of DEMO_WORK_MEDIA) {
      const [work] = await db.select({ id: works.id }).from(works).where(eq(works.slug, plan.slug));
      const media = await db
        .select()
        .from(workMedia)
        .where(eq(workMedia.workId, work!.id))
        .orderBy(workMedia.position);
      expect(media.map((item) => item.role)).toEqual([
        "cover",
        ...plan.gallery.map(() => "gallery"),
        ...(plan.video ? ["video"] : []),
      ]);
      const video = media.find((item) => item.kind === "video");
      if (plan.video) expect(video?.mimeType).toBe("video/webm");
    }
  });

  it("amène chaque skill à ses utilisations et à ses avis visés", async () => {
    for (const target of DEMO_SKILL_TARGETS) {
      const [skill] = await db
        .select({ id: skills.id })
        .from(skills)
        .where(eq(skills.slug, target.slug));
      expect(skill, target.slug).toBeDefined();
      const [uses] = await db
        .select({ total: count() })
        .from(assistantInvocations)
        .where(
          and(
            sql`${assistantInvocations.skillIds} @> array[${skill!.id}]::uuid[]`,
            eq(assistantInvocations.status, "done"),
          ),
        );
      expect(uses!.total, target.slug).toBe(target.uses);
      const [ratings] = await db
        .select({ total: count(), average: avg(skillRatings.stars) })
        .from(skillRatings)
        .where(eq(skillRatings.skillId, skill!.id));
      expect(ratings!.total, target.slug).toBe(target.ratings);
      expect(Math.abs(Number(ratings!.average) - target.averageStars)).toBeLessThan(0.1);
    }
  });

  it("n'ajoute aucune utilisation datée d'aujourd'hui, pour ne pas entamer un quota du jour", async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [today] = await db
      .select({ total: count() })
      .from(assistantInvocations)
      .where(
        and(
          gte(assistantInvocations.createdAt, startOfDay),
          eq(assistantInvocations.recorded, false),
        ),
      );
    expect(today!.total).toBe(0);
  });

  it("pose une bannière sur chaque compte de démonstration nommé, et seulement eux", async () => {
    const withBanner = await db
      .select({ isDemo: profiles.isDemo })
      .from(profiles)
      .where(isNotNull(profiles.bannerUrl));
    expect(withBanner).toHaveLength(10);
    expect(withBanner.every((row) => row.isDemo)).toBe(true);
  });

  it("ne rajoute rien au passage suivant", async () => {
    const before = {
      posts: await db.$count(posts),
      attachments: await db.$count(postAttachments),
      media: await db.$count(workMedia),
      invocations: await db.$count(assistantInvocations),
      ratings: await db.$count(skillRatings),
    };
    expect(await seedDemoMedia(db, { uploadsDir })).toEqual({
      status: "done",
      banners: 0,
      posts: 0,
      postImages: 0,
      postImageSizes: 0,
      cadevPost: "6 image(s), épinglé",
      works: 0,
      skillUses: 0,
      skillRatings: 0,
      filesWritten: true,
    });
    expect({
      posts: await db.$count(posts),
      attachments: await db.$count(postAttachments),
      media: await db.$count(workMedia),
      invocations: await db.$count(assistantInvocations),
      ratings: await db.$count(skillRatings),
    }).toEqual(before);
  }, 120_000);

  it("laisse intacts un vrai compte, son post et son skill", async () => {
    const [real] = await db
      .insert(profiles)
      .values({ handle: "vrai-compte", displayName: "Vrai compte", country: "SN" })
      .returning({ id: profiles.id });
    const [realPost] = await db
      .insert(posts)
      .values({
        authorId: real!.id,
        body: `${DEMO_EXISTING_POST_IMAGES[0]!.bodyStart} chez moi aussi.`,
      })
      .returning({ id: posts.id });
    const [realSkill] = await db
      .insert(skills)
      .values({
        authorId: real!.id,
        slug: "skill-d-un-vrai-compte",
        name: "Skill réel",
        description: "Écrit par un vrai compte.",
        content: "Contenu.",
      })
      .returning({ id: skills.id });

    await seedDemoMedia(db, { uploadsDir });
    await seedDemoMedia(db, { uploadsDir });

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, real!.id));
    expect(profile!.bannerUrl).toBeNull();
    expect(await db.$count(postAttachments, eq(postAttachments.postId, realPost!.id))).toBe(0);
    expect(await db.$count(postAttachments, eq(postAttachments.authorId, real!.id))).toBe(0);
    expect(await db.$count(workMedia, eq(workMedia.authorId, real!.id))).toBe(0);
    expect(await db.$count(skillRatings, eq(skillRatings.skillId, realSkill!.id))).toBe(0);
    expect(
      await db.$count(
        assistantInvocations,
        sql`${assistantInvocations.skillIds} @> array[${realSkill!.id}]::uuid[]`,
      ),
    ).toBe(0);
  }, 120_000);

  it("garde un nouveau post sans fichier hors de la base quand UPLOADS_DIR manque", async () => {
    const imagePostIds = DEMO_MEDIA_POSTS.filter((post) => post.image || post.images).map((post) =>
      demoUuid(`post:${post.key}`),
    );
    await db.delete(posts).where(inArray(posts.id, imagePostIds));
    expect(await seedDemoMedia(db, { uploadsDir: undefined })).toMatchObject({
      status: "done",
      posts: 0,
      filesWritten: false,
    });
    expect(await db.$count(posts, inArray(posts.id, imagePostIds))).toBe(0);
  });

  it("ne touche jamais un compte réel qui porterait l'identifiant systalink", async () => {
    await db.delete(profiles).where(eq(profiles.id, SYSTALINK_PROFILE_ID));
    await db
      .insert(user)
      .values({ id: "vrai-systalink", name: "Vrai compte", email: "vrai@test.kemet", emailVerified: true });
    const [real] = await db
      .insert(profiles)
      .values({ userId: "vrai-systalink", handle: "systalink", displayName: "Vrai compte", country: "SN" })
      .returning();
    const ids = new Map(
      (await db.select({ id: profiles.id, handle: profiles.handle }).from(profiles).where(eq(profiles.isDemo, true)))
        .map((row) => [row.handle, row.id] as const),
    );

    expect(await seedCadevPost(db, ids, uploadsDir)).toBe("identifiant systalink pris");

    const [after] = await db.select().from(profiles).where(eq(profiles.id, real!.id));
    expect(after).toEqual(real);
    expect(await db.$count(posts, eq(posts.authorId, real!.id))).toBe(0);
    expect(await db.$count(posts, eq(posts.id, demoUuid("post:cadev-en-bref")))).toBe(0);
  });
});
