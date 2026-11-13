import { useEffect, useState } from "react";
import { getSiteConfig } from "./chat/api.js";

export interface SiteConfig {
  demoContentNotice: boolean;
}

// Une requête par chargement de l'app, partagée par tous les écrans.
let pending: Promise<SiteConfig> | null = null;

function loadSiteConfig(): Promise<SiteConfig> {
  pending ??= getSiteConfig().catch(() => {
    pending = null;
    return { demoContentNotice: false };
  });
  return pending;
}

/** Réglages publics du site ; `null` tant qu'ils ne sont pas chargés. */
export function useSiteConfig(): SiteConfig | null {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  useEffect(() => {
    let active = true;
    void loadSiteConfig().then((value) => active && setConfig(value));
    return () => {
      active = false;
    };
  }, []);
  return config;
}
