import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { ArrivalLayout } from "../arrival/ArrivalLayout.js";
import { Button } from "../ui/Button.js";
import { fr } from "../../i18n/fr.js";

export interface IntroStepLayoutProps {
  /** Rang de la question, à partir de 1. */
  current: number;
  total: number;
  title: string;
  onBack: () => void;
  onSkip: () => void;
  onSubmit: () => void;
  submitLabel: string;
  /** Pourquoi le bouton principal est désactivé : lu par un lecteur d'écran. */
  disabledReason?: string | null;
  width?: "md" | "lg";
  children: ReactNode;
}

/**
 * Une question avant l'inscription, sur la carte en verre dépoli : Retour et
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
  width = "md",
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
    if (!disabledReason) onSubmit();
  }

  const linkClass =
    "-mx-2 inline-flex min-h-control-mobile items-center rounded-control px-2 text-sm font-medium text-auth-text-muted hover:text-auth-text md:min-h-control";

  return (
    <ArrivalLayout motion="calm" width={width}>
      <form aria-labelledby={titleId} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="-my-2 flex items-center justify-between">
          <button type="button" onClick={onBack} className={linkClass}>
            {fr.onboarding.back}
          </button>
          <button type="button" onClick={onSkip} className={linkClass}>
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

        <Button
          type="submit"
          variant="inverse"
          aria-disabled={Boolean(disabledReason) || undefined}
          aria-describedby={disabledReason ? reasonId : undefined}
          className={disabledReason ? "w-full cursor-not-allowed opacity-50" : "w-full"}
        >
          {submitLabel}
        </Button>
        {disabledReason && (
          <p id={reasonId} className="sr-only">
            {disabledReason}
          </p>
        )}
      </form>
    </ArrivalLayout>
  );
}
