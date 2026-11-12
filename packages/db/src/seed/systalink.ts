import { eq } from "drizzle-orm";
import { SYSTALINK_HANDLE } from "@kemet/shared";
import type { DbOrTx } from "../client.js";
import { profiles, spaceMembers } from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";

export const SYSTALINK_PROFILE_ID = demoUuid("profile:systalink");

/** Nom tel qu'il est écrit dans le logo de Systalink. */
export const SYSTALINK_DISPLAY_NAME = "Systalink";

// Les deux tracés du symbole, repris à l'identique de l'icône publiée sur le
// site de Systalink (icon0.svg, cadre 31 x 45), avec leur accord : source et
// usage dans THIRD_PARTY_LICENSES.md. Jamais redessinés.
const SYMBOL_PATHS = [
  "M9.64798 30.9929H0V16.8608C6.58406 10.2767 10.2762 6.58411 16.8602 0H30.9922V9.64805H9.64798V30.9929Z",
  "M21.352 13.0928H31V27.2253C24.4159 33.8094 20.7234 37.5015 14.1394 44.0856H0.00738525V34.4376H21.352V13.0928Z",
];
const SYMBOL_COLOR = "#1264DA";
const SYMBOL_WIDTH = 31;
const SYMBOL_HEIGHT = 45;

/**
 * Photo de profil : le symbole sur fond blanc, en vectoriel pour rester net à
 * toute taille, mis à l'échelle sans changer ses proportions et centré.
 */
export function systalinkAvatarDataUri(): string {
  const size = 64;
  const scale = 36 / SYMBOL_HEIGHT;
  const x = (size - SYMBOL_WIDTH * scale) / 2;
  const y = (size - SYMBOL_HEIGHT * scale) / 2;
  const paths = SYMBOL_PATHS.map((d) => `<path d="${d}" fill="${SYMBOL_COLOR}"/>`).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="#FFFFFF"/>` +
    `<g transform="translate(${x} ${y}) scale(${scale})">${paths}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Profil de Systalink, sans compte de connexion : aucune ligne `user`, donc
 * aucun mot de passe, aucune session possible. Ni bio, ni bannière, ni pays.
 * Relançable. Renvoie null si l'identifiant est déjà porté par un autre
 * profil (un compte réel n'est jamais touché).
 */
export async function ensureSystalinkProfile(db: DbOrTx): Promise<string | null> {
  const [holder] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.handle, SYSTALINK_HANDLE));
  if (holder && holder.id !== SYSTALINK_PROFILE_ID) return null;

  const fields = {
    userId: null,
    displayName: SYSTALINK_DISPLAY_NAME,
    country: "",
    bio: null,
    bannerUrl: null,
    avatarUrl: systalinkAvatarDataUri(),
    openToOpportunities: false,
    helpsBeginners: false,
    isDemo: true,
    isFiller: false,
    isPlatformAdmin: false,
  };
  if (holder) {
    await db.update(profiles).set(fields).where(eq(profiles.id, SYSTALINK_PROFILE_ID));
  } else {
    await db.insert(profiles).values({
      id: SYSTALINK_PROFILE_ID,
      handle: SYSTALINK_HANDLE,
      onboardingCompletedAt: new Date(),
      ...fields,
    });
  }
  return SYSTALINK_PROFILE_ID;
}

/** Systalink publie dans l'espace : il en est membre, sans rôle d'administration. */
export async function ensureSystalinkMembership(db: DbOrTx, spaceId: string): Promise<void> {
  await db
    .insert(spaceMembers)
    .values({ spaceId, profileId: SYSTALINK_PROFILE_ID, role: "member" })
    .onConflictDoNothing();
}
