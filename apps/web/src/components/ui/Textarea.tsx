import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn.js";

export type TextareaVariant = "composer" | "form";

/** Lignes visibles au départ et avant que le champ ne défile, par variante. */
export const TEXTAREA_ROWS: Record<TextareaVariant, { min: number; max: number }> = {
  composer: { min: 1, max: 6 },
  form: { min: 3, max: 10 },
};

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
  /** `composer` pour un salon ou un fil, `form` pour un formulaire. */
  variant?: TextareaVariant;
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function measure(node: HTMLTextAreaElement) {
  const style = window.getComputedStyle(node);
  const lineHeight = px(style.lineHeight) || px(style.fontSize) * 1.5;
  const borders = px(style.borderTopWidth) + px(style.borderBottomWidth);
  const padding = px(style.paddingTop) + px(style.paddingBottom);
  return { lineHeight, borders, padding };
}

/**
 * Champ qui grandit avec le texte et redescend quand on efface, comme un
 * composeur de messagerie. Au-delà du nombre maximal de lignes, il défile à
 * l'intérieur. Jamais de poignée de redimensionnement : elle figeait le champ
 * à une taille choisie à la main.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, variant = "form", onInput, value, ...props },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const { min: minRows, max: maxRows } = TEXTAREA_ROWS[variant];

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const resize = useCallback(() => {
    const node = innerRef.current;
    if (!node) return;
    const { lineHeight, borders, padding } = measure(node);
    const minHeight = minRows * lineHeight + padding + borders;
    const maxHeight = maxRows * lineHeight + padding + borders;
    // Remise à zéro avant mesure : sans elle, scrollHeight ne redescend jamais.
    node.style.height = "auto";
    // box-sizing: border-box : la hauteur posée compte les bordures, que
    // scrollHeight ne contient pas.
    const contentHeight = node.scrollHeight + borders;
    node.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    node.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [minRows, maxRows]);

  // useLayoutEffect plutôt que useEffect : évite une frame à la mauvaise
  // hauteur quand le champ est rempli par le code (édition, brouillon).
  useLayoutEffect(resize, [resize, value]);

  return (
    <textarea
      ref={setRefs}
      data-field=""
      rows={minRows}
      value={value}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      className={cn(
        "w-full resize-none rounded-control border border-border-strong bg-bg px-3 py-2 text-sm max-md:text-md text-text placeholder:text-subtle",
        "focus:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "composer" && "py-[7px] leading-5",
        className,
      )}
      {...props}
    />
  );
});
