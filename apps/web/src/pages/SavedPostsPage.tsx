import { useEffect } from "react";
import { navigate } from "../lib/navigation/navigate.js";
import { SavedPostsList } from "../components/feed/SavedPostsList.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

/** Adresse directe des enregistrés : le même contenu que l'onglet de Moi. */
export function SavedPostsPage() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
    if (status === "incomplete") navigate("/completer-profil");
  }, [status]);

  return (
    <ReadingPage
      activeSection="moi"
      header={<h1 className="text-lg font-bold text-text">{fr.saved.title}</h1>}
      className="pb-[calc(76px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-8"
    >
      <SavedPostsList />
    </ReadingPage>
  );
}
