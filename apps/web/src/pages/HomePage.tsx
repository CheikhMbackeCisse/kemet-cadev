import { useEffect } from "react";
import { Button } from "../components/ui/Button.js";
import { ThemeToggle } from "../theme/ThemeToggle.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

export function HomePage() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "ready") window.location.href = "/fil";
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  if (status === "loading" || status === "ready" || status === "incomplete") return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex max-w-reading flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold text-text">{fr.auth.homeVisitorTitle}</h1>
        <p className="text-sm text-text-2">{fr.auth.homeVisitorPitch}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/salons"
          className="inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
        >
          {fr.auth.homeVisitorBrowseSpaces}
        </a>
        <a
          href="/fil"
          className="inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
        >
          {fr.auth.homeVisitorBrowseFeed}
        </a>
      </div>
      <div className="flex items-center gap-3">
        <a href="/connexion" className="text-sm text-link hover:underline">
          {fr.auth.signInCta}
        </a>
        <Button onClick={() => (window.location.href = "/inscription")}>{fr.auth.homeVisitorSignup}</Button>
      </div>
      <a href="/pro" className="text-sm text-link hover:underline">
        {fr.auth.homeVisitorDiscoverPro}
      </a>
    </main>
  );
}
