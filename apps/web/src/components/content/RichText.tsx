import { lazy, Suspense, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

const MarkdownContent = lazy(() => import("./MarkdownContent.js"));

export interface RichTextProps {
  /** Texte Markdown écrit par un utilisateur ou par l'assistant, traité comme non fiable. */
  source: string;
  className?: string;
  /** Ligne ajoutée sous le texte, par exemple la mention "(modifié)". */
  suffix?: ReactNode;
}

/**
 * Rendu partagé de tout contenu écrit : messages, posts, réponses, skills et
 * réponses de l'assistant. Le HTML brut est affiché comme du texte, les
 * adresses dangereuses (javascript:, data:) sont retirées par react-markdown.
 * En attendant le chargement du moteur Markdown (une seule fois par visite),
 * le texte s'affiche brut, retours à la ligne compris.
 */
export function RichText({ source, className, suffix }: RichTextProps) {
  return (
    <Suspense
      fallback={
        <div className={cn("break-words", className)}>
          <div className="whitespace-pre-wrap">{source}</div>
          {suffix && <div className="mt-0.5">{suffix}</div>}
        </div>
      }
    >
      <MarkdownContent source={source} className={className} suffix={suffix} />
    </Suspense>
  );
}
