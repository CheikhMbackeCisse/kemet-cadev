import { ArrowLeft } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { IconButton } from "../ui/IconButton.js";
import { SubmitButton } from "../ui/SubmitButton.js";
import { RailPage } from "./RailPage.js";
import { fr } from "../../i18n/fr.js";

export interface FormPageProps {
  title: string;
  subtitle?: string;
  /** Section de la barre d'activité à marquer comme active (voir `RAIL_NAV`). */
  activeSection?: string;
  /** Destination du bouton Annuler, et du retour quand il n'y a pas d'historique. */
  backHref: string;
  submitLabel: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  /** Pourquoi l'envoi est bloqué, affiché à côté du bouton tant qu'il l'est. */
  submitDisabledReason?: string | null;
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
  subtitle,
  activeSection,
  backHref,
  submitLabel,
  submitting,
  submitDisabled,
  submitDisabledReason,
  error,
  onSubmit,
  children,
}: FormPageProps) {
  return (
    <RailPage activeSection={activeSection}>
      <div className="flex items-center gap-3">
        <IconButton
          aria-label={fr.common.back}
          onClick={() =>
            window.history.length > 1 ? window.history.back() : (window.location.href = backHref)
          }
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </IconButton>
        <div>
          <h1 className="text-lg font-bold text-text">{title}</h1>
          {subtitle && <p className="text-sm text-subtle">{subtitle}</p>}
        </div>
      </div>

      <form className="flex max-w-xl flex-col gap-4" onSubmit={onSubmit}>
        {children}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <SubmitButton
          label={submitLabel}
          loading={submitting}
          disabled={submitDisabled}
          disabledReason={submitDisabledReason}
          secondary={
            <a
              href={backHref}
              className="inline-flex h-control max-md:h-control-mobile items-center justify-center rounded-control px-4 text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text"
            >
              {fr.common.cancel}
            </a>
          }
        />
      </form>
    </RailPage>
  );
}
