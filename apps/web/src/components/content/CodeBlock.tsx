import { Check, Copy } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { ThemedToken } from "shiki/core";
import { fr } from "../../i18n/fr.js";
import { whenIdle } from "../../lib/idle.js";
import { useNearViewport } from "../../lib/useNearViewport.js";
import { MAX_HIGHLIGHTED_CODE_LENGTH, highlight, resolveLanguage } from "./highlighter.js";

const COPIED_FEEDBACK_MS = 2000;
// Une réponse de l'assistant arrive morceau par morceau : attendre que le
// code cesse de changer évite de le recolorer à chaque morceau.
const HIGHLIGHT_DEBOUNCE_MS = 300;
const HIGHLIGHT_IDLE_TIMEOUT_MS = 2000;

export interface CodeBlockProps {
  code: string;
  /** Étiquette écrite après les trois accents graves, telle quelle. */
  languageLabel?: string;
}

export function CodeBlock({ code, languageLabel }: CodeBlockProps) {
  const language = resolveLanguage(languageLabel);
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const label = languageLabel || fr.content.plainText;
  const blockRef = useRef<HTMLDivElement>(null);
  // Shiki, la grammaire et la coloration (plusieurs centaines de millisecondes
  // sur un téléphone d'entrée de gamme) n'arrivent qu'avec un bloc à l'écran :
  // un fil chargé en 3G ne paie pas pour les blocs plus bas.
  const nearViewport = useNearViewport(blockRef);

  useEffect(() => {
    setTokens(null);
    if (!nearViewport || !language || code.length > MAX_HIGHLIGHTED_CODE_LENGTH) return;
    let cancelled = false;
    let cancelIdle = () => {};
    const timer = setTimeout(() => {
      cancelIdle = whenIdle(() => {
        // En cas d'échec du chargement de la grammaire, le code reste affiché
        // en texte brut : la coloration est un confort, pas le contenu.
        highlight(code, language).then(
          (result) => !cancelled && setTokens(result),
          () => undefined,
        );
      }, HIGHLIGHT_IDLE_TIMEOUT_MS);
    }, HIGHLIGHT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelIdle();
    };
  }, [code, language, nearViewport]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  // Le presse-papiers est refusé hors HTTPS ou sans permission : le dire,
  // plutôt qu'un bouton qui ne fait rien.
  function handleCopy() {
    navigator.clipboard.writeText(code).then(
      () => setCopyState("copied"),
      () => setCopyState("failed"),
    );
  }

  const copyText =
    copyState === "copied"
      ? fr.content.copied
      : copyState === "failed"
        ? fr.content.copyFailed
        : fr.content.copy;

  return (
    <div
      ref={blockRef}
      className="my-2 overflow-hidden rounded-card border border-border bg-surface-2"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-1">
        <span className="font-mono text-xs text-muted">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={fr.content.copyCode(label)}
          className="inline-flex h-control-compact items-center gap-1 rounded-control px-2 text-xs font-medium text-text-2 hover:bg-surface max-md:h-control-mobile"
        >
          {copyState === "copied" ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copyText}
        </button>
        <span className="sr-only" aria-live="polite">
          {copyState === "idle" ? "" : copyText}
        </span>
      </div>
      {/* Zone qui défile : focusable pour la parcourir au clavier. */}
      <pre
        tabIndex={0}
        role="region"
        aria-label={fr.content.codeRegion(label)}
        className="code-scroll overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-text"
      >
        <code>
          {tokens
            ? tokens.map((line, lineIndex) => (
                <span key={lineIndex} className="block">
                  {line.map((token, tokenIndex) => (
                    <span
                      key={tokenIndex}
                      className="shiki-token"
                      style={token.htmlStyle as CSSProperties}
                    >
                      {token.content}
                    </span>
                  ))}
                  {line.length === 0 && "\n"}
                </span>
              ))
            : code}
        </code>
      </pre>
    </div>
  );
}
