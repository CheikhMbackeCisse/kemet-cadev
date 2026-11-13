import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Précision du rôle (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let db: Db;
  let emailSender: InMemoryEmailSender;

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    app = buildApp({ db, auth, chat: createNoopChatPublisher() });
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function signIn(handle: string): Promise<string> {
    const email = `${handle}@test.kemet`;
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: handle },
    });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    return extractCookie(response);
  }

  function patchProfile(cookie: string, payload: Record<string, unknown>) {
    return app.inject({ method: "PATCH", url: "/api/me/profile", headers: { cookie }, payload });
  }

  async function createProfile(handle: string, patch: Record<string, unknown> = {}) {
    const cookie = await signIn(handle);
    const response = await patchProfile(cookie, { handle, displayName: handle, ...patch });
    expect(response.statusCode).toBe(200);
    return { cookie, profileId: response.json().profile.id as string };
  }

  function suggestions(cookie: string | undefined, kind: string, q = "") {
    return app.inject({
      method: "GET",
      url: `/api/organizations?kind=${kind}&q=${encodeURIComponent(q)}`,
      headers: cookie ? { cookie } : {},
    });
  }

  it("enregistre l'établissement d'une personne qui étudie et le renvoie dans le profil", async () => {
    const { cookie } = await createProfile("awa", { role: "student" });
    const response = await patchProfile(cookie, { organization: "  EPT  " });
    expect(response.statusCode).toBe(200);
    expect(response.json().profile).toMatchObject({
      role: "student",
      organization: "EPT",
      workMode: null,
    });

    const publicProfile = await app.inject({ method: "GET", url: "/api/users/awa" });
    expect(publicProfile.json().profile.organization).toBe("EPT");
  });

  it("garde la cohérence : un freelance n'a pas d'entreprise, un autre rôle efface la précision", async () => {
    const { cookie } = await createProfile("moussa", {
      role: "developer",
      workMode: "employed",
      organization: "Kobo Market",
    });
    let profile = (await patchProfile(cookie, { workMode: "freelance" })).json().profile;
    expect(profile).toMatchObject({ workMode: "freelance", organization: null });

    profile = (
      await patchProfile(cookie, { workMode: "employed", organization: "Sahel Data" })
    ).json().profile;
    expect(profile).toMatchObject({ workMode: "employed", organization: "Sahel Data" });

    profile = (await patchProfile(cookie, { role: "hr" })).json().profile;
    expect(profile).toMatchObject({ role: "hr", workMode: null, organization: null });

    profile = (await patchProfile(cookie, { role: "designer", organization: "Studio" })).json()
      .profile;
    expect(profile).toMatchObject({ role: "designer", organization: null });
  });

  it("refuse un mode de travail inconnu et un nom trop long", async () => {
    const { cookie } = await createProfile("lina", { role: "developer" });
    expect((await patchProfile(cookie, { workMode: "salarie" })).statusCode).toBe(400);
    expect((await patchProfile(cookie, { organization: "x".repeat(81) })).statusCode).toBe(400);
  });

  it("suggère les établissements déjà saisis, sans compte supprimé, suspendu ni figurant", async () => {
    const { cookie } = await createProfile("viewer", { role: "student" });
    await createProfile("etudiant1", { role: "student", organization: "EPT" });
    await createProfile("etudiant2", { role: "student", organization: "ept" });
    await createProfile("etudiant3", { role: "student", organization: "UCAD" });
    const suspended = await createProfile("etudiant4", {
      role: "student",
      organization: "Lycée suspendu",
    });
    const deleted = await createProfile("etudiant5", {
      role: "student",
      organization: "École supprimée",
    });
    const filler = await createProfile("etudiant6", {
      role: "student",
      organization: "Institut figurant",
    });
    await createProfile("developpeur", {
      role: "developer",
      workMode: "employed",
      organization: "Kobo Market",
    });
    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.id, suspended.profileId));
    await db
      .update(profiles)
      .set({ deletedAt: new Date() })
      .where(eq(profiles.id, deleted.profileId));
    await db.update(profiles).set({ isFiller: true }).where(eq(profiles.id, filler.profileId));

    const schools = (await suggestions(cookie, "school")).json().items;
    expect(schools).toEqual(["EPT", "UCAD"]);
    expect((await suggestions(cookie, "school", "uc")).json().items).toEqual(["UCAD"]);
    expect((await suggestions(cookie, "company")).json().items).toEqual(["Kobo Market"]);
  });

  it("traite % et _ comme du texte et refuse un visiteur", async () => {
    const { cookie } = await createProfile("viewer", { role: "student" });
    await createProfile("etudiant1", { role: "student", organization: "EPT" });
    expect((await suggestions(cookie, "school", "%")).json().items).toEqual([]);
    expect((await suggestions(cookie, "school", "_")).json().items).toEqual([]);
    expect((await suggestions(undefined, "school")).statusCode).toBe(401);
    expect((await suggestions(cookie, "autre")).statusCode).toBe(400);
  });

  it("efface la précision à la suppression du compte", async () => {
    const { cookie, profileId } = await createProfile("partant", {
      role: "developer",
      workMode: "employed",
      organization: "Kobo Market",
    });
    const response = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie },
      payload: { password: "une-passphrase-solide" },
    });
    expect(response.statusCode).toBe(204);
    const [row] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    expect(row).toMatchObject({ workMode: null, organization: null });
  });
});
