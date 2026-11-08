import { useEffect, useState } from "react";
import { RailPage } from "../components/layout/RailPage.js";
import { fr } from "../i18n/fr.js";
import { getPrivacyContact } from "../lib/chat/api.js";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-md font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-text-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Lisible sans compte : on lit cette page avant de s'inscrire. */
export function PrivacyPage() {
  const [contact, setContact] = useState<{ name: string; email: string } | null>(null);

  // Sans contact configuré, ou si la requête échoue, la ligne reste masquée :
  // le reste de la page ne dépend pas du serveur.
  useEffect(() => {
    let active = true;
    getPrivacyContact()
      .then((response) => {
        if (active) setContact(response.contact);
      })
      .catch(() => {
        if (active) setContact(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <RailPage
      activeSection="confidentialite"
      activeMobileTab=""
      className="gap-6 px-4 pt-3 lg:pt-6"
    >
      <div>
        <h1 className="text-lg font-bold text-text">{fr.privacy.title}</h1>
        <p className="text-base text-subtle">
          {fr.privacy.subtitle} {fr.privacy.updatedAt}
        </p>
      </div>

      <Section title={fr.privacy.keptTitle}>
        <List items={fr.privacy.kept} />
      </Section>

      <Section title={fr.privacy.privateMessagesTitle}>
        <List items={fr.privacy.privateMessages} />
      </Section>

      <Section title={fr.privacy.assistantTitle}>
        <List items={fr.privacy.assistant} />
      </Section>

      <Section title={fr.privacy.retentionTitle}>
        <List items={fr.privacy.retention} />
      </Section>

      <Section title={fr.privacy.exportTitle}>
        <p className="text-base text-text-2">
          {fr.privacy.export}{" "}
          <a href="/parametres" className="text-link hover:underline">
            {fr.privacy.exportLink}
          </a>
        </p>
      </Section>

      <Section title={fr.privacy.deletionTitle}>
        <List items={fr.privacy.deletion} />
        <p className="text-base text-text-2">
          <a href="/parametres/supprimer-mon-compte" className="text-link hover:underline">
            {fr.privacy.deletionLink}
          </a>
        </p>
      </Section>

      <Section title={fr.privacy.lawTitle}>
        <p className="text-base text-text-2">{fr.privacy.law}</p>
      </Section>

      {contact && (
        <Section title={fr.privacy.contactTitle}>
          <p className="text-base text-text-2">
            {fr.privacy.contact} {contact.name},{" "}
            <a href={`mailto:${contact.email}`} className="text-link hover:underline">
              {contact.email}
            </a>
          </p>
        </Section>
      )}
    </RailPage>
  );
}
