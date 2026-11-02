// Barèmes de docs/CONTEXTE.md, lus par le serveur et par le seed : un compte
// de démonstration gagne ses points exactement comme un vrai compte.
export const POINTS_POST_REPLY_SOLUTION = 10;
export const POINTS_POST_FEEDBACK_GIVEN = 10;
export const POINTS_ASSISTANT_SKILL_HELPFUL = 5;
export const POINTS_PROJECT_HELP_CONFIRMED = 20;
export const POINTS_COMPETITION_PARTICIPATION = 10;
// 1er, 2e, 3e. Un rang au-delà n'est pas récompensé.
export const POINTS_COMPETITION_VICTORY_BY_RANK: ReadonlyArray<number> = [200, 100, 50];

// Pondération arbitraire, expliquée dans docs/adr/0013-competitions.md.
const JURY_WEIGHT = 0.7;
const VOTE_WEIGHT = 0.3;

/**
 * Score officiel d'une soumission sur 100 : jury (sur 20) et part des voix
 * ramenés à la même échelle avant d'être pondérés.
 */
export function competitionOfficialScore(juryAverage: number | null, voteCount: number, totalVotes: number): number {
  const juryShare = juryAverage !== null ? juryAverage / 20 : 0;
  const voteShare = totalVotes > 0 ? voteCount / totalVotes : 0;
  return (JURY_WEIGHT * juryShare + VOTE_WEIGHT * voteShare) * 100;
}

/** Barème du parcours vérifié (docs/CONTEXTE.md). Un élément seulement déclaré ne rapporte rien. */
export const CREDENTIAL_POINTS = {
  degree: 150,
  experienceYear: 100,
  seniorRole: 300,
  internship: 30,
  ongoingEducation: 20,
} as const;

// Lu dans l'intitulé du poste, jamais dans le nom de l'employeur : on ne
// classe pas les entreprises par prestige.
const SENIOR_ROLE_PATTERN = /\b(senior|lead|principal|staff|head|cto|architecte|directeur technique|directrice technique)\b/i;

export interface CredentialForPoints {
  type: "job" | "education" | "internship";
  title: string;
  startDate: string;
  endDate: string | null;
}

function fullYearsBetween(start: Date, end: Date): number {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  const anniversary = Date.UTC(end.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  if (end.getTime() < anniversary) years -= 1;
  return Math.max(0, years);
}

/**
 * Points d'un élément de parcours au moment où il est vérifié. Les années
 * d'un poste encore occupé sont comptées jusqu'à cette date.
 */
export function credentialPoints(credential: CredentialForPoints, verifiedAt: Date): number {
  const end = credential.endDate ? new Date(credential.endDate) : null;
  switch (credential.type) {
    case "internship":
      return CREDENTIAL_POINTS.internship;
    case "education":
      return end && end <= verifiedAt ? CREDENTIAL_POINTS.degree : CREDENTIAL_POINTS.ongoingEducation;
    case "job": {
      const until = end && end < verifiedAt ? end : verifiedAt;
      const years = fullYearsBetween(new Date(credential.startDate), until);
      const seniority = SENIOR_ROLE_PATTERN.test(credential.title) ? CREDENTIAL_POINTS.seniorRole : 0;
      return years * CREDENTIAL_POINTS.experienceYear + seniority;
    }
  }
}
