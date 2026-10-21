export interface AuthConfig {
  githubEnabled: boolean;
  googleEnabled: boolean;
  linkedinEnabled: boolean;
}

/**
 * docker-compose substitue une chaîne vide, pas une variable absente, pour
 * tout `${VAR}` non défini dans `.env` (voir infra/docker-compose.yml) :
 * même piège que `loadProjectsConfig` (apps/server/src/config/projects-config.ts).
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    githubEnabled: Boolean(env.GITHUB_CLIENT_ID) && Boolean(env.GITHUB_CLIENT_SECRET),
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID) && Boolean(env.GOOGLE_CLIENT_SECRET),
    linkedinEnabled: Boolean(env.LINKEDIN_CLIENT_ID) && Boolean(env.LINKEDIN_CLIENT_SECRET),
  };
}
