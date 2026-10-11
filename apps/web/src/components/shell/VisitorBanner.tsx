import { fr } from "../../i18n/fr.js";

export function VisitorBanner() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-card border border-border-strong p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <p className="text-sm text-text-2">{fr.auth.visitorBanner}</p>
      <a href="/connexion" className="shrink-0 text-sm font-medium text-link hover:underline">
        {fr.auth.visitorBannerCta}
      </a>
    </div>
  );
}
