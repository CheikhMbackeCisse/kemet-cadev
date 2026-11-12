import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { RailPage } from "../components/layout/RailPage.js";
import { fr } from "../i18n/fr.js";

type SecurityTest = (typeof fr.security.tests)[number];

function Section({ title, children }: { title: string; children: ReactNode }) {
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

function TestRow({ test }: { test: SecurityTest }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-base font-semibold text-text">{test.tool}</p>
        <p className="text-base text-text-2">{test.checks}</p>
        {test.command && (
          <code className="break-all font-mono text-sm text-subtle">{test.command}</code>
        )}
        {test.href && (
          <a
            href={test.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-base text-link hover:underline"
          >
            {fr.security.rerun}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        )}
      </div>
      <div className="flex shrink-0 flex-col sm:items-end sm:text-right">
        <p className={test.result ? "text-base font-semibold text-text" : "text-base text-subtle"}>
          {test.result ?? fr.security.notMeasured}
        </p>
        {test.date && <p className="text-sm text-subtle">{test.date}</p>}
      </div>
    </li>
  );
}

/** Lisible sans compte, comme la page de confidentialité. */
export function SecurityPage() {
  return (
    <RailPage activeSection="securite" activeMobileTab="" className="gap-6 px-4 pt-3 lg:pt-6">
      <h1 className="text-lg font-bold text-text">{fr.security.title}</h1>

      <Section title={fr.security.testsTitle}>
        <ul className="flex flex-col divide-y divide-border">
          {fr.security.tests.map((test) => (
            <TestRow key={test.id} test={test} />
          ))}
        </ul>
      </Section>

      <Section title={fr.security.protectionsTitle}>
        <List items={fr.security.protections} />
      </Section>

      <Section title={fr.security.remainingTitle}>
        <List items={fr.security.remaining} />
      </Section>
    </RailPage>
  );
}
