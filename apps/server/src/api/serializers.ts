import type { credentials, profiles } from "@kemet/db";
import type { Credential, Level, Profile, ProfileSummary } from "@kemet/shared";

type ProfileRow = typeof profiles.$inferSelect;
type CredentialRow = typeof credentials.$inferSelect;

export function serializeProfile(row: ProfileRow, level: Level): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    country: row.country as Profile["country"],
    role: row.role,
    title: row.title,
    bio: row.bio,
    stack: row.stack,
    githubUrl: row.githubUrl,
    avatarUrl: row.avatarUrl,
    openToOpportunities: row.openToOpportunities,
    isDemo: row.isDemo,
    level,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeProfileSummary(row: ProfileRow): ProfileSummary {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    country: row.country as ProfileSummary["country"],
    title: row.title,
    avatarUrl: row.avatarUrl,
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
