import { Play } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";

/**
 * Bouton posé dans le champ (code, pièce jointe) : toute la hauteur
 * intérieure de la pilule, pour que l'icône tombe sur la ligne du texte.
 */
export const COMPOSER_TOOL_CLASS =
  "inline-flex h-[42px] w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:text-text disabled:cursor-not-allowed disabled:opacity-50";

/** Taille unique des icônes du champ de message. */
export const COMPOSER_ICON_CLASS = "size-[22px]";

/** Bouton rond de 44 px, hors du champ (Kocc à gauche, envoi ou micro à droite). */
export const COMPOSER_ROUND_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed";

export interface ComposerBarProps {
  /** Avant le champ : le bouton Kocc. */
  leading?: ReactNode;
  /** Le `Textarea` en variante `composer`. */
  field: ReactNode;
  /** Dans le champ, à droite : code, puis pièce jointe. */
  tools?: ReactNode;
  /** Après le champ : envoi, ou micro tant que rien n'est écrit. */
  action: ReactNode;
  /** Posés dans le même conteneur relatif : suggestions de mention, barre d'enregistrement. */
  children?: ReactNode;
}

/**
 * Champ de message commun aux salons, aux fils, aux réponses sous un post et
 * à la messagerie. Les éléments s'alignent sur le bas : quand le texte
 * grandit, les boutons restent sur la dernière ligne, comme dans une
 * messagerie de téléphone.
 */
export function ComposerBar({ leading, field, tools, action, children }: ComposerBarProps) {
  return (
    <div className="relative flex items-end gap-2">
      {children}
      {leading}
      <div className="flex min-h-11 min-w-0 flex-1 items-end rounded-[22px] border border-border-strong bg-bg pl-4 pr-0.5 transition-colors duration-150 focus-within:border-primary">
        {field}
        {tools}
      </div>
      {action}
    </div>
  );
}

export interface ComposerSendButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /** Vrai dès qu'il y a quelque chose à envoyer : le bouton passe en couleur. */
  ready: boolean;
  label?: string;
}

export const ComposerSendButton = forwardRef<HTMLButtonElement, ComposerSendButtonProps>(
  function ComposerSendButton({ ready, label = fr.chat.send, className, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        // Garde le focus, et le clavier du téléphone ouvert, dans le champ.
        onPointerDown={(event) => event.preventDefault()}
        disabled={disabled || !ready}
        className={cn(
          COMPOSER_ROUND_CLASS,
          ready && !disabled
            ? "bg-primary text-white hover:bg-primary-hover"
            : "bg-surface-2 text-subtle",
          className,
        )}
        {...props}
      >
        {/* Le triangle est décalé d'un pixel : centré sur sa boîte, il paraît tiré vers la gauche. */}
        <Play
          className={cn(COMPOSER_ICON_CLASS, "translate-x-px")}
          fill="currentColor"
          aria-hidden="true"
        />
      </button>
    );
  },
);
