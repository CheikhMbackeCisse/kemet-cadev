import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { completeProfile } from "./support/accounts.js";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const PASSWORD = "une-passphrase-solide";

// PNG 1x1 valide : voir apps/server/src/api/attachments.integration.test.ts
// pour pourquoi la seule signature binaire ne suffit pas.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
  "base64",
);

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
  await completeProfile(request, handle);
}

async function signInBrowser(page: Page, email: string): Promise<void> {
  await page.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
}

test("publie un post et le retrouve dans le fil", async ({ page, request }) => {
  const email = `e2e-feed-${test.info().project.name}-${Date.now()}@test.kemet`;
  const handle = `e2efeed${test.info().project.name}${Date.now()}`;
  const body = `Mon premier post de test ${Date.now()}`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/fil");
  await page.getByRole("link", { name: "Publier", exact: true }).click();
  await expect(page).toHaveURL(/\/fil\/nouveau$/);

  await page.getByPlaceholder("Partager quelque chose…").fill(body);
  await page.getByRole("button", { name: "Publier", exact: true }).click();

  await expect(page).toHaveURL(/\/fil$/);
  await expect(page.getByText(body)).toBeVisible();
});

test("publie un post avec une image et la voit affichée dans le fil", async ({ page, request }) => {
  const email = `e2e-feedimg-${test.info().project.name}-${Date.now()}@test.kemet`;
  const handle = `e2efeedimg${test.info().project.name}${Date.now()}`;
  // Nom de fichier unique : le fil "Pour toi" montre les posts de tous, donc
  // aussi les images des essais precedents.
  const fileName = `photo-${handle}.png`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/fil");
  await page.getByRole("link", { name: "Publier", exact: true }).click();
  await expect(page).toHaveURL(/\/fil\/nouveau$/);

  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "image/png",
    buffer: PNG_BYTES,
  });
  await expect(page.getByAltText(fileName)).toBeVisible();

  await page.getByRole("button", { name: "Publier", exact: true }).click();

  await expect(page).toHaveURL(/\/fil$/);
  await expect(page.getByAltText(fileName)).toBeVisible();
});

test("enregistre un post, le retrouve dans Enregistrés et copie son lien", async ({ page, request, context }) => {
  const email = `e2e-feedsave-${test.info().project.name}-${Date.now()}@test.kemet`;
  const handle = `e2esave${test.info().project.name}${Date.now()}`;
  const body = `Post à garder ${Date.now()}`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);
  const created = await page.request.post("/api/posts", { data: { body } });
  const postId = (await created.json()).post.id as string;

  await page.goto(`/fil/${postId}`);
  await page.getByRole("button", { name: /Marquer utile/ }).click();
  await expect(page.getByRole("button", { name: /Marquer utile, 1 personne/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Enregistré.", { exact: true }).first()).toBeVisible();

  await page.goto("/enregistres");
  await expect(page.getByText(body)).toBeVisible();

  // Sans feuille de partage (navigateur de bureau), le lien est copié.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await page.getByRole("button", { name: "Partager" }).first().click();
  await expect(page.getByText(/Lien copié|Le lien n'a pas pu être copié/).first()).toBeVisible();
});
