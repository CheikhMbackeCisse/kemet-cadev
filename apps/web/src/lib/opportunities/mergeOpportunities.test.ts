import type { FeedProject, OpportunitySummary } from "@kemet/shared";
import { describe, expect, it } from "vitest";
import { mergeOpportunities } from "./mergeOpportunities.js";

function offer(slug: string, createdAt: string): OpportunitySummary {
  return { slug, id: slug, createdAt } as OpportunitySummary;
}

function project(slug: string, createdAt: string, ownerCountry = "SN", roles = 1): FeedProject {
  return {
    slug,
    id: slug,
    createdAt,
    ownerCountry,
    openRoles: Array.from({ length: roles }, (_, index) => ({ id: `${slug}-${index}`, title: "Rôle", kind: "collaboration" })),
  } as FeedProject;
}

const ALL = { kind: "all", country: "all", domain: "all" };

const slugs = (entries: ReturnType<typeof mergeOpportunities>) => entries.map((entry) => entry.item.slug);

describe("mergeOpportunities", () => {
  const offers = [offer("emploi", "2026-11-10T10:00:00.000Z"), offer("mission", "2026-11-08T10:00:00.000Z")];
  const projects = [
    project("projet-recent", "2026-11-09T10:00:00.000Z"),
    project("projet-ghana", "2026-11-07T10:00:00.000Z", "GH"),
    project("projet-sans-role", "2026-11-11T10:00:00.000Z", "SN", 0),
  ];

  it("mélange offres et projets qui cherchent des membres, du plus récent au plus ancien", () => {
    expect(slugs(mergeOpportunities(offers, projects, ALL))).toEqual(["emploi", "projet-recent", "mission", "projet-ghana"]);
  });

  it("ne garde que les projets pour le type Projet collaboratif", () => {
    expect(slugs(mergeOpportunities(offers, projects, { ...ALL, kind: "project" }))).toEqual(["projet-recent", "projet-ghana"]);
  });

  it("ne garde que les offres pour un type d'offre", () => {
    expect(slugs(mergeOpportunities(offers, projects, { ...ALL, kind: "job" }))).toEqual(["emploi", "mission"]);
  });

  it("filtre les projets par le pays de leur auteur, et les retire pour un domaine", () => {
    expect(slugs(mergeOpportunities([], projects, { ...ALL, country: "GH" }))).toEqual(["projet-ghana"]);
    expect(slugs(mergeOpportunities(offers, projects, { ...ALL, domain: "data" }))).toEqual(["emploi", "mission"]);
  });
});
