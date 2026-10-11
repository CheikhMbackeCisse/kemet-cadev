export interface ProjectsConfig {
  datacloudReferralUrl: string | null;
}

/**
 * docker-compose substitue une chaîne vide, pas une variable absente, pour
 * tout `${VAR}` non défini dans `.env` (voir infra/docker-compose.yml) :
 * même piège que `loadAttachmentLimits` (apps/server/src/storage/config.ts).
 */
export function loadProjectsConfig(env: NodeJS.ProcessEnv = process.env): ProjectsConfig {
  const value = env.DATACLOUD_REFERRAL_URL;
  return { datacloudReferralUrl: value && value.length > 0 ? value : null };
}
