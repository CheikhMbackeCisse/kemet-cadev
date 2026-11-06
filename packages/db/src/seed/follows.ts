import type { DbOrTx } from "../client.js";
import { follows } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { chunk } from "./chunk.js";
import { seededShuffle } from "./filler-profiles.js";

// Nombre d'abonnés tirés du bassin de profils de remplissage, par compte
// nommé. Kiprono Langat (quinze ans d'expérience, architecte reconnu) est
// le compte le plus suivi de la plateforme.
const FOLLOWER_COUNTS: Record<keyof DemoAccountIds, number> = {
  coumbaThiam: 640,
  eboQuansah: 310,
  lynaBouzid: 980,
  dapoOyelaran: 1850,
  kgomotsoMahlangu: 420,
  skanderJaziri: 260,
  ahouKouadio: 710,
  kipronoLangat: 5200,
  ghizlaneAmrani: 1420,
  heritierKabeya: 180,
};

const FOLLOW_CHUNK_SIZE = 10000;

export async function createCommunityFollows(db: DbOrTx, accountIds: DemoAccountIds, fillerProfileIds: string[]): Promise<void> {
  const entries = Object.entries(FOLLOWER_COUNTS) as [keyof DemoAccountIds, number][];
  for (const [key, count] of entries) {
    const followeeId = accountIds[key];
    const followerIds = seededShuffle(fillerProfileIds, `followers-${key}`).slice(0, count);
    const rows = followerIds.map((followerId) => ({ followerId, followeeId }));
    for (const batch of chunk(rows, FOLLOW_CHUNK_SIZE)) {
      await db.insert(follows).values(batch);
    }
  }
}
