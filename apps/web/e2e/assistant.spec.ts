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

// Jamais d'appel réel au modèle en CI : sans les deux clés, la mention part
// mais aucune réponse n'arrive. La réponse n'est vérifiée que si les clés
// sont présentes.
const hasLiveAssistant = Boolean(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.OPENROUTER_API_KEY,
);

test("mentionner @kemet dans un salon envoie la question", async ({ page, request }) => {
  const email = `e2e-assistant-${test.info().project.name}-${Date.now()}@test.kemet`;
  const handle = `e2easst${test.info().project.name}${Date.now()}`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  // Créer l'espace fait partie de la mise en place, pas de ce qui est testé
  // ici : chat.spec.ts couvre le point d'entrée depuis le rail.
  await page.goto("/salons/nouveau");
  await page.getByLabel("Nom").fill(`Espace ${handle}`);
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const composer = page.getByPlaceholder("Écrire un message…");
  await composer.waitFor();
  const question = `@kemet comment vérifier la signature d'un webhook ? ${handle}`;
  await composer.fill(question);
  await page.getByRole("button", { name: "Envoyer" }).click();

  await expect(page.getByText(question)).toBeVisible();

  if (hasLiveAssistant) {
    await expect(page.getByText("kemet").first()).toBeVisible({ timeout: 30_000 });
  }
});
