export interface ProjectsConfig {
  datacloudReferralUrl: string | null;
}

// docker-compose transmet une chaîne vide pour une variable non définie.
export function loadProjectsConfig(env: NodeJS.ProcessEnv = process.env): ProjectsConfig {
  const value = env.DATACLOUD_REFERRAL_URL;
  return { datacloudReferralUrl: value && value.length > 0 ? value : null };
}
