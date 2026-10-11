import { describe, expect, it } from "vitest";
import { createCompetitionRequestSchema, createSubmissionSchema, createTeamSchema, juryScoreInputSchema } from "./competition.js";

describe("createCompetitionRequestSchema", () => {
  const base = {
    slug: "cadev-2026",
    name: "Défi CADEV 2026",
    pitch: "Construisez un projet utile pour les devs africains en une semaine.",
    registrationClosesAt: "2026-11-01T00:00:00.000Z",
    submissionClosesAt: "2026-11-08T00:00:00.000Z",
    votingClosesAt: "2026-11-15T00:00:00.000Z",
  };

  it("accepte une demande valide", () => {
    const result = createCompetitionRequestSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejette une clôture des soumissions avant celle des inscriptions", () => {
    const result = createCompetitionRequestSchema.safeParse({ ...base, submissionClosesAt: "2026-10-01T00:00:00.000Z" });
    expect(result.success).toBe(false);
  });

  it("rejette une clôture du vote avant celle des soumissions", () => {
    const result = createCompetitionRequestSchema.safeParse({ ...base, votingClosesAt: "2026-11-02T00:00:00.000Z" });
    expect(result.success).toBe(false);
  });

  it("rejette un identifiant avec des majuscules", () => {
    const result = createCompetitionRequestSchema.safeParse({ ...base, slug: "CADEV-2026" });
    expect(result.success).toBe(false);
  });
});

describe("createTeamSchema", () => {
  it("rejette un nom trop court", () => {
    const result = createTeamSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });
});

describe("createSubmissionSchema", () => {
  const base = {
    projectId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    title: "Kemet CLI",
    pitch: "Un outil en ligne de commande pour parcourir Kemet depuis le terminal.",
    repoUrl: "https://github.com/exemple/kemet-cli",
  };

  it("accepte une soumission minimale valide", () => {
    const result = createSubmissionSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejette un lien javascript: comme dépôt", () => {
    const result = createSubmissionSchema.safeParse({ ...base, repoUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });
});

describe("juryScoreInputSchema", () => {
  it("accepte une note dans l'intervalle 0-20", () => {
    expect(juryScoreInputSchema.safeParse({ score: 18 }).success).toBe(true);
  });

  it("rejette une note hors intervalle", () => {
    expect(juryScoreInputSchema.safeParse({ score: 21 }).success).toBe(false);
  });
});
