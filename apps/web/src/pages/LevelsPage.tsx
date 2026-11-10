import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LEVELS, levelForPoints, type Level, type LevelsResponse } from "@kemet/shared";
import { RailPage } from "../components/layout/RailPage.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { LEVEL_LABELS } from "../components/ui/LevelBadge.js";
import { LevelInsignia } from "../components/ui/LevelInsignia.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { getLevels } from "../lib/chat/api.js";
import { cn } from "../lib/cn.js";
import { formatCount } from "../lib/formatCount.js";

// Ses propres points au point près : "2,6k" ne laisse pas suivre sa progression.
const exactNumber = new Intl.NumberFormat("fr-FR");
import { SIGN_UP_PATH } from "../session/signUpInvite.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

const LEVEL_TEXT: Record<Level, string> = {
  apprenti: "text-level-apprenti",
  artisan: "text-level-artisan",
  scribe: "text-level-scribe",
  architecte: "text-level-architecte",
  legende: "text-level-legende",
};

const LEVEL_FILL: Record<Level, string> = {
  apprenti: "bg-level-apprenti",
  artisan: "bg-level-artisan",
  scribe: "bg-level-scribe",
  architecte: "bg-level-architecte",
  legende: "bg-level-legende",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-md font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function YourPosition({ points, levels }: { points: number; levels: LevelsResponse["levels"] }) {
  const level = levelForPoints(points);
  const index = LEVELS.indexOf(level);
  const current = levels[index]!;
  const next = levels[index + 1];
  const progress = next ? (points - current.minPoints) / (next.minPoints - current.minPoints) : 1;

  return (
    <div className="flex items-center gap-4 rounded-card bg-surface p-4">
      <LevelInsignia level={level} className={cn("size-12 shrink-0", LEVEL_TEXT[level])} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-base font-semibold text-text">
          {fr.levels.yourLevel(LEVEL_LABELS[level])}
          <span className="font-normal text-text-2">
            {" "}
            · {fr.levels.yourPoints(exactNumber.format(points))}
          </span>
        </p>
        {next ? (
          <>
            <div
              role="progressbar"
              aria-label={fr.levels.progressLabel(LEVEL_LABELS[next.level])}
              aria-valuemin={current.minPoints}
              aria-valuemax={next.minPoints}
              aria-valuenow={points}
              className="h-2 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={cn("h-full rounded-full", LEVEL_FILL[level])}
                style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }}
              />
            </div>
            <p className="text-sm text-text-2">
              {fr.levels.toNext(
                exactNumber.format(next.minPoints - points),
                LEVEL_LABELS[next.level],
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-text-2">{fr.levels.topLevel}</p>
        )}
      </div>
    </div>
  );
}

function RuleRow({ label, amount }: { label: string; amount: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <span className="text-base text-text-2">{label}</span>
      <span className="shrink-0 font-display text-base font-semibold tabular-nums text-text">
        {amount}
      </span>
    </li>
  );
}

function Rules({ rules }: { rules: LevelsResponse["rules"] }) {
  const [first = 0, second = 0, third = 0] = rules.competitionPodium;
  return (
    <>
      <Section title={fr.levels.helpTitle}>
        <ul className="flex flex-col">
          <RuleRow
            label={fr.levels.rule.replySolution}
            amount={fr.levels.points(rules.replySolution)}
          />
          <RuleRow
            label={fr.levels.rule.feedbackGiven}
            amount={fr.levels.points(rules.feedbackGiven)}
          />
          <RuleRow
            label={fr.levels.rule.assistantSkillHelpful}
            amount={fr.levels.points(rules.assistantSkillHelpful)}
          />
          <RuleRow
            label={fr.levels.rule.projectHelpConfirmed}
            amount={fr.levels.points(rules.projectHelpConfirmed)}
          />
          <RuleRow
            label={fr.levels.rule.competitionParticipation}
            amount={fr.levels.points(rules.competitionParticipation)}
          />
          <RuleRow
            label={fr.levels.rule.competitionPodium(first, second, third)}
            amount={fr.levels.points(first)}
          />
        </ul>
      </Section>
      <Section title={fr.levels.credentialsTitle(formatCount(rules.credentials.cap))}>
        <ul className="flex flex-col">
          <RuleRow
            label={fr.levels.credential.degree}
            amount={fr.levels.points(rules.credentials.degree)}
          />
          <RuleRow
            label={fr.levels.credential.experienceYear}
            amount={fr.levels.points(rules.credentials.experienceYear)}
          />
          <RuleRow
            label={fr.levels.credential.seniorRole}
            amount={fr.levels.points(rules.credentials.seniorRole)}
          />
          <RuleRow
            label={fr.levels.credential.internship}
            amount={fr.levels.points(rules.credentials.internship)}
          />
          <RuleRow
            label={fr.levels.credential.ongoingEducation}
            amount={fr.levels.points(rules.credentials.ongoingEducation)}
          />
        </ul>
      </Section>
      <Section title={fr.levels.regularityTitle}>
        <p className="text-base text-text-2">
          {fr.levels.regularity(
            rules.regularity.perActiveDay,
            rules.regularity.windowDays,
            formatCount(rules.regularity.cap),
          )}
        </p>
      </Section>
    </>
  );
}

function LevelsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-24 w-full" />
      {LEVELS.map((level) => (
        <Skeleton key={level} className="h-16 w-full" />
      ))}
    </div>
  );
}

/** Les cinq niveaux, ce qu'il faut pour chacun, et où en est la personne connectée. */
export function LevelsPage() {
  const { status, profile, points } = useSession();
  const levelsQuery = useQuery({ queryKey: ["levels"], queryFn: getLevels });
  const data = levelsQuery.data ?? null;
  const error = levelsQuery.isError && !levelsQuery.data;
  const load = () => void levelsQuery.refetch();

  const myLevel = status === "ready" && profile ? levelForPoints(points) : null;

  return (
    <RailPage activeMobileTab="moi" className="gap-8 px-4 pt-3 lg:pt-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-bold text-text">{fr.levels.pageTitle}</h1>
        <p className="text-base text-text-2">{fr.levels.principle}</p>
      </div>

      {error ? (
        <ErrorState message={fr.levels.loadError} retry={{ label: fr.chat.retry, onClick: load }} />
      ) : !data ? (
        <LevelsSkeleton />
      ) : (
        <>
          <Section title={fr.levels.yourPositionTitle}>
            {myLevel ? (
              <YourPosition points={points} levels={data.levels} />
            ) : status === "loading" ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-4">
                <p className="text-base text-text-2">{fr.levels.visitorPosition}</p>
                <a
                  href={SIGN_UP_PATH}
                  className="inline-flex h-control items-center rounded-control bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  {fr.levels.visitorCta}
                </a>
              </div>
            )}
          </Section>

          <Section title={fr.levels.levelsTitle}>
            <ol className="flex flex-col">
              {data.levels.map((entry) => (
                <li
                  key={entry.level}
                  aria-current={entry.level === myLevel ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-4 border-b border-border px-2 py-3 last:border-b-0",
                    entry.level === myLevel && "rounded-card border-b-transparent bg-accent-soft",
                  )}
                >
                  <LevelInsignia
                    level={entry.level}
                    className={cn("size-10 shrink-0", LEVEL_TEXT[entry.level])}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 font-display text-md font-semibold text-text">
                      {LEVEL_LABELS[entry.level]}
                      {entry.level === myLevel && (
                        <span className="rounded-full bg-primary px-2 py-0.5 font-sans text-xs font-medium text-white">
                          {fr.levels.youAreHere}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-text-2">
                      {fr.levels.fromPoints(exactNumber.format(entry.minPoints))}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-muted">
                    {fr.levels.memberCount(formatCount(entry.memberCount), entry.memberCount > 1)}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Rules rules={data.rules} />
        </>
      )}
    </RailPage>
  );
}
