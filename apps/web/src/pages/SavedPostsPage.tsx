import { useEffect } from "react";
import { navigate } from "../lib/navigation/navigate.js";
import { useSession } from "../session/SessionProvider.js";

/** Ancienne adresse des enregistrés, devenus un onglet de son propre profil. */
export function SavedPostsPage() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "visitor") navigate("/connexion", { replace: true });
    if (status === "incomplete") navigate("/completer-profil", { replace: true });
    if (status === "ready") navigate("/moi?onglet=enregistres", { replace: true });
  }, [status]);

  return null;
}
