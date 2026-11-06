import { expect, test, type APIRequestContext } from "@playwright/test";
import { createPublicSpace } from "./support/spaces.js";
import { expectVisitorInvitation } from "./support/visitor.js";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const PASSWORD = "une-passphrase-solide";

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
}

async function findVerificationUrl(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const list = await fetch(`${MAILPIT_URL}/api/v1/messages`).then((response) => response.json());
    const message = (list.messages as MailpitMessage[]).find((candidate) =>
      candidate.To.some((recipient) => recipient.Address === email),
    );
    if (message) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`).then((response) =>
        response.json(),
      );
      const match = (detail.HTML as string).match(/href="([^"]+)"/);
      if (match) return match[1]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Email de vérification introuvable pour ${email}.`);
}

async function signUpVerifyAndSignIn(
  request: APIRequestContext,
  email: string,
  handle: string,
): Promise<void> {
  await request.post("/api/auth/sign-up/email", {
    data: { email, password: PASSWORD, name: handle },
  });
  const verificationUrl = new URL(await findVerificationUrl(email));
  await request.get(verificationUrl.pathname + verificationUrl.search);
  await request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
  await request.patch("/api/me/profile", { data: { handle, displayName: handle, country: "SN" } });
}

test("une inscription complète par l'interface mène jusqu'au fil", async ({ page }) => {
  const email = `e2e-auth-${test.info().project.name}-${Date.now()}@test.kemet`;
  const handle = `e2eauth${test.info().project.name}${Date.now()}`;
  const name = `Inscrite ${handle}`;

  await page.goto("/inscription");
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page.getByText("Vérifie ton adresse email")).toBeVisible();

  const verificationUrl = new URL(await findVerificationUrl(email));
  await page.request.get(verificationUrl.pathname + verificationUrl.search);

  await page.getByRole("button", { name: "Me connecter" }).click();

  await expect(page).toHaveURL(/\/completer-profil/);
  await page.getByLabel("Nom affiché").fill(name);
  await page.getByLabel("Identifiant").fill(handle);
  await page.getByRole("button", { name: "Continuer" }).click();

  // L'onboarding se passe écran par écran ; son parcours complet est testé
  // dans onboarding.spec.ts.
  await expect(page).toHaveURL(/\/bienvenue\/pays/);
  for (let screen = 1; screen <= 6; screen += 1) {
    await expect(page.getByText(`Étape ${screen} sur 6`)).toBeVisible();
    await page.getByRole("button", { name: "Passer" }).click();
  }

  await expect(page).toHaveURL(/\/fil/);
  await expect(page.getByRole("button", { name: name, exact: false })).toBeVisible();
});

test("un visiteur sans session parcourt un espace public et le fil sans composeur", async ({
  page,
  request,
  isMobile,
}) => {
  // `request` est un contexte API indépendant du navigateur de `page` : les
  // cookies de session du propriétaire de l'espace n'atteignent jamais
  // `page`, qui reste le visiteur anonyme de ce test.
  const ownerEmail = `e2e-visitor-owner-${test.info().project.name}-${Date.now()}@test.kemet`;
  const ownerHandle = `e2evisitor${test.info().project.name}${Date.now()}`;
  await signUpVerifyAndSignIn(request, ownerEmail, ownerHandle);

  const spaceName = `Espace visiteur ${ownerHandle}`;
  const { spaceId, generalId } = await createPublicSpace(
    request,
    spaceName,
    `visitor-${ownerHandle}`.toLowerCase(),
  );
  await request.post(`/api/channels/${generalId}/messages`, {
    data: { clientId: crypto.randomUUID(), body: "Visible sans compte, mode visiteur" },
  });

  // `page` n'a jamais signé en : c'est le visiteur de ce test.
  await page.goto(`/salons?space=${spaceId}&channel=${generalId}`);
  await expectVisitorInvitation(page, isMobile);
  await expect(page.getByText("Visible sans compte, mode visiteur")).toBeVisible();
  await expect(page.getByPlaceholder("Écrire un message…")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Se connecter", exact: true })).toBeVisible();

  await page.goto("/fil");
  await expectVisitorInvitation(page, isMobile);
  await expect(page.getByPlaceholder("Partager quelque chose…")).toHaveCount(0);
});
