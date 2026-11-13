import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { completeProfile } from "./support/accounts.js";

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
  await completeProfile(request, handle);
}

async function signInBrowser(page: Page, email: string): Promise<void> {
  await page.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
}

// Le corps de chaque contenu tente deux injections : une balise HTML qui
// exécuterait du JavaScript si elle était interprétée, et un lien
// javascript:. Les deux doivent rester inoffensives, la balise affichée
// telle quelle comme du texte.
const INJECTION =
  '<img src=x onerror="window.kemetInjected = true"> [piège](javascript:window.kemetInjected=true)';

async function expectInjectionNeutralized(page: Page): Promise<void> {
  // La couverture d'un skill reprend le début de son contenu en décor
  // (aria-hidden) : seul le rendu lu par tous compte ici.
  const readable = page.locator(':not([aria-hidden="true"] *)');
  await expect(
    page.getByText('<img src=x onerror="window.kemetInjected = true">').and(readable),
  ).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByText("piège", { exact: true }).and(readable)).toBeVisible();
  await expect(page.locator('a[href^="javascript"]')).toHaveCount(0);
  expect(await page.evaluate(() => "kemetInjected" in window)).toBe(false);
}

function uniqueIdentity(prefix: string) {
  const suffix = `${test.info().project.name}${Date.now()}`;
  return { email: `e2e-${prefix}-${suffix}@test.kemet`, handle: `e2e${prefix}${suffix}` };
}

test("un message de salon n'exécute ni HTML ni lien javascript:", async ({ page, request }) => {
  const { email, handle } = uniqueIdentity("xm");
  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/salons/nouveau");
  await page.getByLabel("Nom").fill(`Espace ${handle}`);
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const composer = page.getByPlaceholder("Écrire un message…");
  await composer.waitFor();
  await composer.fill(INJECTION);
  await page.getByRole("button", { name: "Envoyer" }).click();

  await expectInjectionNeutralized(page);
});

test("un post n'exécute ni HTML ni lien javascript:", async ({ page, request }) => {
  const { email, handle } = uniqueIdentity("xp");
  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  const response = await page.request.post("/api/posts", { data: { body: INJECTION } });
  expect(response.ok()).toBe(true);
  const { post } = (await response.json()) as { post: { id: string } };

  await page.goto(`/fil/${post.id}`);
  await expectInjectionNeutralized(page);
});

test("un skill n'exécute ni HTML ni lien javascript:", async ({ page, request }) => {
  const { email, handle } = uniqueIdentity("xs");
  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  const slug = `xss-${handle.toLowerCase()}`.slice(0, 60);
  const response = await page.request.post("/api/skills", {
    data: {
      slug,
      name: "Skill piégé",
      description: "Un skill dont le contenu tente une injection.",
      content: INJECTION,
    },
  });
  expect(response.ok()).toBe(true);

  await page.goto(`/skills/${slug}`);
  await expectInjectionNeutralized(page);
});

test("un bloc de code s'affiche coloré, avec son langage et le bouton Copier", async ({
  page,
  request,
}) => {
  const { email, handle } = uniqueIdentity("cb");
  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  const response = await page.request.post("/api/posts", {
    data: { body: "Exemple :\n\n```ts\nconst total: number = 2;\n```" },
  });
  const { post } = (await response.json()) as { post: { id: string } };

  await page.goto(`/fil/${post.id}`);
  const block = page.locator("pre", { hasText: "const total: number = 2;" });
  await expect(block).toBeVisible();
  await expect(block.locator(".shiki-token").first()).toBeVisible();
  await expect(page.getByText("ts", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copier le code ts" })).toBeVisible();
});
