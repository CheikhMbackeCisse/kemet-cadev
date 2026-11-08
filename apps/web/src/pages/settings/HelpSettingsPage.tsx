import { useEffect, useState } from "react";
import { SettingsSubPage } from "../../components/settings/SettingsSubPage.js";
import { getPrivacyContact } from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";

// Commit de l'image construite par la CI ; "dev" en local.
const VERSION = (import.meta.env.VITE_KEMET_VERSION as string | undefined)?.slice(0, 7) ?? "dev";

export function HelpSettingsPage() {
  const [contact, setContact] = useState<{ name: string; email: string } | null | undefined>(undefined);

  useEffect(() => {
    getPrivacyContact()
      .then((result) => setContact(result.contact))
      .catch(() => setContact(null));
  }, []);

  return (
    <SettingsSubPage title={fr.settings.helpSection}>
      <section className="flex max-w-xl flex-col gap-2">
        <h2 className="text-md font-semibold text-text">{fr.settings.aboutTitle}</h2>
        <p className="text-base text-text-2">{fr.settings.aboutText}</p>
      </section>
      <dl className="flex max-w-xl flex-col divide-y divide-border rounded-card bg-surface">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-text-2">{fr.settings.versionLabel}</dt>
          <dd className="font-mono text-sm text-text">{VERSION}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-text-2">{fr.settings.contactLabel}</dt>
          <dd className="min-w-0 truncate text-sm text-text">
            {contact === undefined ? null : contact ? (
              <a href={`mailto:${contact.email}`} className="text-link hover:underline">
                {contact.email}
              </a>
            ) : (
              <span className="text-subtle">{fr.settings.contactMissing}</span>
            )}
          </dd>
        </div>
      </dl>
      <a href="/confidentialite" className="w-fit text-sm text-link hover:underline">
        {fr.settings.privacyLink}
      </a>
    </SettingsSubPage>
  );
}
