import { navigate } from "../../lib/navigation/navigate.js";
import { ArrowLeft } from "lucide-react";
import { useRef, type FormEvent, type ReactNode } from "react";
import { IconButton } from "../ui/IconButton.js";
import type { ButtonVariant } from "../ui/Button.js";
import { SubmitButton } from "../ui/SubmitButton.js";
import { RailPage } from "./RailPage.js";
import { focusFirstInvalidField } from "../../lib/forms.js";
import { fr } from "../../i18n/fr.js";

export interface FormPageProps {
  title: string;
  /** Section de la barre d'activité à marquer comme active (voir `RAIL_NAV`). */
  activeSection?: string;
  /** Destination du bouton Annuler, et du retour quand il n'y a pas d'historique. */
  backHref: string;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  submitting?: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
}

/**
 * Gabarit des formulaires de creation, en page plutot qu'en boite de
 * dialogue, ou le bouton d'envoi sortait de l'ecran sur un telephone.
 */
export function FormPage({
  title,
  activeSection,
  backHref,
  submitLabel,
  submitVariant,
  submitting,
  submitDisabled,
  error,
  onSubmit,
  children,
}: FormPageProps) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <RailPage activeSection={activeSection}>
      <div className="flex items-center gap-3">
        <IconButton
          aria-label={fr.common.back}
          onClick={() => (window.history.length > 1 ? window.history.back() : navigate(backHref))}
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </IconButton>
        <h1 className="text-lg font-bold text-text">{title}</h1>
      </div>

      <form
        ref={formRef}
        noValidate
        className="flex max-w-xl flex-col gap-4"
        onSubmit={(event) => {
          onSubmit(event);
          focusFirstInvalidField(formRef.current);
        }}
      >
        {children}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {/* Sur téléphone, le bouton reste visible au-dessus des onglets, même
            en haut d'un long formulaire. */}
        <div className="max-md:sticky max-md:bottom-[calc(45px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] max-md:z-10 max-md:-mx-4 max-md:border-t max-md:border-border max-md:bg-bg max-md:px-4 max-md:py-2">
          <SubmitButton
            label={submitLabel}
            variant={submitVariant}
            loading={submitting}
            disabled={submitDisabled}
            secondary={
              <a
                href={backHref}
                className="inline-flex h-control max-md:h-control-mobile items-center justify-center rounded-control px-4 text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text"
              >
                {fr.common.cancel}
              </a>
            }
          />
        </div>
      </form>
    </RailPage>
  );
}
