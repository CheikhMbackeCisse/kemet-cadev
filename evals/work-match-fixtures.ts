import type { MatchCandidate } from "../apps/server/src/ai/work-matcher.js";
import type { ProfileRow, WorkRow } from "../apps/server/src/api/repositories/works.js";

export interface FixtureWork {
  title: string;
  type: WorkRow["type"];
  summary: string;
  tags: string[];
  stack: string[];
  handle: string;
}

// Les évals ne touchent pas la base : seuls les champs lus par
// renderCandidates et parseModelSuggestions comptent.
export function toCandidates(works: FixtureWork[]): MatchCandidate[] {
  return works.map((work, index) => ({
    key: `t${index + 1}`,
    work: {
      id: `travail-${index + 1}`,
      slug: `travail-${index + 1}`,
      title: work.title,
      type: work.type,
      summary: work.summary,
      tags: work.tags,
      stack: work.stack,
      year: 2024,
    } as WorkRow,
    people: [
      { id: `profil-${work.handle}`, handle: work.handle, displayName: work.handle } as ProfileRow,
    ],
  }));
}
