import type { Db } from "../client.js";
import { follows } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { chunk } from "./chunk.js";
import { seededShuffle } from "./filler-profiles.js";

// Nombre d'abonnés tirés du bassin de profils de remplissage, par compte
// nommé. Samuel Mwangi (quinze ans d'expérience, architecte reconnu) est
// le compte le plus suivi de la plateforme.
const FOLLOWER_COUNTS: Record<keyof DemoAccountIds, number> = {
  aminaDiallo: 640,
  kwameAsante: 310,
  fatimaBenali: 980,
  chidiOkafor: 1850,
  zaneleMokoena: 420,
  yassineTrabelsi: 260,
  aissatouToure: 710,
  samuelMwangi: 5200,
  nadiaHassan: 1420,
  jeanMarcMukendi: 180,
};

const FOLLOW_CHUNK_SIZE = 10000;

export async function createCommunityFollows(db: Db, accountIds: DemoAccountIds, fillerProfileIds: string[]): Promise<void> {
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
