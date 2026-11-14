import { navigate } from "../../lib/navigation/navigate.js";
import { useEffect } from "react";
import { SettingsSubPage } from "../../components/settings/SettingsSubPage.js";
import { SuspendedBanner } from "../../components/shell/SuspendedBanner.js";
import { ProfileForm } from "../../components/profile/ProfileForm.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";

export function ProfileSettingsPage() {
  const { status, profile, isSuspended, refresh } = useSession();

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
    if (status === "incomplete") navigate("/completer-profil");
  }, [status]);

  if (status !== "ready" || !profile) return null;

  return (
    <SettingsSubPage title={fr.settings.profileSection}>
      {isSuspended && <SuspendedBanner />}
      <ProfileForm key={profile.id} profile={profile} disabled={isSuspended} onSaved={refresh} />
    </SettingsSubPage>
  );
}
