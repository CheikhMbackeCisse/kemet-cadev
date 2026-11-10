import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

interface FieldControlProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export interface FormFieldProps {
  label: ReactNode;
  /** Affichée sous le champ, reliée à lui pour les lecteurs d'écran. */
  error?: string | null;
  children: ReactElement<FieldControlProps>;
  /** "inverse" sur la carte en verre du parcours d'arrivée. */
  tone?: "default" | "inverse";
  className?: string;
}

/** Libellé, champ, et son erreur juste dessous. */
export function FormField({ label, error, children, tone = "default", className }: FormFieldProps) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const errorId = `${id}-error`;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className={tone === "inverse" ? "text-sm text-auth-text" : "text-sm text-text-2"}
      >
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : children.props["aria-describedby"],
      })}
      {error && (
        <p
          id={errorId}
          className={tone === "inverse" ? "text-sm text-auth-danger" : "text-sm text-danger"}
        >
          {error}
        </p>
      )}
    </div>
  );
}
