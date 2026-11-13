import type { credentials, profiles } from "@kemet/db";
import {
  ASSISTANT_MENTION_HANDLE,
  ASSISTANT_NAME,
  isLevelAtLeast,
  OPEN_TO_OPPORTUNITIES_MIN_LEVEL,
  type Credential,
  type Level,
  type Profile,
  type ProfileSummary,
} from "@kemet/shared";
import { KEMET_ASSISTANT_PROFILE_ID } from "../chat/kemet-assistant.js";

type ProfileRow = typeof profiles.$inferSelect;
type CredentialRow = typeof credentials.$inferSelect;

// Le profil système garde "kemet" en base (migration 0003) ; l'interface
// ne montre que Kocc, sans bio ni titre, sans réécrire la ligne.
function presentProfileRow(row: ProfileRow): ProfileRow {
  if (row.id !== KEMET_ASSISTANT_PROFILE_ID) return row;
  return {
    ...row,
    handle: ASSISTANT_MENTION_HANDLE,
    displayName: ASSISTANT_NAME,
    bio: null,
    title: null,
  };
}

/**
 * Niveau affiché à côté d'un nom. Une organisation et le profil de
 * l'assistant n'en ont pas : ni insigne, ni points, ni progression.
 */
export function shownLevel(profile: Pick<ProfileRow, "id" | "kind">, level: Level): Level | null {
  if (profile.kind !== "person" || profile.id === KEMET_ASSISTANT_PROFILE_ID) return null;
  return level;
}

export function serializeProfile(stored: ProfileRow, computedLevel: Level): Profile {
  const row = presentProfileRow(stored);
  const level = shownLevel(row, computedLevel);
  return {
    id: row.id,
    handle: row.handle,
    kind: row.kind,
    organizationType: row.organizationType,
    displayName: row.displayName,
    country: row.country as Profile["country"],
    role: row.role,
    workMode: row.workMode,
    organization: row.organization,
    title: row.title,
    bio: row.bio,
    stack: row.stack,
    githubUrl: row.githubUrl,
    gitlabUrl: row.gitlabUrl,
    linkedinUrl: row.linkedinUrl,
    portfolioUrl: row.portfolioUrl,
    websiteUrl: row.websiteUrl,
    avatarUrl: row.avatarUrl,
    bannerUrl: row.bannerUrl,
    // Masqué aussi à la lecture : un total revu à la baisse le retire.
    openToOpportunities:
      level !== null &&
      row.openToOpportunities &&
      isLevelAtLeast(level, OPEN_TO_OPPORTUNITIES_MIN_LEVEL),
    helpsBeginners: row.helpsBeginners,
    isDemo: row.isDemo,
    level,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeProfileSummary(stored: ProfileRow): ProfileSummary {
  const row = presentProfileRow(stored);
  return {
    id: row.id,
    handle: row.handle,
    kind: row.kind,
    displayName: row.displayName,
    country: row.country as ProfileSummary["country"],
    title: row.title,
    avatarUrl: row.avatarUrl,
    helpsBeginners: row.helpsBeginners,
    isDemo: row.isDemo,
  };
}

export function serializeCredential(row: CredentialRow): Credential {
  return {
    id: row.id,
    type: row.type,
    organization: row.organization,
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    verificationMethod: row.verificationMethod,
  };
}
