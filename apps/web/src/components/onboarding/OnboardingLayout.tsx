import { useId, type FormEvent, type ReactNode } from "react";
import { KemetWordmark } from "../ui/KemetWordmark.js";
import { Button } from "../ui/Button.js";
import { fr } from "../../i18n/fr.js";

export interface OnboardingLayoutProps {
  /** Rang de l'écran, à partir de 1. */
  current: number;
  total: number;
  title: string;
  subtitle: string;
  onBack: (() => void) | null;
  onSkip: () => void;
  onSubmit: () => void;
  submitLabel: string;
  /** Pourquoi le bouton principal est désactivé, affiché à côté de lui. */
  disabledReason?: string | null;
  submitting?: boolean;
  error?: string | null;
  children: ReactNode;
}

/**
 * Un écran d'onboarding : une seule question, la progression, Retour et
 * Passer. Une page ordinaire, sans le fond de marque des écrans de compte.
 * Sur mobile, le bouton principal reste fixé en bas, au-dessus du clavier.
 */
export function OnboardingLayout({
  current,
  total,
  title,
  subtitle,
  onBack,
  onSkip,
  onSubmit,
  submitLabel,
  disabledReason,
  submitting = false,
  error,
  children,
}: OnboardingLayoutProps) {
  const titleId = useId();
  const reasonId = useId();
  const reason = disabledReason && !submitting ? disabledReason : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!disabledReason && !submitting) onSubmit();
  }

  return (
    <div className="flex min-h-viewport w-full flex-col bg-bg">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-4 pt-4 sm:pt-8">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="-ml-2 inline-flex min-h-control-mobile items-center rounded-control px-2 text-sm font-medium text-text-2 hover:text-text md:min-h-control"
          >
            {fr.onboarding.back}
          </button>
        ) : (
          <KemetWordmark className="h-6 w-auto" />
        )}
        <button
          type="button"
          onClick={onSkip}
          disabled={submitting}
          className="-mr-2 inline-flex min-h-control-mobile items-center rounded-control px-2 text-sm font-medium text-link hover:underline md:min-h-control"
        >
          {fr.onboarding.skip}
        </button>
      </header>

      <form
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-32 pt-6 md:pb-12"
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-subtle">{fr.onboarding.progress(current, total)}</p>
          <div
            role="progressbar"
            aria-label={fr.onboarding.progress(current, total)}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current}
            className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${(current / total) * 100}%` }} />
          </div>
        </div>

        <h1 id={titleId} className="mt-8 text-xl font-bold text-text">
          {title}
        </h1>
        <p className="mt-1 text-sm text-text-2">{subtitle}</p>

        <div className="mt-6 flex flex-col gap-3">{children}</div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:static md:mt-8 md:border-0 md:p-0">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-2 md:flex-row md:items-center">
            <Button
              type="submit"
              loading={submitting}
              disabled={Boolean(disabledReason)}
              aria-describedby={reason ? reasonId : undefined}
              className="w-full md:w-auto"
            >
              {submitLabel}
            </Button>
            {reason && (
              <p id={reasonId} className="text-center text-xs text-subtle md:text-left">
                {reason}
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
