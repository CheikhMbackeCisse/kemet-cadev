import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, spaces, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Onboarding (base Postgres réelle)", () => {
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

  async function createProfile(
    handle: string,
    patch: Record<string, unknown> = {},
  ): Promise<{ cookie: string; profileId: string }> {
    const cookie = await signIn(handle);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, ...patch },
    });
    expect(response.statusCode).toBe(200);
    return { cookie, profileId: response.json().profile.id };
  }

  function me(cookie: string) {
    return app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
  }

  function patchOnboarding(cookie: string, payload: Record<string, unknown>) {
    return app.inject({ method: "PATCH", url: "/api/me/onboarding", headers: { cookie }, payload });
  }

  async function createSpace(cookie: string, name: string, slug: string, visibility: "public" | "private", description?: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie },
      payload: { name, slug, visibility, description },
    });
    return response.json().space.id as string;
  }

  it("crée un profil sans pays et commence l'onboarding au premier écran", async () => {
    const { cookie } = await createProfile("awa");
    const body = (await me(cookie)).json();
    expect(body.profile.country).toBe("");
    expect(body.onboarding).toEqual({ step: "country", completed: false, interests: [] });
  });

  it("garde l'écran atteint, puis le parcours terminé pour de bon", async () => {
    const { cookie } = await createProfile("awa");

    expect((await patchOnboarding(cookie, { step: "interests" })).statusCode).toBe(200);
    expect((await me(cookie)).json().onboarding.step).toBe("interests");

    await patchOnboarding(cookie, { completed: true });
    const [first] = await db.select().from(profiles).where(eq(profiles.handle, "awa"));
    await patchOnboarding(cookie, { completed: true, step: "country" });
    const [second] = await db.select().from(profiles).where(eq(profiles.handle, "awa"));

    expect((await me(cookie)).json().onboarding.completed).toBe(true);
    expect(second!.onboardingCompletedAt).toEqual(first!.onboardingCompletedAt);
  });

  it("refuse un sujet inconnu, un champ en trop et une requête vide", async () => {
    const { cookie } = await createProfile("awa");
    expect((await patchOnboarding(cookie, { interests: ["web", "cuisine"] })).statusCode).toBe(400);
    expect((await patchOnboarding(cookie, { step: "people", country: "SN" })).statusCode).toBe(400);
    expect((await patchOnboarding(cookie, {})).statusCode).toBe(400);
    expect((await patchOnboarding(cookie, { completed: false })).statusCode).toBe(400);
  });

  it("exige une session et un profil", async () => {
    const anonymous = await app.inject({ method: "PATCH", url: "/api/me/onboarding", payload: { step: "role" } });
    expect(anonymous.statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/me/onboarding/people" })).statusCode).toBe(401);

    const cookie = await signIn("sansprofil");
    expect((await patchOnboarding(cookie, { step: "role" })).statusCode).toBe(400);
  });

  it("refuse l'écriture à un compte suspendu", async () => {
    const { cookie, profileId } = await createProfile("awa");
    await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, profileId));
    expect((await patchOnboarding(cookie, { step: "role" })).statusCode).toBe(403);
  });

  it("propose toujours CADEV 2026, puis les espaces publics qui parlent des sujets choisis", async () => {
    const owner = await createProfile("hote", { country: "SN" });
    const cadev = await createSpace(owner.cookie, "CADEV 2026", "cadev-2026", "public");
    const flutter = await createSpace(owner.cookie, "Flutter Afrique", "flutter", "public", "Applications mobiles et Android");
    await createSpace(owner.cookie, "Cuisine", "cuisine", "public", "Recettes du dimanche");
    await createSpace(owner.cookie, "Mobile privé", "mobile-prive", "private", "Applications mobiles");

    const { cookie } = await createProfile("awa");
    let response = await app.inject({ method: "GET", url: "/api/me/onboarding/spaces", headers: { cookie } });
    expect(response.json().items.map((space: { id: string }) => space.id)).toEqual([cadev]);

    await patchOnboarding(cookie, { interests: ["mobile"] });
    response = await app.inject({ method: "GET", url: "/api/me/onboarding/spaces", headers: { cookie } });
    const items = response.json().items as { id: string; role: string | null }[];
    expect(items.map((space) => space.id)).toEqual([cadev, flutter]);
    expect(items.every((space) => space.role === null)).toBe(true);
  });

  it("rejoint seulement un espace public, et le dit dans les suggestions", async () => {
    const owner = await createProfile("hote", { country: "SN" });
    const cadev = await createSpace(owner.cookie, "CADEV 2026", "cadev-2026", "public");
    const hidden = await createSpace(owner.cookie, "Privé", "prive", "private");
    const { cookie } = await createProfile("awa");

    const join = (spaceId: string) =>
      app.inject({ method: "POST", url: `/api/spaces/${spaceId}/join`, headers: { cookie } });
    expect((await join(cadev)).statusCode).toBe(200);
    expect((await join(cadev)).statusCode).toBe(200);
    expect((await join(hidden)).statusCode).toBe(404);

    const response = await app.inject({ method: "GET", url: "/api/me/onboarding/spaces", headers: { cookie } });
    expect(response.json().items[0]).toMatchObject({ id: cadev, role: "member", memberCount: 2 });

    await db.update(spaces).set({ archivedAt: new Date() }).where(eq(spaces.id, cadev));
    expect((await join(cadev)).statusCode).toBe(403);
  });

  it("suggère cinq personnes classées par sujets communs et pays, jamais soi-même ni l'assistant", async () => {
    await createProfile("mobile-sn", { country: "SN", title: "Développeuse Flutter" });
    await createProfile("mobile-gh", { country: "GH", stack: ["Kotlin", "Android"] });
    await createProfile("web-sn", { country: "SN", title: "Frontend React" });
    await createProfile("autre-ke", { country: "KE", title: "Comptable" });
    await createProfile("autre-ng", { country: "NG" });
    await createProfile("autre-ci", { country: "CI" });
    const suspended = await createProfile("suspendu", { country: "SN", title: "Flutter" });
    await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, suspended.profileId));

    const { cookie } = await createProfile("awa", { country: "SN" });
    await patchOnboarding(cookie, { interests: ["mobile"] });
    await app.inject({ method: "POST", url: "/api/users/web-sn/follow", headers: { cookie } });

    const response = await app.inject({ method: "GET", url: "/api/me/onboarding/people", headers: { cookie } });
    const items = response.json().items as { profile: { handle: string }; isFollowed: boolean; level: string }[];
    const handles = items.map((item) => item.profile.handle);

    expect(handles).toHaveLength(5);
    expect(handles.slice(0, 3)).toEqual(["mobile-sn", "mobile-gh", "web-sn"]);
    expect(handles).not.toContain("awa");
    expect(handles).not.toContain("kemet");
    expect(handles).not.toContain("suspendu");
    expect(items.find((item) => item.profile.handle === "web-sn")!.isFollowed).toBe(true);
    expect(items[0]!.level).toBe("apprenti");
  });

  it("suggère des personnes sans sujet ni pays choisis", async () => {
    await createProfile("ami", { country: "SN" });
    const { cookie } = await createProfile("awa");

    const response = await app.inject({ method: "GET", url: "/api/me/onboarding/people", headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { profile: { handle: string } }) => item.profile.handle)).toEqual(["ami"]);
  });
});
