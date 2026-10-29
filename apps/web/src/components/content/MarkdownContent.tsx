import type { Element, ElementContent } from "hast";
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";
import { CodeBlock } from "./CodeBlock.js";
import { USER_MENTION_CLASS, remarkHtmlAsText, remarkMentions } from "./remarkPlugins.js";

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkHtmlAsText, remarkMentions];

// Liens écrits par un utilisateur : jamais d'accès à la page d'origine
// (noopener), pas de référent transmis, pas de crédit de référencement.
const EXTERNAL_LINK_REL = "noopener noreferrer nofollow";

function textContent(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textContent).join("");
  return "";
}

function codeLanguage(code: Element): string | undefined {
  const className = code.properties.className;
  const classes = Array.isArray(className) ? className : [];
  const language = classes.find((value) => String(value).startsWith("language-"));
  return language ? String(language).slice("language-".length) : undefined;
}

// Comparer l'origine plutôt que le premier caractère : "//evil.com" commence
// aussi par "/". Une adresse que URL ne sait pas lire est traitée comme
// externe, le cas le plus prudent.
function isSameOrigin(href: string): boolean {
  if (!URL.canParse(href, window.location.origin)) return false;
  return new URL(href, window.location.origin).origin === window.location.origin;
}

const HEADING_CLASS = "mt-3 text-base font-semibold first:mt-0";

const COMPONENTS: Components = {
  p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,
  a: ({ href, className, children }) => {
    if (className?.split(" ").includes(USER_MENTION_CLASS)) {
      return (
        <a
          href={href}
          className="rounded-control bg-accent-soft px-1 font-medium text-link hover:underline"
        >
          {children}
        </a>
      );
    }
    // react-markdown vide l'adresse d'un lien javascript: ou data: : il ne
    // reste que le texte, sans lien qui rouvrirait la page courante.
    if (!href) return <span>{children}</span>;
    const isInternal = href.startsWith("#") || isSameOrigin(href);
    return (
      <a
        href={href}
        className="text-link underline underline-offset-2"
        {...(isInternal ? {} : { target: "_blank", rel: EXTERNAL_LINK_REL })}
      >
        {children}
        {!isInternal && <span className="sr-only"> {fr.content.newTab}</span>}
      </a>
    );
  },
  span: ({ className, children }) => (
    <span
      className={cn(
        className?.split(" ").includes("assistant-mention") &&
          "rounded-control bg-accent-soft px-1 font-medium text-link",
      )}
    >
      {children}
    </span>
  ),
  // Une image Markdown chargerait une adresse choisie par l'auteur chez
  // chaque lecteur (pistage, contenu non modéré) : un lien à la place.
  img: ({ src, alt }) => (
    <a
      href={typeof src === "string" ? src : undefined}
      target="_blank"
      rel={EXTERNAL_LINK_REL}
      className="text-link underline underline-offset-2"
    >
      {alt ? `${fr.content.externalImage} : ${alt}` : fr.content.externalImage}
      <span className="sr-only"> {fr.content.newTab}</span>
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded-control bg-surface-2 px-1 font-mono text-[13px]">{children}</code>
  ),
  pre: ({ node }) => {
    const code = node?.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    );
    if (!code) return null;
    const source = code.children.map(textContent).join("").replace(/\n$/, "");
    return <CodeBlock code={source} languageLabel={codeLanguage(code)} />;
  },
  ul: ({ children }) => <ul className="mt-2 list-disc pl-6 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal pl-6 first:mt-0">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-border-strong pl-3 text-muted first:mt-0">
      {children}
    </blockquote>
  ),
  // Les titres d'un contenu restent sous ceux de la page (h1 du titre, h2 des
  // sections), à la taille du texte : la structure sert aux lecteurs d'écran
  // sans ajouter une taille de plus à l'écran.
  h1: ({ children }) => <h3 className={HEADING_CLASS}>{children}</h3>,
  h2: ({ children }) => <h3 className={HEADING_CLASS}>{children}</h3>,
  h3: ({ children }) => <h4 className={HEADING_CLASS}>{children}</h4>,
  h4: ({ children }) => <h4 className={HEADING_CLASS}>{children}</h4>,
  h5: ({ children }) => <h4 className={HEADING_CLASS}>{children}</h4>,
  h6: ({ children }) => <h4 className={HEADING_CLASS}>{children}</h4>,
  table: ({ children }) => (
    // Zone qui défile : focusable pour la parcourir au clavier.
    <div
      tabIndex={0}
      role="region"
      aria-label={fr.content.table}
      className="mt-2 overflow-x-auto first:mt-0"
    >
      <table className="border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  hr: () => <hr className="my-3 border-border" />,
};

export interface MarkdownContentProps {
  source: string;
  className?: string;
  suffix?: ReactNode;
}

/** Chargé à la demande par RichText : react-markdown et ses extensions ne pèsent pas sur le premier affichage. */
export default function MarkdownContent({ source, className, suffix }: MarkdownContentProps) {
  return (
    <div className={cn("break-words", className)}>
      <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {source}
      </Markdown>
      {suffix && <div className="mt-0.5">{suffix}</div>}
    </div>
  );
}
