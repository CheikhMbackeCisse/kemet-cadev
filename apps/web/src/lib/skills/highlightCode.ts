export type CodeTokenKind = "keyword" | "string" | "comment" | "text";

export interface CodeToken {
  kind: CodeTokenKind;
  text: string;
}

// Coloration volontairement grossière : la couverture d'une carte n'a besoin
// que de deux ou trois couleurs, pas de Shiki dans une liste.
const KEYWORDS = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "def", "else", "export",
  "fn", "for", "from", "func", "function", "if", "import", "in", "interface", "let", "new",
  "return", "select", "struct", "type", "var", "where", "while", "with", "yield",
  "SELECT", "FROM", "WHERE", "CREATE", "TABLE", "INSERT", "INTO", "UPDATE", "INDEX", "ON",
  "FROM", "RUN", "COPY", "WORKDIR", "CMD",
]);

const TOKEN = new RegExp(
  [
    "(#.*$|//.*$|--\\s.*$)",
    "(\"(?:[^\"\\\\]|\\\\.)*\"?|'(?:[^'\\\\]|\\\\.)*'?|`[^`]*`?)",
    "([A-Za-z_]\\w*)",
    "([^A-Za-z_\"'`#/-]+|.)",
  ].join("|"),
  "g",
);

/** Découpe une ligne en mots-clés, chaînes, commentaire et reste. */
export function highlightLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  for (const match of line.matchAll(TOKEN)) {
    const [text, comment, string, word] = match;
    const kind: CodeTokenKind = comment
      ? "comment"
      : string
        ? "string"
        : word && KEYWORDS.has(word)
          ? "keyword"
          : "text";
    const last = tokens.at(-1);
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ kind, text });
  }
  return tokens;
}
