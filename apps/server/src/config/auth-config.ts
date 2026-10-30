export interface AuthConfig {
  githubEnabled: boolean;
  googleEnabled: boolean;
  linkedinEnabled: boolean;
}

// docker-compose transmet une chaîne vide pour une variable non définie.
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    githubEnabled: Boolean(env.GITHUB_CLIENT_ID) && Boolean(env.GITHUB_CLIENT_SECRET),
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID) && Boolean(env.GOOGLE_CLIENT_SECRET),
    linkedinEnabled: Boolean(env.LINKEDIN_CLIENT_ID) && Boolean(env.LINKEDIN_CLIENT_SECRET),
  };
}
