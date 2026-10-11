import { describe, expect, it } from "vitest";
import { createApplicationSchema, createHelpRequestSchema, createProjectSchema } from "./project.js";

describe("createProjectSchema", () => {
  const base = {
    slug: "kemet-cli",
    name: "Kemet CLI",
    pitch: "Un outil en ligne de commande pour parcourir Kemet depuis le terminal.",
    repoUrl: "https://github.com/exemple/kemet-cli",
  };

  it("accepte un projet minimal valide", () => {
    const result = createProjectSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejette un identifiant avec des majuscules", () => {
    const result = createProjectSchema.safeParse({ ...base, slug: "Kemet-CLI" });
    expect(result.success).toBe(false);
  });

  it("rejette un lien javascript: comme dépôt", () => {
    const result = createProjectSchema.safeParse({ ...base, repoUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("rejette une présentation trop courte", () => {
    const result = createProjectSchema.safeParse({ ...base, pitch: "Court" });
    expect(result.success).toBe(false);
  });
});

describe("createHelpRequestSchema", () => {
  it("accepte une demande d'aide par défaut", () => {
    const result = createHelpRequestSchema.safeParse({
      title: "Revue de code sur l'authentification",
      description: "Je cherche un regard sur la gestion des sessions avant de merger.",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.kind).toBe("help");
  });

  it("accepte une demande de collaboration explicite", () => {
    const result = createHelpRequestSchema.safeParse({
      kind: "collaboration",
      title: "Cherche un dev front pour la suite",
      description: "Le projet grandit, j'ai besoin d'un binôme régulier côté interface.",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un titre trop court", () => {
    const result = createHelpRequestSchema.safeParse({ title: "Aide", description: "Une description suffisamment longue." });
    expect(result.success).toBe(false);
  });
});

describe("createApplicationSchema", () => {
  it("rejette un message trop court", () => {
    const result = createApplicationSchema.safeParse({ message: "Ok" });
    expect(result.success).toBe(false);
  });

  it("accepte un message suffisamment détaillé", () => {
    const result = createApplicationSchema.safeParse({
      message: "J'ai déjà travaillé sur Fastify et Drizzle, je peux aider sur ce point.",
    });
    expect(result.success).toBe(true);
  });
});
