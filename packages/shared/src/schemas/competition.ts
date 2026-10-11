import { z } from "zod";
import { httpUrlSchema } from "./url.js";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const competitionStatusSchema = z.enum(["pending_review", "rejected", "published"]);
export type CompetitionStatus = z.infer<typeof competitionStatusSchema>;

// Dérivée des trois échéances, jamais stockée : voir
// apps/server/src/api/repositories/competitions.ts (computeCompetitionPhase).
export const competitionPhaseSchema = z.enum(["registration", "submission", "voting", "closed"]);
export type CompetitionPhase = z.infer<typeof competitionPhaseSchema>;

function closesAfter(fields: [string, string]) {
  return (data: Record<string, string>) => new Date(data[fields[0]]!) < new Date(data[fields[1]]!);
}

export const createCompetitionRequestSchema = z
  .object({
    slug: z.string().min(3).max(60).regex(slugPattern, "Lettres minuscules, chiffres et tirets seulement."),
    name: z.string().min(2).max(80),
    pitch: z.string().min(10).max(200),
    description: z.string().max(4000).optional().default(""),
    registrationClosesAt: z.string().datetime(),
    submissionClosesAt: z.string().datetime(),
    votingClosesAt: z.string().datetime(),
  })
  .refine(closesAfter(["registrationClosesAt", "submissionClosesAt"]), {
    message: "La clôture des inscriptions doit précéder celle des soumissions.",
    path: ["submissionClosesAt"],
  })
  .refine(closesAfter(["submissionClosesAt", "votingClosesAt"]), {
    message: "La clôture des soumissions doit précéder celle du vote.",
    path: ["votingClosesAt"],
  });

export type CreateCompetitionRequestInput = z.infer<typeof createCompetitionRequestSchema>;

export const reviewCompetitionSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(500).optional(),
});

export type ReviewCompetitionInput = z.infer<typeof reviewCompetitionSchema>;

export const createTeamSchema = z.object({
  name: z.string().min(2).max(60),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const createSubmissionSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(2).max(80),
  pitch: z.string().min(10).max(200),
  description: z.string().max(4000).optional().default(""),
  repoUrl: httpUrlSchema(500),
  demoUrl: httpUrlSchema(500).nullable().optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const updateSubmissionSchema = createSubmissionSchema.partial();

export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;

export const juryScoreInputSchema = z.object({
  score: z.number().int().min(0).max(20),
  comment: z.string().max(1000).nullable().optional(),
});

export type JuryScoreInput = z.infer<typeof juryScoreInputSchema>;

export const competitionSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  pitch: z.string(),
  status: competitionStatusSchema,
  phase: competitionPhaseSchema,
  registrationClosesAt: z.string().datetime(),
  submissionClosesAt: z.string().datetime(),
  votingClosesAt: z.string().datetime(),
  teamCount: z.number().int().nonnegative(),
  submissionCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type CompetitionSummary = z.infer<typeof competitionSummarySchema>;

export const competitionDetailSchema = competitionSummarySchema.extend({
  description: z.string(),
  createdByHandle: z.string(),
  // Visible seulement par le créateur et les admins (apps/server/src/api/routes/competitions.ts) ;
  // nulle pour tout autre lecteur, y compris sur une compétition publiée.
  reviewNote: z.string().nullable(),
  viewerIsCreator: z.boolean(),
  viewerIsJuror: z.boolean(),
});

export type CompetitionDetail = z.infer<typeof competitionDetailSchema>;

export const teamSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  name: z.string(),
  captainHandle: z.string(),
  memberHandles: z.array(z.string()),
  hasSubmission: z.boolean(),
  viewerIsMember: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Team = z.infer<typeof teamSchema>;

export const submissionSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  teamId: z.string().uuid(),
  teamName: z.string(),
  projectSlug: z.string(),
  authorHandle: z.string(),
  title: z.string(),
  pitch: z.string(),
  // Nuls pendant la phase de soumission pour une équipe rivale (lien de
  // dépôt, de démo et description détaillée) : voir
  // apps/server/src/api/routes/competitions.ts, listSubmissions. Visibles
  // pour tout le monde dès la phase de vote.
  description: z.string().nullable(),
  repoUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  viewerIsTeamMember: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Submission = z.infer<typeof submissionSchema>;

// Combine jury et vote public : la pondération est
// arbitraire, faute de valeur dans docs/CONTEXTE.md, documentée et
// ajustable dans apps/server/src/api/repositories/competitions.ts.
export const submissionResultSchema = z.object({
  submissionId: z.string().uuid(),
  teamName: z.string(),
  rank: z.number().int().positive(),
  juryAverage: z.number().nonnegative().nullable(),
  juryScoreCount: z.number().int().nonnegative(),
  voteCount: z.number().int().nonnegative(),
  officialScore: z.number().nonnegative(),
});

export type SubmissionResult = z.infer<typeof submissionResultSchema>;
