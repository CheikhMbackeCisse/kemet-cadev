import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, type Db } from "@kemet/db";
import type { ChatEvent } from "@kemet/shared";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import type { ChatPublisher } from "../chat/pubsub.js";
import type { AssistantMentionInput, AssistantOrchestrator } from "../ai/assistant-orchestrator.js";
import { canAccessChannel } from "../realtime/access.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

interface Member {
  cookie: string;
  profileId: string;
  handle: string;
}

describe.skipIf(!databaseUrl)("Messagerie privée (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let db: Db;
  let emailSender: InMemoryEmailSender;
  let events: ChatEvent[];
  let mentions: AssistantMentionInput[];

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    events = [];
    mentions = [];
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    const chat: ChatPublisher = {
      async publish(event) {
        events.push(event);
      },
      async close() {},
    };
    const assistant: AssistantOrchestrator = {
      async handleMention(input) {
        mentions.push(input);
      },
    };
    // Facteur 1 : la limite réduite des comptes neufs a son propre test plus bas.
    app = buildApp({ db, auth, chat, assistant, antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1, anonymousIpFactor: 3 } });
  });

  afterEach(async () => {
    await app.close();
    await db.$client.end();
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function createMember(handle: string): Promise<Member> {
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
    const cookie = extractCookie(signIn);
    const profile = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return { cookie, profileId: profile.json().profile.id as string, handle };
  }

  async function openConversation(from: Member, ...to: Member[]) {
    const response = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: { cookie: from.cookie },
      payload: { handles: to.map((member) => member.handle) },
    });
    return response;
  }

  async function send(member: Member, channelId: string, body: string) {
    return app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages`,
      headers: { cookie: member.cookie },
      payload: { clientId: crypto.randomUUID(), body },
    });
  }

  async function list(member: Member, box: "inbox" | "requests") {
    const response = await app.inject({
      method: "GET",
      url: `/api/conversations?box=${box}`,
      headers: { cookie: member.cookie },
    });
    return response.json().items as { id: string; unreadCount: number }[];
  }

  async function follow(follower: Member, followee: Member) {
    await app.inject({ method: "POST", url: `/api/users/${followee.handle}/follow`, headers: { cookie: follower.cookie } });
  }

  it("rouvre toujours la même conversation à deux, dans un sens comme dans l'autre", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const first = (await openConversation(awa, binta)).json().conversation;
    const again = (await openConversation(awa, binta)).json().conversation;
    const reverse = (await openConversation(binta, awa)).json().conversation;
    expect(again.id).toBe(first.id);
    expect(reverse.id).toBe(first.id);
    expect(first.isGroup).toBe(false);
  });

  it("met le premier message d'un inconnu dans les demandes et n'en laisse passer qu'un avant acceptation", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const conversation = (await openConversation(awa, binta)).json().conversation;
    expect(conversation.participants[0].status).toBe("pending");

    expect(await list(binta, "requests")).toHaveLength(0);
    expect((await send(awa, conversation.channelId, "Bonjour, une question sur ton projet")).statusCode).toBe(200);
    const second = await send(awa, conversation.channelId, "Tu es là ?");
    expect(second.statusCode).toBe(403);

    expect((await list(binta, "requests")).map((item) => item.id)).toEqual([conversation.id]);
    expect(await list(binta, "inbox")).toHaveLength(0);

    const asPending = await send(binta, conversation.channelId, "Réponse avant d'accepter");
    expect(asPending.statusCode).toBe(403);
    const readable = await app.inject({
      method: "GET",
      url: `/api/channels/${conversation.channelId}/messages`,
      headers: { cookie: binta.cookie },
    });
    expect(readable.statusCode).toBe(200);
    expect(readable.json().items).toHaveLength(1);

    const accepted = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversation.id}/accept`,
      headers: { cookie: binta.cookie },
    });
    expect(accepted.statusCode).toBe(200);
    expect((await list(binta, "inbox")).map((item) => item.id)).toEqual([conversation.id]);
    expect((await send(awa, conversation.channelId, "Merci d'avoir accepté")).statusCode).toBe(200);
    expect((await send(binta, conversation.channelId, "Avec plaisir")).statusCode).toBe(200);
  });

  it("retire un message supprimé de la conversation et de son aperçu", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    await follow(binta, awa);
    const conversation = (await openConversation(awa, binta)).json().conversation;
    await send(awa, conversation.channelId, "Premier message");
    const last = (await send(awa, conversation.channelId, "Message regretté")).json().message.id;

    const removed = await app.inject({ method: "DELETE", url: `/api/messages/${last}`, headers: { cookie: awa.cookie } });

    expect(removed.statusCode).toBe(200);
    const history = await app.inject({
      method: "GET",
      url: `/api/channels/${conversation.channelId}/messages`,
      headers: { cookie: binta.cookie },
    });
    expect((history.json().items as { body: string }[]).map((item) => item.body)).toEqual(["Premier message"]);
    const inbox = await app.inject({ method: "GET", url: "/api/conversations?box=inbox", headers: { cookie: binta.cookie } });
    const [item] = inbox.json().items as { lastMessage: { body: string; deleted: boolean }; unreadCount: number }[];
    expect(item!.lastMessage).toMatchObject({ body: "Premier message", deleted: false });
    expect(item!.unreadCount).toBe(1);
  });

  it("accepte directement quand le destinataire suit l'expéditeur ou partage un espace privé avec lui", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const coumba = await createMember("coumba");
    await follow(binta, awa);
    const followed = (await openConversation(awa, binta)).json().conversation;
    expect(followed.participants[0].status).toBe("accepted");

    const space = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie: awa.cookie },
      payload: { name: "dakar", slug: "dakar", visibility: "private" },
    });
    await app.inject({
      method: "POST",
      url: `/api/spaces/${space.json().space.id}/members`,
      headers: { cookie: awa.cookie },
      payload: { handle: "coumba" },
    });
    const sharedSpace = (await openConversation(awa, coumba)).json().conversation;
    expect(sharedSpace.participants[0].status).toBe("accepted");
    expect((await send(awa, sharedSpace.channelId, "Un")).statusCode).toBe(200);
    expect((await send(awa, sharedSpace.channelId, "Deux")).statusCode).toBe(200);
  });

  it("compte un travail co-signé comme une connaissance, jamais une invitation de coauteur en attente", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const coumba = await createMember("coumba");
    await publishWork(awa, "memoire-commun", ["binta", "coumba"]);
    await acceptCoauthorship(binta, "memoire-commun");

    const pendingCoauthor = (await openConversation(awa, coumba)).json().conversation;
    expect(pendingCoauthor.participants[0].status).toBe("pending");
    expect((await openConversation(awa, binta, coumba)).statusCode).toBe(403);

    const coauthor = (await openConversation(binta, awa)).json().conversation;
    expect(coauthor.participants[0].status).toBe("accepted");

    await acceptCoauthorship(coumba, "memoire-commun");
    const betweenCoauthors = (await openConversation(binta, coumba)).json().conversation;
    expect(betweenCoauthors.participants[0].status).toBe("accepted");
    expect((await openConversation(awa, binta, coumba)).statusCode).toBe(200);
  });

  async function publishWork(publisher: Member, slug: string, coauthorHandles: string[]) {
    const response = await app.inject({
      method: "POST",
      url: "/api/works",
      headers: { cookie: publisher.cookie },
      payload: {
        slug,
        title: `Travail ${slug}`,
        type: "thesis_research",
        summary: "Un mémoire sur la synchronisation hors ligne, écrit à plusieurs.",
        tags: ["mobile"],
        stack: ["Flutter"],
        publishRightConfirmed: true,
        coauthorHandles,
      },
    });
    expect(response.statusCode).toBe(200);
  }

  async function acceptCoauthorship(member: Member, slug: string) {
    const response = await app.inject({
      method: "PUT",
      url: `/api/works/${slug}/invitation`,
      headers: { cookie: member.cookie },
      payload: { accepted: true },
    });
    expect(response.statusCode).toBe(200);
  }

  function openTeam(member: Member | null, workSlug: string) {
    return app.inject({
      method: "POST",
      url: "/api/conversations/team",
      headers: member ? { cookie: member.cookie } : {},
      payload: { workSlug },
    });
  }

  it("réunit en privé un lecteur et les auteurs d'un travail, en demande et un seul message avant acceptation", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const coumba = await createMember("coumba");
    const lecteur = await createMember("lecteur");
    await publishWork(awa, "memoire-equipe", ["binta", "coumba"]);
    await acceptCoauthorship(binta, "memoire-equipe");

    const opened = await openTeam(lecteur, "memoire-equipe");
    expect(opened.statusCode).toBe(200);
    const team = opened.json().conversation;
    expect(team.isGroup).toBe(true);
    expect(team.work).toEqual({ slug: "memoire-equipe", title: "Travail memoire-equipe" });
    // Une invitation de coauteur en attente ne fait pas partie de l'équipe.
    expect(team.participants.map((participant: { handle: string }) => participant.handle).sort()).toEqual([
      "awa",
      "binta",
    ]);
    expect(team.participants.every((participant: { status: string }) => participant.status === "pending")).toBe(true);

    expect((await openTeam(lecteur, "memoire-equipe")).json().conversation.id).toBe(team.id);
    expect((await send(lecteur, team.channelId, "Bonjour, j'ai lu votre mémoire.")).statusCode).toBe(200);
    expect((await send(lecteur, team.channelId, "Une autre question.")).statusCode).toBe(403);
    expect((await list(binta, "requests")).map((item) => item.id)).toEqual([team.id]);
    expect(await list(coumba, "requests")).toEqual([]);

    const accept = await app.inject({
      method: "POST",
      url: `/api/conversations/${team.id}/accept`,
      headers: { cookie: binta.cookie },
    });
    expect(accept.statusCode).toBe(200);
    expect((await send(lecteur, team.channelId, "Une autre question.")).statusCode).toBe(200);
  });

  it("refuse une conversation d'équipe sans compte, sans autre auteur, vers un travail absent ou avec un blocage", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const lecteur = await createMember("lecteur");
    await publishWork(awa, "travail-seul", []);
    await publishWork(awa, "travail-binome", ["binta"]);
    await acceptCoauthorship(binta, "travail-binome");

    expect((await openTeam(null, "travail-seul")).statusCode).toBe(401);
    expect((await openTeam(lecteur, "introuvable")).statusCode).toBe(404);
    expect((await openTeam(awa, "travail-seul")).statusCode).toBe(400);

    await app.inject({ method: "PUT", url: "/api/users/lecteur/block", headers: { cookie: binta.cookie } });
    expect((await openTeam(lecteur, "travail-binome")).statusCode).toBe(403);
  });

  it("met chaque auteur en demande, même s'il connaît déjà le lecteur", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const lecteur = await createMember("lecteur");
    await publishWork(awa, "travail-binome", ["binta"]);
    await acceptCoauthorship(binta, "travail-binome");
    // Un auteur complaisant ne lève pas la limite d'un message pour les autres.
    await follow(awa, lecteur);

    const team = (await openTeam(lecteur, "travail-binome")).json().conversation;
    expect(team.participants.map((participant: { status: string }) => participant.status)).toEqual([
      "pending",
      "pending",
    ]);
    expect((await send(lecteur, team.channelId, "Un")).statusCode).toBe(200);
    expect((await send(lecteur, team.channelId, "Deux")).statusCode).toBe(403);
  });

  it("refuse l'équipe d'un travail supprimé ou à un compte suspendu, et ne garde que les auteurs actifs", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const coumba = await createMember("coumba");
    const lecteur = await createMember("lecteur");
    const suspendu = await createMember("suspendu");
    await publishWork(awa, "travail-trio", ["binta", "coumba"]);
    await acceptCoauthorship(binta, "travail-trio");
    await acceptCoauthorship(coumba, "travail-trio");
    await publishWork(awa, "travail-retire", []);

    await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, suspendu.profileId));
    expect((await openTeam(suspendu, "travail-trio")).statusCode).toBe(403);

    await app.inject({ method: "DELETE", url: "/api/works/travail-retire", headers: { cookie: awa.cookie } });
    expect((await openTeam(lecteur, "travail-retire")).statusCode).toBe(404);

    await db.update(profiles).set({ deletedAt: new Date() }).where(eq(profiles.id, coumba.profileId));
    const team = (await openTeam(lecteur, "travail-trio")).json().conversation;
    expect(team.participants.map((participant: { handle: string }) => participant.handle).sort()).toEqual([
      "awa",
      "binta",
    ]);

    await app.inject({ method: "DELETE", url: "/api/works/travail-trio", headers: { cookie: awa.cookie } });
    const detail = await app.inject({
      method: "GET",
      url: `/api/conversations/${team.id}`,
      headers: { cookie: lecteur.cookie },
    });
    expect(detail.json().conversation.work).toBeNull();
  });

  it("refuse une équipe de plus de huit personnes et ne crée qu'une conversation sous deux clics simultanés", async () => {
    const publisher = await createMember("autrice");
    const coauthors: Member[] = [];
    for (const index of [1, 2, 3, 4, 5, 6, 7]) coauthors.push(await createMember(`coauteur${index}`));
    const lecteur = await createMember("lecteur");
    await publishWork(
      publisher,
      "grande-equipe",
      coauthors.map((member) => member.handle),
    );
    for (const member of coauthors) await acceptCoauthorship(member, "grande-equipe");
    expect((await openTeam(lecteur, "grande-equipe")).statusCode).toBe(400);

    await app.inject({
      method: "DELETE",
      url: `/api/works/grande-equipe/authors/${coauthors[0]!.handle}`,
      headers: { cookie: publisher.cookie },
    });
    const [first, second] = await Promise.all([openTeam(lecteur, "grande-equipe"), openTeam(lecteur, "grande-equipe")]);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().conversation.id).toBe(second.json().conversation.id);
    expect(first.json().conversation.participants).toHaveLength(7);
  });

  it("ne révèle pas au lecteur un blocage entre deux auteurs", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const lecteur = await createMember("lecteur");
    await publishWork(awa, "travail-binome", ["binta"]);
    await acceptCoauthorship(binta, "travail-binome");
    await app.inject({ method: "PUT", url: "/api/users/awa/block", headers: { cookie: binta.cookie } });
    expect((await openTeam(lecteur, "travail-binome")).statusCode).toBe(200);
  });

  it("ne compte plus un travail co-signé une fois supprimé", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    await publishWork(awa, "travail-commun", ["binta"]);
    await acceptCoauthorship(binta, "travail-commun");
    await app.inject({ method: "DELETE", url: "/api/works/travail-commun", headers: { cookie: awa.cookie } });
    const conversation = (await openConversation(binta, awa)).json().conversation;
    expect(conversation.participants[0].status).toBe("pending");
  });

  it("ne compte pas un espace public, que n'importe qui rejoint, comme une connaissance", async () => {
    const awa = await createMember("awa");
    const stranger = await createMember("inconnu");
    const space = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie: awa.cookie },
      payload: { name: "ouvert", slug: "ouvert", visibility: "public" },
    });
    await app.inject({
      method: "POST",
      url: `/api/spaces/${space.json().space.id}/members`,
      headers: { cookie: awa.cookie },
      payload: { handle: "inconnu" },
    });
    const conversation = (await openConversation(stranger, awa)).json().conversation;
    expect(conversation.participants[0].status).toBe("pending");
  });

  it("ne laisse personne d'autre lire une conversation, ni par l'API ni en temps réel, administrateur compris", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const intruder = await createMember("intrus");
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, intruder.profileId));
    await follow(binta, awa);
    const conversation = (await openConversation(awa, binta)).json().conversation;
    const message = (await send(awa, conversation.channelId, "Entre nous")).json().message;

    const asIntruder = { cookie: intruder.cookie };
    expect((await app.inject({ method: "GET", url: `/api/conversations/${conversation.id}`, headers: asIntruder })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: `/api/channels/${conversation.channelId}/messages`, headers: asIntruder })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: "GET", url: `/api/channels/${conversation.channelId}/messages` })).statusCode).toBe(404);
    expect((await send(intruder, conversation.channelId, "Je m'invite")).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/api/messages/${message.id}/reactions`,
          headers: asIntruder,
          payload: { emoji: "👍" },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/reports",
          headers: asIntruder,
          payload: { targetType: "message", targetId: message.id, reason: "test" },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/reports",
          headers: asIntruder,
          payload: { targetType: "conversation", targetId: conversation.id, reason: "test" },
        })
      ).statusCode,
    ).toBe(404);

    expect(await canAccessChannel(db, awa.profileId, conversation.channelId)).toBe(true);
    expect(await canAccessChannel(db, binta.profileId, conversation.channelId)).toBe(true);
    expect(await canAccessChannel(db, intruder.profileId, conversation.channelId)).toBe(false);
    expect(await canAccessChannel(db, null, conversation.channelId)).toBe(false);
  });

  it("retire l'accès à qui refuse une demande, en temps réel aussi", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const conversation = (await openConversation(awa, binta)).json().conversation;
    await send(awa, conversation.channelId, "Bonjour");
    const left = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversation.id}/leave`,
      headers: { cookie: binta.cookie },
    });
    expect(left.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/channels/${conversation.channelId}/messages`,
          headers: { cookie: binta.cookie },
        })
      ).statusCode,
    ).toBe(404);
    expect(await canAccessChannel(db, binta.profileId, conversation.channelId)).toBe(false);
    expect(events).toContainEqual({
      type: "conversation:member-left",
      channelId: conversation.channelId,
      profileId: binta.profileId,
    });
    expect(await list(binta, "requests")).toHaveLength(0);
  });

  it("bloque : plus de nouvelle conversation, plus d'écriture, demande en attente retirée", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const coumba = await createMember("coumba");
    const conversation = (await openConversation(awa, binta)).json().conversation;
    await send(awa, conversation.channelId, "Bonjour");

    await follow(coumba, awa);
    const blocked = await app.inject({ method: "PUT", url: "/api/users/awa/block", headers: { cookie: binta.cookie } });
    expect(blocked.statusCode).toBe(200);
    expect(await list(binta, "requests")).toHaveLength(0);

    await follow(binta, awa);
    expect((await openConversation(awa, binta)).statusCode).toBe(403);
    expect((await send(awa, conversation.channelId, "Encore moi")).statusCode).toBe(403);
    const asAwa = await app.inject({ method: "GET", url: `/api/conversations/${conversation.id}`, headers: { cookie: awa.cookie } });
    // La demande a été retirée par le blocage : il ne reste personne en face.
    expect(asAwa.json().conversation.writeBlock).toBe("alone");
    expect((await openConversation(awa, binta, coumba)).statusCode).toBe(403);
    expect((await openConversation(binta, awa)).statusCode).toBe(403);

    const status = await app.inject({ method: "GET", url: "/api/users/awa/block", headers: { cookie: binta.cookie } });
    expect(status.json()).toEqual({ blocked: true });
    const blocks = await app.inject({ method: "GET", url: "/api/me/blocks", headers: { cookie: binta.cookie } });
    expect(blocks.json().items.map((item: { handle: string }) => item.handle)).toEqual(["awa"]);
    const othersBlocks = await app.inject({ method: "GET", url: "/api/me/blocks", headers: { cookie: awa.cookie } });
    expect(othersBlocks.json().items).toEqual([]);
    expect((await app.inject({ method: "GET", url: "/api/me/blocks" })).statusCode).toBe(401);
    await app.inject({ method: "DELETE", url: "/api/users/awa/block", headers: { cookie: binta.cookie } });
    expect((await openConversation(awa, binta, coumba)).statusCode).toBe(200);
  });

  it("ferme l'écriture des deux côtés d'une conversation déjà acceptée quand l'un bloque l'autre", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    await follow(binta, awa);
    const conversation = (await openConversation(awa, binta)).json().conversation;
    expect((await send(awa, conversation.channelId, "Bonjour")).statusCode).toBe(200);
    await app.inject({ method: "PUT", url: "/api/users/awa/block", headers: { cookie: binta.cookie } });

    expect((await send(awa, conversation.channelId, "Encore")).statusCode).toBe(403);
    expect((await send(binta, conversation.channelId, "Moi non plus")).statusCode).toBe(403);
    const asBinta = await app.inject({ method: "GET", url: `/api/conversations/${conversation.id}`, headers: { cookie: binta.cookie } });
    expect(asBinta.json().conversation).toMatchObject({ writeBlock: "blocked", blockedByViewer: true });
    const history = await app.inject({
      method: "GET",
      url: `/api/channels/${conversation.channelId}/messages`,
      headers: { cookie: awa.cookie },
    });
    expect(history.statusCode).toBe(200);
  });

  it("refuse un groupe de plus de huit personnes, ou avec soi-même", async () => {
    const owner = await createMember("owner");
    const others: Member[] = [];
    for (let index = 0; index < 8; index += 1) {
      const member = await createMember(`membre${index}`);
      await follow(member, owner);
      others.push(member);
    }
    expect((await openConversation(owner, ...others)).statusCode).toBe(400);
    const group = await openConversation(owner, ...others.slice(0, 7));
    expect(group.statusCode).toBe(200);
    expect(group.json().conversation.isGroup).toBe(true);
    expect((await openConversation(owner, owner)).statusCode).toBe(400);
  });

  it("refuse un groupe avec quelqu'un qui ne connaît pas le créateur, ou deux personnes qui se bloquent", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const coumba = await createMember("coumba");
    const stranger = await createMember("inconnu");
    await follow(binta, awa);
    await follow(coumba, awa);
    // Un complice qui accepte ne doit pas ouvrir la voie vers un inconnu.
    expect((await openConversation(awa, binta, stranger)).statusCode).toBe(403);
    await app.inject({ method: "PUT", url: "/api/users/coumba/block", headers: { cookie: binta.cookie } });
    expect((await openConversation(awa, binta, coumba)).statusCode).toBe(403);
  });

  it("ne laisse passer qu'un message même envoyé deux fois en parallèle", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const conversation = (await openConversation(awa, binta)).json().conversation;
    const results = await Promise.all([
      send(awa, conversation.channelId, "Premier"),
      send(awa, conversation.channelId, "Second"),
      send(awa, conversation.channelId, "Troisième"),
    ]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([200, 403, 403]);
    // Le renvoi du même message (même clientId) reste accepté.
    const clientId = crypto.randomUUID();
    const other = await createMember("coumba");
    const second = (await openConversation(other, binta)).json().conversation;
    const payload = { clientId, body: "Bonjour" };
    const first = await app.inject({
      method: "POST",
      url: `/api/channels/${second.channelId}/messages`,
      headers: { cookie: other.cookie },
      payload,
    });
    const retry = await app.inject({
      method: "POST",
      url: `/api/channels/${second.channelId}/messages`,
      headers: { cookie: other.cookie },
      payload,
    });
    expect([first.statusCode, retry.statusCode]).toEqual([200, 200]);
    expect(retry.json().message.id).toBe(first.json().message.id);
  });

  it("interdit de modifier, de réagir ou d'envoyer un fichier tant que la demande n'est pas acceptée", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const conversation = (await openConversation(awa, binta)).json().conversation;
    const message = (await send(awa, conversation.channelId, "Bonjour")).json().message;

    const edit = await app.inject({
      method: "PATCH",
      url: `/api/messages/${message.id}`,
      headers: { cookie: awa.cookie },
      payload: { body: "Bonjour, réécrit trente fois" },
    });
    expect(edit.statusCode).toBe(403);
    for (const member of [awa, binta]) {
      const reaction = await app.inject({
        method: "PUT",
        url: `/api/messages/${message.id}/reactions`,
        headers: { cookie: member.cookie },
        payload: { emoji: "👍" },
      });
      expect(reaction.statusCode).toBe(403);
    }
    const boundary = "----kemetdm";
    const upload = await app.inject({
      method: "POST",
      url: `/api/channels/${conversation.channelId}/messages/attachments`,
      headers: { cookie: binta.cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nbonjour\r\n--${boundary}--\r\n`,
      ),
    });
    expect(upload.statusCode).toBe(403);
  });

  it("ferme fils, lecture, fichiers et assistant d'une conversation à qui n'en est pas membre", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const intruder = await createMember("intrus");
    await follow(binta, awa);
    const conversation = (await openConversation(awa, binta)).json().conversation;
    const boundary = "----kemetdm";
    const upload = await app.inject({
      method: "POST",
      url: `/api/channels/${conversation.channelId}/messages/attachments`,
      headers: { cookie: awa.cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="notes.txt"\r\nContent-Type: text/plain\r\n\r\nconfidentiel\r\n--${boundary}--\r\n`,
      ),
    });
    expect(upload.statusCode).toBe(200);
    const attachmentId = upload.json().attachment.id as string;
    const message = (
      await app.inject({
        method: "POST",
        url: `/api/channels/${conversation.channelId}/messages`,
        headers: { cookie: awa.cookie },
        payload: { clientId: crypto.randomUUID(), body: "Voici le fichier", attachmentIds: [attachmentId] },
      })
    ).json().message;

    const asIntruder = { cookie: intruder.cookie };
    const attempts = await Promise.all([
      app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: asIntruder }),
      app.inject({ method: "GET", url: `/api/messages/${message.id}/replies`, headers: asIntruder }),
      app.inject({ method: "GET", url: `/api/messages/${message.id}/assistant-invocation`, headers: asIntruder }),
      app.inject({
        method: "POST",
        url: `/api/channels/${conversation.channelId}/read`,
        headers: asIntruder,
        payload: { messageId: message.id },
      }),
    ]);
    expect(attempts.map((attempt) => attempt.statusCode)).toEqual([404, 404, 404, 404]);
    const asMember = await app.inject({
      method: "GET",
      url: `/api/attachments/${attachmentId}/content`,
      headers: { cookie: binta.cookie },
    });
    expect(asMember.statusCode).toBe(200);
  });

  it("refuse un identifiant de conversation mal formé sans erreur serveur", async () => {
    const awa = await createMember("awa");
    const response = await app.inject({ method: "GET", url: "/api/conversations/pas-un-uuid", headers: { cookie: awa.cookie } });
    expect(response.statusCode).toBe(400);
  });

  it("n'appelle jamais @kocc dans une conversation privée", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    await follow(binta, awa);
    const conversation = (await openConversation(awa, binta)).json().conversation;
    expect((await send(awa, conversation.channelId, "@kocc tu peux résumer ?")).statusCode).toBe(200);
    expect(mentions).toHaveLength(0);
  });

  it("prévient chaque membre d'un nouveau message et compte les non-lus", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    await follow(binta, awa);
    const conversation = (await openConversation(awa, binta)).json().conversation;
    await send(awa, conversation.channelId, "Un");
    await send(awa, conversation.channelId, "Deux");

    const activity = events.filter((event) => event.type === "conversation:activity");
    expect(activity.at(-1)).toMatchObject({ conversationId: conversation.id });
    expect(new Set(activity.at(-1)?.type === "conversation:activity" ? activity.at(-1)!.profileIds : [])).toEqual(
      new Set([awa.profileId, binta.profileId]),
    );

    const summary = await app.inject({ method: "GET", url: "/api/conversations/unread", headers: { cookie: binta.cookie } });
    expect(summary.json()).toEqual({ unreadConversations: 1, pendingRequests: 0 });
    expect((await list(binta, "inbox"))[0]!.unreadCount).toBe(2);
    expect((await list(awa, "inbox"))[0]!.unreadCount).toBe(0);
  });

  it("montre à la modération ce qui a été signalé, jamais ce qui a été écrit après", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const admin = await createMember("admin");
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, admin.profileId));
    const conversation = (await openConversation(awa, binta)).json().conversation;
    await send(awa, conversation.channelId, "Message insistant");

    const report = await app.inject({
      method: "POST",
      url: "/api/reports",
      headers: { cookie: binta.cookie },
      payload: { targetType: "conversation", targetId: conversation.id, reason: "Harcèlement" },
    });
    expect(report.statusCode).toBe(200);
    await app.inject({ method: "POST", url: `/api/conversations/${conversation.id}/leave`, headers: { cookie: binta.cookie } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await app.inject({ method: "POST", url: `/api/conversations/${conversation.id}/accept`, headers: { cookie: binta.cookie } });

    const queue = await app.inject({ method: "GET", url: "/api/reports", headers: { cookie: admin.cookie } });
    const [entry] = queue.json().items;
    expect(entry.targetType).toBe("conversation");
    expect(entry.targetSummary).toContain("@awa : Message insistant");

    const suspended = await app.inject({
      method: "PUT",
      url: `/api/reports/${entry.id}/resolve`,
      headers: { cookie: admin.cookie },
      payload: { action: "suspend" },
    });
    expect(suspended.statusCode).toBe(200);
    const [awaProfile] = await db.select().from(profiles).where(eq(profiles.id, awa.profileId));
    expect(awaProfile!.suspendedAt).not.toBeNull();
  });

  it("n'inclut pas dans l'extrait de signalement un message écrit après", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const admin = await createMember("admin");
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, admin.profileId));
    await follow(binta, awa);
    const conversation = (await openConversation(awa, binta)).json().conversation;
    await send(awa, conversation.channelId, "Avant le signalement");
    await app.inject({
      method: "POST",
      url: "/api/reports",
      headers: { cookie: binta.cookie },
      payload: { targetType: "conversation", targetId: conversation.id, reason: "Spam" },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await send(awa, conversation.channelId, "Après le signalement");

    const queue = await app.inject({ method: "GET", url: "/api/reports", headers: { cookie: admin.cookie } });
    const summary = queue.json().items[0].targetSummary as string;
    expect(summary).toContain("Avant le signalement");
    expect(summary).not.toContain("Après le signalement");
  });

  it("limite plus fort l'ouverture de conversations par un compte créé depuis moins d'un jour", async () => {
    await app.close();
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    app = buildApp({ db, auth, antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 0.25, anonymousIpFactor: 3 } });
    const spammer = await createMember("nouveau");
    const targets: Member[] = [];
    // Dix par minute d'ordinaire, trois pour un compte neuf (10 x 0,25 arrondi).
    for (let index = 0; index < 4; index += 1) targets.push(await createMember(`cible${index}`));
    const statuses = [];
    for (const target of targets) statuses.push((await openConversation(spammer, target)).statusCode);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("ne montre à la modération, pour qui a quitté un groupe, que ce qu'il a pu lire", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const coumba = await createMember("coumba");
    const admin = await createMember("admin");
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, admin.profileId));
    await follow(binta, awa);
    await follow(coumba, awa);
    const group = (await openConversation(awa, binta, coumba)).json().conversation;
    await send(awa, group.channelId, "Avant le départ");
    await app.inject({ method: "POST", url: `/api/conversations/${group.id}/leave`, headers: { cookie: binta.cookie } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await send(coumba, group.channelId, "Écrit après le départ");

    const report = await app.inject({
      method: "POST",
      url: "/api/reports",
      headers: { cookie: binta.cookie },
      payload: { targetType: "conversation", targetId: group.id, reason: "Propos insultants" },
    });
    expect(report.statusCode).toBe(200);
    // Qui signale ne reçoit que les participants, jamais un extrait.
    expect(report.json().report.targetSummary).not.toContain("Avant le départ");

    const queue = await app.inject({ method: "GET", url: "/api/reports", headers: { cookie: admin.cookie } });
    const summary = queue.json().items[0].targetSummary as string;
    expect(summary).toContain("Avant le départ");
    expect(summary).not.toContain("Écrit après le départ");

    // La personne visée est celle du signalement, même si une autre écrit ensuite.
    await send(coumba, group.channelId, "Encore un message");
    await app.inject({
      method: "PUT",
      url: `/api/reports/${queue.json().items[0].id}/resolve`,
      headers: { cookie: admin.cookie },
      payload: { action: "suspend" },
    });
    const [awaProfile] = await db.select().from(profiles).where(eq(profiles.id, awa.profileId));
    const [coumbaProfile] = await db.select().from(profiles).where(eq(profiles.id, coumba.profileId));
    expect(awaProfile!.suspendedAt).not.toBeNull();
    expect(coumbaProfile!.suspendedAt).toBeNull();
  });
});
