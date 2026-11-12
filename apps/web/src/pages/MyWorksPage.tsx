import { Plus } from "lucide-react";
import { useEffect } from "react";
import { navigate } from "../lib/navigation/navigate.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { HeaderActionLink } from "../components/ui/HeaderActionLink.js";
import { ProfileWorks } from "../components/works/ProfileWorks.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

/** "Mes travaux" : seulement ses travaux, en cartes, sans l'en-tête du profil. */
export function MyWorksPage() {
  const { status, profile } = useSession();

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
    if (status === "incomplete") navigate("/completer-profil");
  }, [status]);

  return (
    <ReadingPage
      activeSection="moi"
      header={
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-text">{fr.moi.myWorks}</h1>
          <HeaderActionLink href="/travaux/nouveau" icon={Plus}>
            {fr.works.create}
          </HeaderActionLink>
        </div>
      }
    >
      {profile && (
        <ProfileWorks handle={profile.handle} isOwnProfile reloadKey={0} layout="cards" />
      )}
    </ReadingPage>
  );
}
