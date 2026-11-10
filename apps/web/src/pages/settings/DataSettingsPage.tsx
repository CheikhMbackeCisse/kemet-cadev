import { navigate } from "../../lib/navigation/navigate.js";
import { useCallback, useEffect, useState } from "react";
import type { ProfileSummary } from "@kemet/shared";
import { SettingsSubPage } from "../../components/settings/SettingsSubPage.js";
import { Avatar } from "../../components/ui/Avatar.js";
import { Button } from "../../components/ui/Button.js";
import { ErrorState } from "../../components/ui/ErrorState.js";
import { Skeleton } from "../../components/ui/Skeleton.js";
import { useToast } from "../../components/ui/Toast.js";
import { listBlockedUsers, unblockUser } from "../../lib/chat/api.js";
import { useAccountExport } from "../../lib/useAccountExport.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";

export function DataSettingsPage() {
  const { status } = useSession();
  const toast = useToast();
  const { exporting, exportAccount } = useAccountExport();
  const [blocked, setBlocked] = useState<ProfileSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
    if (status === "incomplete") navigate("/completer-profil");
  }, [status]);

  const load = useCallback(() => {
    setError(false);
    setBlocked(null);
    listBlockedUsers()
      .then((result) => setBlocked(result.items))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  async function unblock(person: ProfileSummary) {
    try {
      await unblockUser(person.handle);
      setBlocked((current) => current?.filter((item) => item.id !== person.id) ?? null);
    } catch {
      toast.show(fr.settings.unblockError, "danger");
    }
  }

  if (status !== "ready") return null;

  return (
    <SettingsSubPage title={fr.settings.dataSection}>
      <section className="flex max-w-xl flex-col gap-3">
        <h2 className="text-md font-semibold text-text">{fr.settings.blockedSection}</h2>
        {error ? (
          <ErrorState
            message={fr.settings.blockedError}
            retry={{ label: fr.chat.retry, onClick: load }}
          />
        ) : blocked === null ? (
          <Skeleton className="h-12 w-full" />
        ) : blocked.length === 0 ? (
          <p className="text-base text-text-2">{fr.settings.blockedEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {blocked.map((person) => (
              <li key={person.id} className="flex items-center gap-3 py-2">
                <Avatar name={person.displayName} src={person.avatarUrl ?? undefined} size={32} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base text-text">{person.displayName}</span>
                  <span className="truncate text-base text-subtle">@{person.handle}</span>
                </span>
                <Button
                  variant="secondary"
                  aria-label={fr.settings.unblockLabel(person.displayName)}
                  onClick={() => void unblock(person)}
                >
                  {fr.settings.unblock}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex max-w-xl flex-col items-start gap-1">
        <Button variant="secondary" loading={exporting} onClick={() => void exportAccount()}>
          {fr.settings.exportLink}
        </Button>
      </section>

      <a href="/confidentialite" className="w-fit text-base text-link hover:underline">
        {fr.settings.privacyLink}
      </a>

      <section className="flex max-w-xl flex-col gap-1" aria-labelledby="delete-account-title">
        <h2 id="delete-account-title" className="text-md font-semibold text-text">
          {fr.settings.deleteSection}
        </h2>
        <a
          href="/parametres/supprimer-mon-compte"
          className="-mx-2 inline-flex h-control w-fit items-center rounded-control px-2 text-base font-medium text-danger hover:underline max-md:h-control-mobile"
        >
          {fr.settings.deleteLink}
        </a>
      </section>
    </SettingsSubPage>
  );
}
