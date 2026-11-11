import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, projects, workAuthors, works, type Db } from "@kemet/db";
import { workPersonSchema, type RelatedPeople } from "@kemet/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import type { LlmMessage, LlmStreamChunk, StreamingLlmProvider } from "../ai/llm-provider.js";
import { WorkMatcher } from "../ai/work-matcher.js";
import { FullTextWorkRetriever } from "../ai/work-retriever.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

class CountingProvider implements StreamingLlmProvider {
  calls: LlmMessage[][] = [];
  // eslint-disable-next-line require-yield -- un appel suffit à faire échouer le test.
  async *streamResponse(messages: LlmMessage[]): AsyncGenerator<LlmStreamChunk> {
    this.calls.push(messages);
    throw new Error("le modèle ne doit jamais être appelé");
  }
}

describe.skipIf(!databaseUrl)(
  "personnes sur un sujet proche, sans compte (base Postgres réelle)",
  () => {
    let db: Db;
    let app: ReturnType<typeof buildApp>;
    let provider: CountingProvider;

    afterEach(async () => {
      await db.$client.end();
    });

    beforeEach(async () => {
      await resetTestDatabase(databaseUrl!);
      db = createDb(databaseUrl!);
      provider = new CountingProvider();
      const auth = createAuth({
        db,
        emailSender: new InMemoryEmailSender(),
        baseUrl: "http://localhost:3001",
        webAppUrl: "http://localhost:5173",
        secret: "test-secret-at-least-32-characters-long",
        rateLimitEnabled: false,
      });
      app = buildApp({
        db,
        auth,
        workMatcher: new WorkMatcher(db, provider, new FullTextWorkRetriever(db), {
          recordedAnswers: true,
        }),
      });
    });

    async function person(
      handle: string,
      extra: Partial<typeof profiles.$inferInsert> = {},
    ): Promise<string> {
      const [row] = await db
        .insert(profiles)
        .values({ handle, displayName: handle, country: "SN", ...extra })
        .returning({ id: profiles.id });
      return row!.id;
    }

    async function work(
      slug: string,
      publisherId: string,
      tags: string[],
      extra: Partial<typeof works.$inferInsert> = {},
    ): Promise<string> {
      const [row] = await db
        .insert(works)
        .values({
          slug,
          publisherId,
          title: slug,
          type: "application",
          summary: "Résumé.",
          tags,
          publishRightConfirmed: true,
          ...extra,
        })
        .returning({ id: works.id });
      return row!.id;
    }

    async function related(url: string): Promise<RelatedPeople> {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(200);
      return response.json<{ related: RelatedPeople }>().related;
    }

    it("classe les auteurs par tags communs et n'en montre que trois", async () => {
      const owner = await person("owner");
      const ownerCoauthor = await person("owner-coauthor");
      const subjectId = await work("sujet", owner, ["paiement", "mobile-money"]);
      await db
        .insert(workAuthors)
        .values({ workId: subjectId, profileId: ownerCoauthor, status: "accepted" });
      await work("autre-du-meme-auteur", owner, ["paiement"]);
      await work("autre-du-coauteur", ownerCoauthor, ["paiement"]);

      const bob = await person("bob");
      const carol = await person("carol");
      const pending = await person("pending");
      const both = await work("deux-tags", bob, ["paiement", "mobile-money"]);
      await db.insert(workAuthors).values([
        { workId: both, profileId: carol, status: "accepted" },
        { workId: both, profileId: pending, status: "pending" },
      ]);
      await work("un-tag", await person("alice"), ["Paiement"]);
      await work("par-la-stack", await person("hugo"), [], { stack: ["mobile-money"] });
      await work("sans-rapport", await person("eve"), ["ia"]);

      await work("figurant", await person("filler", { isFiller: true }), ["paiement"]);
      await work("suspendu", await person("suspended", { suspendedAt: new Date() }), ["paiement"]);
      await work("supprime", await person("gone"), ["paiement"], { deletedAt: new Date() });
      await work("compte-supprime", await person("deleted", { deletedAt: new Date() }), [
        "paiement",
      ]);
      // Mêmes règles pour un coauteur accepté que pour la personne qui publie.
      const sharedWork = await work("coauteurs-caches", await person("frank", { isFiller: true }), [
        "paiement",
      ]);
      await db.insert(workAuthors).values([
        {
          workId: sharedWork,
          profileId: await person("co-filler", { isFiller: true }),
          status: "accepted",
        },
        {
          workId: sharedWork,
          profileId: await person("co-suspended", { suspendedAt: new Date() }),
          status: "accepted",
        },
        {
          workId: sharedWork,
          profileId: await person("co-deleted", { deletedAt: new Date() }),
          status: "accepted",
        },
      ]);

      const result = await related("/api/works/sujet/related-people");

      expect(result.total).toBe(4);
      expect(result.people).toHaveLength(3);
      expect(new Set(result.people.slice(0, 2).map((entry) => entry.id))).toEqual(
        new Set([bob, carol]),
      );
      expect(["alice", "hugo"]).toContain(result.people[2]!.handle);
      expect(provider.calls).toHaveLength(0);
    });

    it("ne renvoie que les champs publics d'un auteur", async () => {
      const owner = await person("owner");
      await work("sujet", owner, ["paiement"]);
      await work("voisin", await person("bob"), ["paiement"]);

      const result = await related("/api/works/sujet/related-people");

      expect(Object.keys(result.people[0]!).sort()).toEqual(
        Object.keys(workPersonSchema.shape).sort(),
      );
    });

    it("rapproche un projet par sa stack, sans tenir compte de la casse", async () => {
      const owner = await person("owner");
      await db.insert(projects).values({
        ownerId: owner,
        slug: "projet",
        name: "Projet",
        pitch: "Pitch.",
        repoUrl: "https://example.com/projet",
        stack: ["Flutter"],
      });
      await work("travail-du-proprietaire", owner, [], { stack: ["flutter"] });
      const bob = await person("bob");
      await work("voisin", bob, [], { stack: ["flutter"] });

      const result = await related("/api/projects/projet/related-people");

      expect(result).toMatchObject({ total: 1, people: [{ id: bob }] });
      expect(provider.calls).toHaveLength(0);
    });

    it("renvoie une liste vide sans tag ni stack, et 404 pour un sujet absent ou supprimé", async () => {
      const owner = await person("owner");
      await work("sans-tag", owner, []);
      await work("supprime", owner, ["paiement"], { deletedAt: new Date() });
      await db.insert(projects).values({
        ownerId: owner,
        slug: "projet-supprime",
        name: "Projet supprimé",
        pitch: "Pitch.",
        repoUrl: "https://example.com/projet-supprime",
        stack: ["Flutter"],
        deletedAt: new Date(),
      });

      expect(await related("/api/works/sans-tag/related-people")).toEqual({ total: 0, people: [] });
      for (const url of [
        "/api/works/supprime/related-people",
        "/api/works/inconnu/related-people",
        "/api/projects/inconnu/related-people",
        "/api/projects/projet-supprime/related-people",
      ]) {
        const response = await app.inject({ method: "GET", url });
        expect(response.statusCode).toBe(404);
      }
    });
  },
);
