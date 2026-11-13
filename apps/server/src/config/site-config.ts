export interface SiteConfig {
  /** Affiche la mention "Données de démonstration" dans l'app web. */
  demoContentNotice: boolean;
}

export function loadSiteConfig(env: NodeJS.ProcessEnv = process.env): SiteConfig {
  return { demoContentNotice: env.DEMO_CONTENT_NOTICE?.trim().toLowerCase() === "true" };
}
