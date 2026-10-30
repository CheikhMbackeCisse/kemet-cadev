import { hash } from "@node-rs/argon2";
import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { follows, profiles, user } from "../schema/index.js";
import { createDemoAccounts, DEMO_ACCOUNTS, type DemoAccountIds } from "./accounts.js";
import { createCadevSpace } from "./chat-content.js";
import { createCommunitySpaces } from "./community.js";
import { createDemoCompetitions } from "./competitions.js";
import { createFeedContent } from "./feed.js";
import { generateFillerProfiles, insertFillerProfiles } from "./filler-profiles.js";
import { createCommunityFollows } from "./follows.js";
import { createDemoProjects } from "./projects.js";
import { createDemoSkills } from "./skills.js";

/** Mot de passe public des comptes de démonstration, pour que le jury puisse s'y connecter. */
export const DEMO_PASSWORD = "demonstration";

// Assez grand pour qu'un espace vitrine affiche un nombre de membres à cinq
// chiffres, et pour fournir abonnés et votes sans épuiser le bassin.
export const DEFAULT_FILLER_PROFILE_COUNT = 12_300;

export type DemoSeedResult = { status: "created"; fillerProfileCount: number } | { status: "already-present" };

async function countExistingDemoAccounts(db: DbOrTx): Promise<number> {
  const emails = DEMO_ACCOUNTS.map((account) => account.email);
  const rows = await db.select({ id: user.id }).from(user).where(inArray(user.email, emails));
  return rows.length;
}

async function followAllNamedAccounts(db: DbOrTx, ids: DemoAccountIds): Promise<void> {
  const otherKeys = (Object.keys(ids) as (keyof DemoAccountIds)[]).filter((key) => key !== "aminaDiallo");
  await db.insert(follows).values(otherKeys.map((key) => ({ followerId: ids[key], followeeId: ids.aminaDiallo })));
}

async function assertNoDemoAdmin(db: DbOrTx): Promise<void> {
  const admins = await db
    .select({ handle: profiles.handle })
    .from(profiles)
    .where(and(eq(profiles.isDemo, true), eq(profiles.isPlatformAdmin, true)));
  if (admins.length > 0) {
    throw new Error(
      `Compte de démonstration administrateur (${admins.map((a) => a.handle).join(", ")}) : son mot de passe est public, retirer ce rôle en base avant de continuer.`,
    );
  }
}

/**
 * Crée le jeu de données de démonstration dans une seule transaction, ou ne
 * fait rien s'il est déjà présent. Refuse de laisser un compte de démo administrateur.
 */
export async function seedDemoDataset(
  db: DbOrTx,
  options: { fillerProfileCount?: number } = {},
): Promise<DemoSeedResult> {
  const fillerProfileCount = options.fillerProfileCount ?? DEFAULT_FILLER_PROFILE_COUNT;

  return db.transaction(async (tx) => {
    const existing = await countExistingDemoAccounts(tx);
    if (existing === DEMO_ACCOUNTS.length) {
      // Une base remplie par une ancienne version du seed peut encore porter un admin de démo.
      await assertNoDemoAdmin(tx);
      return { status: "already-present" };
    }
    if (existing > 0) {
      throw new Error(
        `${existing} comptes de démonstration sur ${DEMO_ACCOUNTS.length} existent déjà : base dans un état partiel, à vérifier à la main.`,
      );
    }

    const ids = await createDemoAccounts(tx, await hash(DEMO_PASSWORD));
    await followAllNamedAccounts(tx, ids);
    const fillerProfileIds = await insertFillerProfiles(tx, generateFillerProfiles(fillerProfileCount));
    await createDemoSkills(tx, ids);
    await createCadevSpace(tx, ids);
    await createCommunitySpaces(tx, ids, fillerProfileIds);
    await createCommunityFollows(tx, ids, fillerProfileIds);
    await createFeedContent(tx, ids);
    const projectIds = await createDemoProjects(tx, ids);
    await createDemoCompetitions(tx, ids, projectIds, fillerProfileIds);

    await assertNoDemoAdmin(tx);
    return { status: "created", fillerProfileCount: fillerProfileIds.length };
  });
}
