import { useCallback, useEffect, useState } from "react";
import { SettingsSubPage } from "../../components/settings/SettingsSubPage.js";
import { Skeleton } from "../../components/ui/Skeleton.js";
import { getPrivacyContact } from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";

// Commit de l'image construite par la CI ; "dev" en local.
const VERSION = (import.meta.env.VITE_KEMET_VERSION as string | undefined)?.slice(0, 7) ?? "dev";

export function HelpSettingsPage() {
  // undefined pendant le chargement, null quand le serveur n'en a pas.
  const [contact, setContact] = useState<{ name: string; email: string } | null | undefined>(undefined);
  const [contactError, setContactError] = useState(false);

  const loadContact = useCallback(() => {
    setContactError(false);
    setContact(undefined);
    getPrivacyContact()
      .then((result) => setContact(result.contact))
      .catch(() => setContactError(true));
  }, []);

  useEffect(loadContact, [loadContact]);

  return (
    <SettingsSubPage title={fr.settings.helpSection}>
      <section className="flex max-w-xl flex-col gap-2">
        <h2 className="text-md font-semibold text-text">{fr.settings.aboutTitle}</h2>
        <p className="text-base text-text-2">{fr.settings.aboutText}</p>
      </section>
      <dl className="flex max-w-xl flex-col divide-y divide-border border-y border-border">
        <div className="flex items-center justify-between gap-4 px-2 py-3">
          <dt className="text-base text-text-2">{fr.settings.versionLabel}</dt>
          <dd className="font-mono text-base text-text">{VERSION}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-2 py-3">
          <dt className="text-base text-text-2">{fr.settings.contactLabel}</dt>
          <dd className="min-w-0 truncate text-base text-text">
            {contactError ? (
              <span className="text-subtle">
                {fr.settings.contactError}{" "}
                <button type="button" onClick={loadContact} className="font-medium text-link hover:underline">
                  {fr.chat.retry}
                </button>
              </span>
            ) : contact === undefined ? (
              <Skeleton className="h-4 w-40" />
            ) : contact ? (
              <a href={`mailto:${contact.email}`} className="text-link hover:underline">
                {contact.email}
              </a>
            ) : (
              <span className="text-subtle">{fr.settings.contactMissing}</span>
            )}
          </dd>
        </div>
      </dl>
      <a href="/confidentialite" className="w-fit text-base text-link hover:underline">
        {fr.settings.privacyLink}
      </a>
    </SettingsSubPage>
  );
}
