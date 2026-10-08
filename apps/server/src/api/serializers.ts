import type { credentials, profiles } from "@kemet/db";
import type { Credential, Profile, ProfileSummary } from "@kemet/shared";

type ProfileRow = typeof profiles.$inferSelect;
type CredentialRow = typeof credentials.$inferSelect;

export function serializeProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    country: row.country as Profile["country"],
    title: row.title,
    bio: row.bio,
    stack: row.stack,
    githubUrl: row.githubUrl,
    openToOpportunities: row.openToOpportunities,
    isDemo: row.isDemo,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeProfileSummary(row: ProfileRow): ProfileSummary {
  const profile = serializeProfile(row);
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    country: profile.country,
    title: profile.title,
    isDemo: profile.isDemo,
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
