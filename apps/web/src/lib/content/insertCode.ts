export interface TextEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export const INLINE_CODE = "inline";

/** Langages proposés par le bouton Code, dans l'ordre du menu. "text" n'a pas de nom propre : son libellé vit dans `fr.ts`. */
export const CODE_LANGUAGES = [
  { value: "text", label: null },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "dart", label: "Dart" },
  { value: "php", label: "PHP" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
] as const;

/**
 * Entoure la sélection d'un bloc de code (ou de code en ligne pour
 * `INLINE_CODE`), ou insère un bloc vide avec le curseur à l'intérieur.
 */
export function insertCode(edit: TextEdit, language: string): TextEdit {
  const { value, selectionStart, selectionEnd } = edit;
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);

  if (language === INLINE_CODE) {
    // Une sélection qui contient déjà un accent grave demande une clôture double.
    const fence = selected.includes("`") ? "`` " : "`";
    const closing = fence === "`" ? "`" : " ``";
    const start = before.length + fence.length;
    return {
      value: `${before}${fence}${selected}${closing}${after}`,
      selectionStart: start,
      selectionEnd: start + selected.length,
    };
  }

  const fence = selected.includes("```") ? "````" : "```";
  const lead = before === "" || before.endsWith("\n") ? "" : "\n";
  const trail = after === "" || after.startsWith("\n") ? "" : "\n";
  const opening = `${lead}${fence}${language}\n`;
  const start = before.length + opening.length;
  return {
    value: `${before}${opening}${selected}\n${fence}${trail}${after}`,
    selectionStart: start,
    selectionEnd: start + selected.length,
  };
}
