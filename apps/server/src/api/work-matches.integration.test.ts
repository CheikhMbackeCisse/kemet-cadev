import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, workMatchRequests, works, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import {
  LlmProviderError,
  type LlmMessage,
  type LlmRequestOptions,
  type LlmStreamChunk,
  type StreamingLlmProvider,
} from "../ai/llm-provider.js";
import { WorkMatcher, type WorkMatchOptions } from "../ai/work-matcher.js";
import { FullTextWorkRetriever } from "../ai/work-retriever.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

class ScriptedProvider implements StreamingLlmProvider {
  calls: LlmMessage[][] = [];
  options: (LlmRequestOptions | undefined)[] = [];
  constructor(private readonly reply: (messages: LlmMessage[]) => string | Error) {}

  async *streamResponse(messages: LlmMessage[], options?: LlmRequestOptions): AsyncGenerator<LlmStreamChunk> {
    this.calls.push(messages);
    this.options.push(options);
    const reply = this.reply(messages);
    if (reply instanceof Error) throw reply;
    yield { provider: "gemini", model: "gemini-test", delta: reply };
  }
}

/** Identifiant court (t1, t2…) donné par la présélection au travail portant ce titre. */
function keyFor(messages: LlmMessage[], title: string): string {
  const context = messages.find((message) => message.role === "user")!.content;
  return context.match(new RegExp(`\\[(t\\d+)\\] « ${title} »`))![1]!;
}

describe.skipIf(!databaseUrl)("Qui a travaillé sur ce sujet ? (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let auth: ReturnType<typeof createAuth>;

  function rebuild(provider: StreamingLlmProvider, options?: WorkMatchOptions) {
    app = buildApp({
      db,
      auth,
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1 },
      workMatcher: new WorkMatcher(db, provider, new FullTextWorkRetriever(db), options),
    });
  }

  // Un pool par test, jamais fermé, finissait par dépasser le nombre de
  // connexions autorisées par Postgres ("too many clients").
  afterEach(async () => {
    await db.$client.end();
  });

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    rebuild(new ScriptedProvider(() => '{"suggestions":[]}'));
  });

  async function createMember(handle: string): Promise<{ cookie: string; profileId: string }> {
    const email = `${handle}@test.kemet`;
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: handle },
    });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    const raw = signIn.headers["set-cookie"];
    const cookie = String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
    const me = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return { cookie, profileId: me.json().profile.id as string };
  }

  async function publish(
    cookie: string,
    slug: string,
    title: string,
    summary: string,
    tags: string[],
  ) {
    const response = await app.inject({
      method: "POST",
      url: "/api/works",
      headers: { cookie },
      payload: { slug, title, type: "article", summary, tags, publishRightConfirmed: true },
    });
    expect(response.statusCode, slug).toBe(200);
  }

  function ask(cookie: string | undefined, subject: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: "/api/work-matches",
      headers: cookie ? { cookie } : {},
      payload: { subject },
    });
  }

  // Trois travaux sur la synchronisation hors ligne, dont un de la personne
  // qui demande, et un hors sujet.
  async function seedNeighbours() {
    const viewer = await createMember("lectrice");
    const subjectAuthor = await createMember("sujet");
    const neighbour = await createMember("voisine");
    const other = await createMember("autre");
    await publish(
      subjectAuthor.cookie,
      "sujet-sync",
      "Synchronisation hors ligne bancaire",
      "File d'opérations locale et conflits de synchronisation hors ligne sur mobile.",
      ["hors-ligne", "synchronisation"],
    );
    await publish(
      neighbour.cookie,
      "voisin-stock",
      "Stock de boutique hors ligne",
      "Les ventes hors ligne sont synchronisées à la reconnexion, avec gestion des conflits.",
      ["hors-ligne", "mobile"],
    );
    await publish(
      viewer.cookie,
      "mien-sync",
      "Ma synchronisation hors ligne",
      "Mon propre travail sur la synchronisation hors ligne et les conflits.",
      ["hors-ligne"],
    );
    await publish(
      other.cookie,
      "hors-sujet",
      "Moteur de jeu vidéo",
      "Rendu 3D et physique pour Unity.",
      ["jeux"],
    );
    return { viewer, subjectAuthor, neighbour, other };
  }

  it("refuse un visiteur", async () => {
    await seedNeighbours();
    expect((await ask(undefined, { type: "work", slug: "sujet-sync" })).statusCode).toBe(401);
  });

  it("ne présélectionne ni les travaux de la personne, ni le travail affiché, ni un travail hors sujet", async () => {
    const provider = new ScriptedProvider(() => '{"suggestions":[]}');
    rebuild(provider);
    const { viewer } = await seedNeighbours();

    const response = await ask(viewer.cookie, { type: "work", slug: "sujet-sync" });
    expect(response.statusCode).toBe(200);
    const context = provider.calls[0]!.find((message) => message.role === "user")!.content;
    expect(context).toContain("Stock de boutique hors ligne");
    expect(context).not.toContain("Ma synchronisation hors ligne");
    expect(context).not.toContain("Moteur de jeu vidéo");
    expect(context.split("<travaux>")[1]).not.toContain("Synchronisation hors ligne bancaire");
  });

  it("n'accepte que des personnes et des travaux de la présélection", async () => {
    const provider = new ScriptedProvider((messages) =>
      JSON.stringify({
        suggestions: [
          {
            workId: keyFor(messages, "Stock de boutique hors ligne"),
            handle: "voisine",
            justification: "Même file locale.",
          },
          {
            workId: keyFor(messages, "Stock de boutique hors ligne"),
            handle: "lectrice",
            justification: "Inventé.",
          },
          { workId: "t99", handle: "autre", justification: "Identifiant inventé." },
          {
            workId: keyFor(messages, "Stock de boutique hors ligne"),
            handle: "autre",
            justification: "Pas auteur.",
          },
        ],
      }),
    );
    rebuild(provider);
    const { viewer } = await seedNeighbours();

    const response = await ask(viewer.cookie, { type: "work", slug: "sujet-sync" });
    expect(response.json().result).toEqual({
      mode: "assistant",
      fallbackReason: null,
      suggestions: [
        expect.objectContaining({
          person: expect.objectContaining({ handle: "voisine" }),
          work: expect.objectContaining({ slug: "voisin-stock" }),
          justification: "Même file locale.",
        }),
      ],
    });
    // La chaîne valide la forme du JSON et passe au modèle suivant sinon.
    expect(provider.options[0]?.json?.name).toBe("work_match");
  });

  it("se replie sur la recherche plein texte quand les fournisseurs sont saturés", async () => {
    rebuild(new ScriptedProvider(() => new LlmProviderError("gemini", "rate_limited", "quota")));
    const { viewer } = await seedNeighbours();

    const response = await ask(viewer.cookie, { type: "work", slug: "sujet-sync" });
    expect(response.json().result.mode).toBe("full_text");
    expect(response.json().result.fallbackReason).toBe("unavailable");
    expect(response.json().result.suggestions).toEqual([
      expect.objectContaining({
        person: expect.objectContaining({ handle: "voisine" }),
        justification: null,
      }),
    ]);
  });

  it("ne compte pas dans le quota quand aucun fournisseur ne répond", async () => {
    rebuild(new ScriptedProvider(() => new LlmProviderError("gemini", "rate_limited", "quota")), {
      recordedAnswers: false,
      dailyQuotaOverride: 1,
    });
    const { viewer } = await seedNeighbours();
    for (let index = 0; index < 2; index += 1) {
      const response = await ask(viewer.cookie, { type: "work", slug: "sujet-sync" });
      expect(response.json().result.fallbackReason).toBe("unavailable");
    }
    const rows = await db
      .select()
      .from(workMatchRequests)
      .where(eq(workMatchRequests.requestedBy, viewer.profileId));
    expect(rows).toHaveLength(0);
  });

  it("se replie aussi quand la réponse du modèle n'a pas le format attendu", async () => {
    rebuild(new ScriptedProvider(() => "Voici mes suggestions : voisine, sans aucun doute."));
    const { viewer } = await seedNeighbours();

    const response = await ask(viewer.cookie, { type: "work", slug: "sujet-sync" });
    expect(response.json().result.mode).toBe("full_text");
    expect(response.json().result.fallbackReason).toBe("invalid_response");
  });

  it("compte dans le quota quotidien de l'assistant", async () => {
    const provider = new ScriptedProvider(() => '{"suggestions":[]}');
    rebuild(provider, { recordedAnswers: false, dailyQuotaOverride: 1 });
    const { viewer } = await seedNeighbours();

    expect(
      (await ask(viewer.cookie, { type: "work", slug: "sujet-sync" })).json().result.mode,
    ).toBe("assistant");
    const second = await ask(viewer.cookie, { type: "work", slug: "sujet-sync" });
    expect(second.json().result.mode).toBe("full_text");
    expect(second.json().result.fallbackReason).toBe("quota_exceeded");
    expect(provider.calls).toHaveLength(1);
    const rows = await db
      .select()
      .from(workMatchRequests)
      .where(eq(workMatchRequests.requestedBy, viewer.profileId));
    expect(rows).toHaveLength(1);
  });

  it("rejoue la réponse enregistrée d'un travail de démo, marquée comme telle", async () => {
    rebuild(new ScriptedProvider(() => new LlmProviderError("gemini", "rate_limited", "quota")), {
      recordedAnswers: true,
    });
    const viewer = await createMember("lectrice");
    const kwame = await createMember("kwame-asante");
    const yassine = await createMember("yassine-trabelsi");
    await publish(
      kwame.cookie,
      "synchronisation-hors-ligne-banque-mobile",
      "Synchronisation hors ligne d'une application bancaire mobile",
      "File locale d'opérations et conflits de synchronisation hors ligne.",
      ["hors-ligne", "synchronisation", "mobile"],
    );
    await publish(
      yassine.cookie,
      "stock-boutique-hors-ligne",
      "Gestion de stock hors ligne",
      "Ventes enregistrées hors ligne et synchronisées à la reconnexion.",
      ["hors-ligne", "mobile"],
    );
    await db.update(works).set({ isDemo: true });

    const response = await ask(viewer.cookie, {
      type: "work",
      slug: "synchronisation-hors-ligne-banque-mobile",
    });
    expect(response.json().result.mode).toBe("recorded");
    expect(response.json().result.suggestions).toEqual([
      expect.objectContaining({
        person: expect.objectContaining({ handle: "yassine-trabelsi" }),
        justification: expect.stringContaining("stock"),
      }),
    ]);
  });

  it("accepte un projet en cours et un post Question, jamais un autre post", async () => {
    const { viewer, other } = await seedNeighbours();
    const project = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: other.cookie },
      payload: {
        slug: "appli-hors-ligne",
        name: "Appli hors ligne",
        pitch: "Une application qui synchronise ses données hors ligne.",
        repoUrl: "https://github.com/exemple/appli",
      },
    });
    expect(project.statusCode).toBe(200);
    expect(
      (await ask(viewer.cookie, { type: "project", slug: "appli-hors-ligne" })).statusCode,
    ).toBe(200);

    const question = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: other.cookie },
      payload: {
        body: "Comment gérer les conflits de synchronisation hors ligne ?",
        format: "question",
      },
    });
    expect(
      (await ask(viewer.cookie, { type: "post", id: question.json().post.id })).statusCode,
    ).toBe(200);

    const plain = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: other.cookie },
      payload: { body: "Un post sans format sur la synchronisation." },
    });
    expect((await ask(viewer.cookie, { type: "post", id: plain.json().post.id })).statusCode).toBe(
      400,
    );
  });
});
