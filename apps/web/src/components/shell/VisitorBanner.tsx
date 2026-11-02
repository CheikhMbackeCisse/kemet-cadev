import { fr } from "../../i18n/fr.js";

export function VisitorBanner() {
  return (
    <div className="hidden items-center justify-between gap-3 rounded-card bg-surface p-4 lg:flex">
      <p className="text-sm text-text-2">{fr.auth.visitorBanner}</p>
      <a href="/connexion" className="shrink-0 text-sm font-medium text-link hover:underline">
        {fr.auth.visitorBannerCta}
      </a>
    </div>
  );
}
