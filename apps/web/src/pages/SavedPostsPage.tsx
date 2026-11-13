import { useEffect } from "react";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { navigate } from "../lib/navigation/navigate.js";
import { useSession } from "../session/SessionProvider.js";

/**
 * Ancienne adresse des enregistrés, devenus un onglet de son propre profil :
 * Moi sur téléphone, le profil (où mène le compte de la barre) sur bureau.
 */
export function SavedPostsPage() {
  const { status, profile } = useSession();

  useEffect(() => {
    if (status === "visitor") navigate("/connexion", { replace: true });
    if (status === "incomplete") navigate("/completer-profil", { replace: true });
    if (status !== "ready" || !profile) return;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    navigate(
      desktop
        ? `/u/${encodeURIComponent(profile.handle)}?onglet=enregistres`
        : "/moi?onglet=enregistres",
      { replace: true },
    );
  }, [status, profile]);

  return (
    <ReadingPage activeSection="moi" activeMobileTab="moi" header={null}>
      <Skeleton className="h-40 w-full" />
    </ReadingPage>
  );
}
