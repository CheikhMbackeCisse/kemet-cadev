import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { RailPage } from "../components/layout/RailPage.js";
import { fr } from "../i18n/fr.js";

type MeasuredTest = (typeof fr.security.measured)[number];
type SecurityTest = (typeof fr.security.tests)[number];
type Protection = (typeof fr.security.protections)[number];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-md font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function RerunLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-base text-link hover:underline"
    >
      {fr.security.rerun}
      <ExternalLink aria-hidden className="size-3.5" />
    </a>
  );
}

function MeasuredRow({ test }: { test: MeasuredTest }) {
  return (
    <li className="flex items-start justify-between gap-6 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-base font-semibold text-text">{test.tool}</p>
        <p className="text-base text-text-2">{test.detail}</p>
        <RerunLink href={test.href} />
      </div>
      <p className="shrink-0 text-lg font-bold text-text">{test.grade}</p>
    </li>
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
        {test.href && <RerunLink href={test.href} />}
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

function ProtectionRow({ protection }: { protection: Protection }) {
  return (
    <li className="flex flex-col gap-0.5 py-2.5">
      <p className="text-base text-text-2">{protection.text}</p>
      <code className="break-all font-mono text-sm text-subtle">{protection.file}</code>
    </li>
  );
}

/** Lisible sans compte, comme la page de confidentialité. */
export function SecurityPage() {
  return (
    <RailPage activeSection="securite" activeMobileTab="" className="gap-6 px-4 pt-3 lg:pt-6">
      <h1 className="text-lg font-bold text-text">{fr.security.title}</h1>

      <Section title={fr.security.measuredTitle}>
        <p className="text-base text-text-2">{fr.security.measuredDate}</p>
        <ul aria-label={fr.security.measuredTitle} className="flex flex-col divide-y divide-border">
          {fr.security.measured.map((test) => (
            <MeasuredRow key={test.id} test={test} />
          ))}
        </ul>
        <p className="text-base text-text-2">{fr.security.measuredScope}</p>
      </Section>

      <Section title={fr.security.protectionsTitle}>
        <p className="text-base text-text-2">{fr.security.protectionsIntro}</p>
        <ul aria-label={fr.security.protectionsTitle} className="flex flex-col divide-y divide-border">
          {fr.security.protections.map((protection) => (
            <ProtectionRow key={protection.file + protection.text} protection={protection} />
          ))}
        </ul>
      </Section>

      <Section title={fr.security.testsTitle}>
        <ul aria-label={fr.security.testsTitle} className="flex flex-col divide-y divide-border">
          {fr.security.tests.map((test) => (
            <TestRow key={test.id} test={test} />
          ))}
        </ul>
      </Section>

      <Section title={fr.security.remainingTitle}>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-text-2">
          {fr.security.remaining.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
    </RailPage>
  );
}
