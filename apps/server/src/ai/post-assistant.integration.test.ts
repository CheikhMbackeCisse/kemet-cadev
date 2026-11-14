import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { assistantInvocations, createDb, pointsLedger, profiles, skills, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "../api/app.js";
import { createSkill } from "../api/repositories/skills.js";
import { KEMET_ASSISTANT_PROFILE_ID } from "../chat/kemet-assistant.js";
import { KemetPostAssistant } from "./post-assistant.js";
import { databaseQuotaCounter } from "./quota.js";
import type { AssistantRuntime } from "./assistant-runtime.js";
import { ConcurrencyLimiter } from "./concurrency-limiter.js";
import { InMemoryResponseCache } from "./response-cache.js";
import { FullTextRetriever } from "./skill-retriever.js";
import {
  UnavailableLlmProvider,
  type LlmMessage,
  type LlmStreamChunk,
  type StreamingLlmProvider,
} from "./llm-provider.js";

const databaseUrl = getTestDatabaseUrl();

class FakeStreamingProvider {
  capturedMessages: LlmMessage[][] = [];
  constructor(private readonly chunks: string[]) {}
  async *streamResponse(messages: LlmMessage[]): AsyncGenerator<LlmStreamChunk> {
    this.capturedMessages.push(messages);
    for (const delta of this.chunks) yield { provider: "gemini", model: "gemini-test", delta };
  }
}

// Ne répond qu'une fois la barrière levée : garde une rédaction "en cours".
class GatedProvider {
  private release!: () => void;
  private readonly gate = new Promise<void>((resolve) => (this.release = resolve));
  open(): void {
    this.release();
  }
  async *streamResponse(): AsyncGenerator<LlmStreamChunk> {
    await this.gate;
    yield { provider: "gemini", model: "gemini-test", delta: "Réponse." };
  }
}

describe.skipIf(!databaseUrl)("@kocc sous un post (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let postAssistant: KemetPostAssistant;

  function setup(provider: StreamingLlmProvider, quota?: number, runtime?: AssistantRuntime) {
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    postAssistant = new KemetPostAssistant(
      db,
      provider,
      new FullTextRetriever(db),
      new InMemoryResponseCache(),
      quota,
      false,
      () => {},
      runtime,
    );
    app = buildApp({ db, auth, postAssistant });
  }

  // Un pool par test, fermé ensuite : treize tests ouverts ensemble
  // dépassent le nombre de connexions de Postgres.
  afterEach(async () => {
    await postAssistant?.idle();
    await db.$client.end();
  });

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function createMember(
    email: string,
    handle: string,
  ): Promise<{ cookie: string; profileId: string }> {
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
    const cookie = extractCookie(signIn);
    const me = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return { cookie, profileId: me.json().profile.id as string };
  }

  async function createPost(cookie: string, body: string, format?: "question"): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie },
      payload: { body, format },
    });
    if (response.statusCode !== 200) throw new Error(`createPost ${response.statusCode} ${response.body}`);
    return response.json().post.id as string;
  }

  async function reply(cookie: string, postId: string, body: string) {
    const response = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/replies`,
      headers: { cookie },
      payload: { body },
    });
    expect(response.statusCode).toBe(200);
    return response.json() as {
      reply: { id: string };
      assistant: { invocationId: string | null; errorCode: string | null } | null;
    };
  }

  it("fait attendre dans la file une rédaction au-delà de la limite de concurrence", async () => {
    const provider = new GatedProvider();
    setup(provider, undefined, { quotaCounter: databaseQuotaCounter, limiter: new ConcurrencyLimiter(1) });
    const author = await createMember("file-auteur@test.kemet", "fileauteur");
    const other = await createMember("file-autre@test.kemet", "fileautre");
    const postId = await createPost(author.cookie, "Un post sur les index.");
    const first = await reply(author.cookie, postId, "@kocc explique les index");
    const second = await reply(other.cookie, postId, "@kocc et les index partiels ?");

    const statusOf = async (id: string | null) =>
      (await db.select().from(assistantInvocations).where(eq(assistantInvocations.id, id!)))[0]!.status;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await statusOf(first.assistant!.invocationId)).toBe("streaming");
    expect(await statusOf(second.assistant!.invocationId)).toBe("pending");

    provider.open();
    await postAssistant.idle();
    expect(await statusOf(first.assistant!.invocationId)).toBe("done");
    expect(await statusOf(second.assistant!.invocationId)).toBe("done");
  });

  it("répond sous le post quand une réponse appelle @kocc, avec le post et les réponses passés comme données", async () => {
    const provider = new FakeStreamingProvider(["Ce post ", "explique un index."]);
    setup(provider);
    const author = await createMember("auteur@test.kemet", "auteur");
    const reader = await createMember("lecteur@test.kemet", "lecteur");
    const postId = await createPost(
      author.cookie,
      "Un index B-tree accélère les recherches par égalité.",
    );
    await reply(reader.cookie, postId, "Et pour un LIKE avec joker au début ?");

    const created = await reply(reader.cookie, postId, "@kocc explique-moi ce post simplement");
    expect(created.assistant?.invocationId).toBeTruthy();
    await postAssistant.idle();

    const status = await app.inject({
      method: "GET",
      url: `/api/post-assistant-invocations/${created.assistant!.invocationId}`,
      headers: { cookie: reader.cookie },
    });
    expect(status.json().status).toBe("done");
    expect(status.json().reply.body).toBe("Ce post explique un index.");
    expect(status.json().reply.authorId).toBe(KEMET_ASSISTANT_PROFILE_ID);

    const replies = await app.inject({ method: "GET", url: `/api/posts/${postId}/replies` });
    const items = replies.json().items as {
      authorId: string;
      assistant: { recorded: boolean } | null;
    }[];
    expect(items).toHaveLength(3);
    expect(items[2]!.authorId).toBe(KEMET_ASSISTANT_PROFILE_ID);
    expect(items[2]!.assistant).toMatchObject({ recorded: false, skill: null });
    expect(items[0]!.assistant).toBeNull();

    const messages = provider.capturedMessages.at(-1)!;
    const system = messages.find((message) => message.role === "system")!.content;
    expect(system).not.toContain("B-tree");
    const context = messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n");
    expect(context).toContain(
      "<post>\nUn index B-tree accélère les recherches par égalité.\n</post>",
    );
    expect(context).toContain(
      "<historique>\n- Et pour un LIKE avec joker au début ?\n</historique>",
    );
    expect(messages.at(-1)!.content).toBe("explique-moi ce post simplement");
  });

  it("ne répond jamais sans être appelé dans une réponse", async () => {
    const provider = new FakeStreamingProvider(["jamais"]);
    setup(provider);
    const author = await createMember("auteur@test.kemet", "auteur");
    const postId = await createPost(
      author.cookie,
      "@kocc un post qui le mentionne n'est pas une question.",
    );
    const created = await reply(author.cookie, postId, "Une réponse ordinaire.");

    expect(created.assistant).toBeNull();
    expect(await db.select().from(assistantInvocations)).toHaveLength(0);
    expect(provider.capturedMessages).toHaveLength(0);
  });

  it("refuse tout de suite quand le quota du jour est atteint, sans créer d'invocation", async () => {
    setup(new FakeStreamingProvider(["ok"]), 0);
    const author = await createMember("auteur@test.kemet", "auteur");
    const postId = await createPost(author.cookie, "Un post.");
    const created = await reply(author.cookie, postId, "@kocc résume");

    expect(created.assistant).toEqual({ invocationId: null, errorCode: "quota_exceeded" });
    expect(await db.select().from(assistantInvocations)).toHaveLength(0);
  });

  it("compte une question sous un post dans le même quota que les salons", async () => {
    setup(new FakeStreamingProvider(["ok"]), 1);
    const author = await createMember("auteur@test.kemet", "auteur");
    const postId = await createPost(author.cookie, "Un post.");
    expect((await reply(author.cookie, postId, "@kocc résume")).assistant?.errorCode).toBeNull();
    await postAssistant.idle();
    expect((await reply(author.cookie, postId, "@kocc encore")).assistant?.errorCode).toBe(
      "quota_exceeded",
    );
  });

  it("signale l'indisponibilité de la chaîne à la personne qui a posé la question", async () => {
    setup(new UnavailableLlmProvider());
    const author = await createMember("auteur@test.kemet", "auteur");
    const postId = await createPost(author.cookie, "Un post.");
    const created = await reply(author.cookie, postId, "@kocc résume");
    await postAssistant.idle();

    const status = await app.inject({
      method: "GET",
      url: `/api/post-assistant-invocations/${created.assistant!.invocationId}`,
      headers: { cookie: author.cookie },
    });
    expect(status.json()).toMatchObject({
      status: "failed",
      errorCode: "assistant_unavailable",
      reply: null,
    });
  });

  it("réserve l'état d'une demande à la personne qui l'a faite", async () => {
    setup(new FakeStreamingProvider(["ok"]));
    const author = await createMember("auteur@test.kemet", "auteur");
    const other = await createMember("autre@test.kemet", "autre");
    const postId = await createPost(author.cookie, "Un post.");
    const created = await reply(author.cookie, postId, "@kocc résume");
    await postAssistant.idle();
    const url = `/api/post-assistant-invocations/${created.assistant!.invocationId}`;

    expect(
      (await app.inject({ method: "GET", url, headers: { cookie: other.cookie } })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/post-assistant-invocations/pas-un-uuid",
          headers: { cookie: author.cookie },
        })
      ).statusCode,
    ).toBe(404);
  });

  it("cite le skill retenu avec son auteur, et un Utile rapporte des points à cet auteur", async () => {
    setup(new FakeStreamingProvider(["Réponse appuyée sur le skill."]));
    const skillAuthor = await createMember("skill@test.kemet", "skilleuse");
    const asker = await createMember("asker@test.kemet", "asker");
    await createSkill(db, skillAuthor.profileId, {
      slug: "index-postgres",
      name: "Index Postgres",
      description: "Choisir un index Postgres",
      content: "Utilise un index GIN pour la recherche plein texte.",
      tags: ["postgres"],
      visibility: "public",
    });
    const postId = await createPost(asker.cookie, "Quel index pour chercher du texte ?");
    const created = await reply(
      asker.cookie,
      postId,
      "@kocc avec index-postgres, lequel choisir ?",
    );
    await postAssistant.idle();

    const replies = await app.inject({ method: "GET", url: `/api/posts/${postId}/replies` });
    const answer = (
      replies.json().items as {
        assistant: { skill: { slug: string; authorHandle: string } | null } | null;
      }[]
    ).at(-1)!;
    expect(answer.assistant!.skill).toMatchObject({
      slug: "index-postgres",
      authorHandle: "skilleuse",
    });

    // Un compte de moins de quelques jours ne rapporte rien par un Utile.
    await db
      .update(profiles)
      .set({ createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) })
      .where(eq(profiles.id, asker.profileId));
    const feedback = await app.inject({
      method: "PUT",
      url: `/api/assistant-invocations/${created.assistant!.invocationId}/feedback`,
      headers: { cookie: asker.cookie },
      payload: { helpful: true },
    });
    expect(feedback.statusCode).toBe(200);
    const ledger = await db
      .select()
      .from(pointsLedger)
      .where(eq(pointsLedger.profileId, skillAuthor.profileId));
    expect(ledger.some((row) => row.source === "assistant_skill_helpful")).toBe(true);
  });

  it("déplie dans le fil la première réponse de @kocc sous un post, jamais une réponse retirée", async () => {
    setup(new FakeStreamingProvider(["Réponse appuyée sur le skill."]));
    const skillAuthor = await createMember("fil-skill@test.kemet", "filskill");
    const asker = await createMember("fil-asker@test.kemet", "filasker");
    await createSkill(db, skillAuthor.profileId, {
      slug: "index-postgres",
      name: "Index Postgres",
      description: "Choisir un index Postgres",
      content: "Utilise un index GIN pour la recherche plein texte.",
      tags: ["postgres"],
      visibility: "public",
    });
    const answeredId = await createPost(asker.cookie, "Quel index pour chercher du texte ?");
    const quietId = await createPost(asker.cookie, "Un post sans question à @kocc.");
    await reply(asker.cookie, answeredId, "@kocc avec index-postgres, lequel choisir ?");
    await postAssistant.idle();

    type FeedItem = {
      id: string;
      kemetAnswer: {
        id: string;
        body: string;
        assistant: { recorded: boolean; skill: { slug: string; authorAvatarUrl: string | null } | null };
      } | null;
    };
    const readFeed = async () =>
      (await app.inject({ method: "GET", url: "/api/posts?tab=pour-toi" })).json().items as FeedItem[];

    const items = await readFeed();
    const answered = items.find((item) => item.id === answeredId)!;
    expect(answered.kemetAnswer).toMatchObject({
      body: "Réponse appuyée sur le skill.",
      assistant: { recorded: false, skill: { slug: "index-postgres", authorAvatarUrl: null } },
    });
    expect(items.find((item) => item.id === quietId)!.kemetAnswer).toBeNull();

    const single = await app.inject({ method: "GET", url: `/api/posts/${answeredId}` });
    expect(single.json().post.kemetAnswer).toBeUndefined();

    // Un skill devenu privé après la réponse n'est plus cité dans le fil.
    await db.update(skills).set({ visibility: "private" }).where(eq(skills.slug, "index-postgres"));
    const afterPrivate = (await readFeed()).find((item) => item.id === answeredId)!;
    expect(afterPrivate.kemetAnswer!.assistant.skill).toBeNull();

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/post-replies/${answered.kemetAnswer!.id}`,
      headers: { cookie: asker.cookie },
    });
    expect(removed.statusCode).toBe(200);
    expect((await readFeed()).find((item) => item.id === answeredId)!.kemetAnswer).toBeNull();
  });

  it("accepte une réponse de @kocc comme solution sans créditer de points à l'assistant", async () => {
    setup(new FakeStreamingProvider(["La solution."]));
    const author = await createMember("auteur@test.kemet", "auteur");
    const postId = await createPost(author.cookie, "Comment faire ?", "question");
    await reply(author.cookie, postId, "@kocc aide-moi");
    await postAssistant.idle();
    const replies = await app.inject({ method: "GET", url: `/api/posts/${postId}/replies` });
    const answerId = (replies.json().items as { id: string; authorId: string }[]).find(
      (item) => item.authorId === KEMET_ASSISTANT_PROFILE_ID,
    )!.id;

    const marked = await app.inject({
      method: "PUT",
      url: `/api/post-replies/${answerId}/solution`,
      headers: { cookie: author.cookie },
      payload: { isSolution: true },
    });
    expect(marked.statusCode).toBe(200);
    expect(marked.json().reply.isSolution).toBe(true);
    expect(
      await db
        .select()
        .from(pointsLedger)
        .where(eq(pointsLedger.profileId, KEMET_ASSISTANT_PROFILE_ID)),
    ).toHaveLength(0);
  });

  it("ne nourrit jamais une réponse publique d'un skill privé ou d'espace, même demandé par son nom", async () => {
    const provider = new FakeStreamingProvider(["Réponse."]);
    setup(provider);
    const asker = await createMember("asker@test.kemet", "asker");
    const space = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie: asker.cookie },
      payload: { name: "interne", slug: "interne", visibility: "private" },
    });
    const spaceId = space.json().space.id as string;
    await createSkill(db, asker.profileId, {
      slug: "secret-espace",
      name: "Index secret",
      description: "Index postgres interne",
      content: "CONTENU-ESPACE-CONFIDENTIEL",
      tags: ["postgres"],
      visibility: "space",
      spaceId,
    });
    await createSkill(db, asker.profileId, {
      slug: "secret-prive",
      name: "Index privé",
      description: "Index postgres privé",
      content: "CONTENU-PRIVE-CONFIDENTIEL",
      tags: ["postgres"],
      visibility: "private",
    });
    const postId = await createPost(asker.cookie, "Quel index postgres choisir ?");

    await reply(asker.cookie, postId, "@kocc quel index postgres choisir ?");
    await reply(asker.cookie, postId, "@kocc avec secret-prive, quel index ?");
    await postAssistant.idle();

    const sent = provider.capturedMessages
      .flat()
      .map((message) => message.content)
      .join("\n");
    expect(sent).not.toContain("CONFIDENTIEL");
    const invocations = await db.select().from(assistantInvocations);
    expect(invocations.every((invocation) => invocation.skillIds.length === 0)).toBe(true);
  });

  it("réserve l'avis Utile à qui a posé la question et à l'auteur du post, jamais à un compte suspendu", async () => {
    setup(new FakeStreamingProvider(["ok"]));
    const author = await createMember("auteur@test.kemet", "auteur");
    const asker = await createMember("asker@test.kemet", "asker");
    const other = await createMember("autre@test.kemet", "autre");
    const postId = await createPost(author.cookie, "Un post.");
    const created = await reply(asker.cookie, postId, "@kocc résume");
    await postAssistant.idle();
    const url = `/api/assistant-invocations/${created.assistant!.invocationId}/feedback`;

    const asOther = await app.inject({
      method: "PUT",
      url,
      headers: { cookie: other.cookie },
      payload: { helpful: true },
    });
    expect(asOther.statusCode).toBe(403);
    const asAuthor = await app.inject({
      method: "PUT",
      url,
      headers: { cookie: author.cookie },
      payload: { helpful: true },
    });
    expect(asAuthor.statusCode).toBe(200);

    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.id, asker.profileId));
    const asSuspended = await app.inject({
      method: "PUT",
      url,
      headers: { cookie: asker.cookie },
      payload: { helpful: true },
    });
    expect(asSuspended.statusCode).toBe(403);
    const suspendedReply = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/replies`,
      headers: { cookie: asker.cookie },
      payload: { body: "@kocc encore" },
    });
    expect(suspendedReply.statusCode).toBe(403);
    expect(await db.select().from(assistantInvocations)).toHaveLength(1);
  });

  it("laisse la personne qui a demandé et l'auteur du post retirer la réponse de @kocc, personne d'autre", async () => {
    setup(new FakeStreamingProvider(["ok"]));
    const author = await createMember("auteur@test.kemet", "auteur");
    const asker = await createMember("asker@test.kemet", "asker");
    const other = await createMember("autre@test.kemet", "autre");
    const postId = await createPost(author.cookie, "Un post.");
    await reply(asker.cookie, postId, "@kocc résume");
    await reply(asker.cookie, postId, "@kocc encore");
    await postAssistant.idle();
    const replies = await app.inject({ method: "GET", url: `/api/posts/${postId}/replies` });
    const answers = (replies.json().items as { id: string; authorId: string }[]).filter(
      (item) => item.authorId === KEMET_ASSISTANT_PROFILE_ID,
    );
    expect(answers).toHaveLength(2);

    const remove = (id: string, cookie: string) =>
      app.inject({ method: "DELETE", url: `/api/post-replies/${id}`, headers: { cookie } });
    expect((await remove(answers[0]!.id, other.cookie)).statusCode).toBe(403);
    expect((await remove(answers[0]!.id, asker.cookie)).statusCode).toBe(200);
    expect((await remove(answers[1]!.id, author.cookie)).statusCode).toBe(200);
  });

  it("relance une demande échouée sur la même question, sans republier la réponse qui l'a posée", async () => {
    const provider = new FakeStreamingProvider(["Enfin."]);
    setup(new UnavailableLlmProvider());
    const author = await createMember("auteur@test.kemet", "auteur");
    const other = await createMember("autre@test.kemet", "autre");
    const postId = await createPost(author.cookie, "Un post.");
    const created = await reply(author.cookie, postId, "@kocc résume");
    await postAssistant.idle();
    const failedUrl = `/api/post-assistant-invocations/${created.assistant!.invocationId}/retry`;

    // Le même serveur, cette fois avec un fournisseur qui répond.
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    postAssistant = new KemetPostAssistant(
      db,
      provider,
      new FullTextRetriever(db),
      new InMemoryResponseCache(),
    );
    app = buildApp({ db, auth, postAssistant });

    expect(
      (await app.inject({ method: "POST", url: failedUrl, headers: { cookie: other.cookie } }))
        .statusCode,
    ).toBe(404);
    const retried = await app.inject({
      method: "POST",
      url: failedUrl,
      headers: { cookie: author.cookie },
    });
    expect(retried.statusCode).toBe(200);
    await postAssistant.idle();
    const replies = await app.inject({ method: "GET", url: `/api/posts/${postId}/replies` });
    expect((replies.json().items as { body: string }[]).map((item) => item.body)).toEqual([
      "@kocc résume",
      "Enfin.",
    ]);
  });

  it("retire de la page du post une réponse supprimée et la réponse de @kocc à cette question", async () => {
    setup(new FakeStreamingProvider(["Une boucle répète."]));
    const author = await createMember("auteur@test.kemet", "auteur");
    const asker = await createMember("asker@test.kemet", "asker");
    const postId = await createPost(author.cookie, "for ou while ?");
    const kept = await reply(author.cookie, postId, "Une réponse qui reste.");
    const question = await reply(asker.cookie, postId, "@kocc c'est quoi une boucle ?");
    await postAssistant.idle();
    const replyIds = async () => {
      const page = await app.inject({ method: "GET", url: `/api/posts/${postId}/replies` });
      return (page.json().items as { id: string }[]).map((item) => item.id);
    };
    expect(await replyIds()).toHaveLength(3);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/post-replies/${question.reply.id}`,
      headers: { cookie: asker.cookie },
    });

    expect(removed.statusCode).toBe(200);
    expect(removed.json().removedReplyIds).toHaveLength(2);
    expect(await replyIds()).toEqual([kept.reply.id]);
    const post = await app.inject({ method: "GET", url: `/api/posts/${postId}` });
    expect(post.json().post.replyCount).toBe(1);
  });

  it("ne publie rien si le post est supprimé pendant la rédaction", async () => {
    // Le fournisseur ne répond qu'une fois le post supprimé.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    setup({
      async *streamResponse(): AsyncGenerator<LlmStreamChunk> {
        await gate;
        yield { provider: "gemini", model: "gemini-test", delta: "trop tard" };
      },
    });
    const author = await createMember("auteur@test.kemet", "auteur");
    const postId = await createPost(author.cookie, "Un post.");
    const created = await reply(author.cookie, postId, "@kocc résume");
    await app.inject({
      method: "DELETE",
      url: `/api/posts/${postId}`,
      headers: { cookie: author.cookie },
    });
    release();
    await postAssistant.idle();

    const [invocation] = await db
      .select()
      .from(assistantInvocations)
      .where(eq(assistantInvocations.id, created.assistant!.invocationId!));
    expect(invocation!.status).toBe("failed");
    expect(invocation!.responseReplyId).toBeNull();
  });
});
