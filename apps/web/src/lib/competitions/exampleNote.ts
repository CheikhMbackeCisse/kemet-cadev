// Le seed place cette mention en italique en tête de la description des
// compétitions d'exemple. L'interface la remplace par une pastille "Exemple".
const EXAMPLE_NOTE = /^\s*\*Compétition d'exemple[^*]*\*\s*/;

export function splitExampleNote(description: string): { isExample: boolean; body: string } {
  const match = EXAMPLE_NOTE.exec(description);
  if (!match) return { isExample: false, body: description };
  return { isExample: true, body: description.slice(match[0].length) };
}
