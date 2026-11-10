import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { ArrivalAction } from "../arrival/ArrivalAction.js";
import { ArrivalLayout } from "../arrival/ArrivalLayout.js";
import { Button } from "../ui/Button.js";
import { fr } from "../../i18n/fr.js";

export interface IntroStepLayoutProps {
  /** Rang de la question, à partir de 1. */
  current: number;
  total: number;
  title: string;
  /** Absent sur le premier écran après l'inscription : rien avant lui. */
  onBack: (() => void) | null;
  onSkip: () => void;
  onSubmit: () => void;
  submitLabel: string;
  /** Pourquoi le bouton principal est désactivé : lu par un lecteur d'écran. */
  disabledReason?: string | null;
  /** Raison écrite sous le bouton plutôt que lue seulement par un lecteur d'écran. */
  showDisabledReason?: boolean;
  width?: "md" | "lg";
  /** Enregistrement en cours : boutons bloqués, bouton principal en attente. */
  submitting?: boolean;
  error?: string | null;
  children: ReactNode;
}

/**
 * Une question du parcours d'arrivée (avant l'inscription, puis l'onboarding), sur la carte en verre dépoli : Retour et
 * Passer, une barre de progression sans texte, le titre, les choix.
 */
export function IntroStepLayout({
  current,
  total,
  title,
  onBack,
  onSkip,
  onSubmit,
  submitLabel,
  disabledReason,
  showDisabledReason = false,
  width = "md",
  submitting = false,
  error,
  children,
}: IntroStepLayoutProps) {
  const titleId = useId();
  const reasonId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Le bouton cliqué disparaît avec la question : le focus passe au nouveau
  // titre plutôt que de retomber sur la page. Pas au premier affichage.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [current]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!disabledReason && !submitting) onSubmit();
  }

  const linkClass =
    "-mx-2 inline-flex min-h-control-mobile items-center rounded-control px-2 text-sm font-medium text-auth-text-muted hover:text-auth-text md:min-h-control";

  return (
    <ArrivalLayout motion="calm" width={width}>
      <form
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        className="relative flex flex-col gap-4"
      >
        <div className="-my-2 flex items-center justify-between">
          {onBack ? (
            <button type="button" onClick={onBack} disabled={submitting} className={linkClass}>
              {fr.onboarding.back}
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onSkip} disabled={submitting} className={linkClass}>
            {fr.onboarding.skip}
          </button>
        </div>
        <div
          role="progressbar"
          aria-label={fr.onboarding.progress(current, total)}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={current}
          className="h-1 w-full overflow-hidden rounded-full bg-white/20"
        >
          <div
            className="h-full rounded-full bg-auth-text"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>

        <h1
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className="text-lg font-bold focus:outline-none"
        >
          {title}
        </h1>

        <div className="flex flex-col gap-3">{children}</div>

        <ArrivalAction>
          {error && (
            <p role="alert" className="text-sm font-medium text-auth-danger">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="inverse"
            loading={submitting}
            aria-disabled={Boolean(disabledReason) || undefined}
            aria-describedby={disabledReason ? reasonId : undefined}
            className={disabledReason ? "w-full cursor-not-allowed opacity-50" : "w-full"}
          >
            {submitLabel}
          </Button>
          {disabledReason && (
            <p
              id={reasonId}
              className={
                showDisabledReason ? "text-center text-sm text-auth-text-muted" : "sr-only"
              }
            >
              {disabledReason}
            </p>
          )}
        </ArrivalAction>
      </form>
    </ArrivalLayout>
  );
}
