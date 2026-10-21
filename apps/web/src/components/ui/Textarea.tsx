import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn.js";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Hauteur maximale en pixels avant que le champ ne defile. */
  maxHeight?: number;
}

/**
 * Champ qui grandit avec le texte et redescend quand on efface, comme un
 * composeur de messagerie. La poignee de redimensionnement du navigateur est
 * retiree : elle laissait un champ figee a une taille choisie a la main, et se
 * voyait comme un artefact dans le coin.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, maxHeight = 200, onInput, value, ...props },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

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
    // Remise a zero avant mesure : sans elle, scrollHeight ne redescend jamais.
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, maxHeight)}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight]);

  // useLayoutEffect plutot que useEffect : evite une frame a la mauvaise
  // hauteur quand le champ est rempli par le code (edition, brouillon).
  useLayoutEffect(resize, [resize, value]);

  return (
    <textarea
      ref={setRefs}
      rows={1}
      value={value}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      className={cn(
        "w-full resize-none rounded-control border border-border-strong bg-bg px-3 py-2 text-sm text-text placeholder:text-subtle",
        "focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
