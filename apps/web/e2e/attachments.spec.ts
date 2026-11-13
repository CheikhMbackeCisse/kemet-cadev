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

test("envoie une image dans un salon et la voit affichée en ligne", async ({ page, request }) => {
  const email = `e2e-attach-${test.info().project.name}-${Date.now()}@test.kemet`;
  // Pas de troncature : couper les derniers chiffres de Date.now() ferait
  // collisionner deux essais lancés à quelques dizaines de ms d'écart (un
  // essai et sa relance en CI, par exemple), rejetant la mise à jour du
  // profil avec un conflit d'identifiant.
  const handle = `e2eatt${test.info().project.name}${Date.now()}`;
  const fileName = `photo-${handle}.png`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  // Créer l'espace fait partie de la mise en place, pas de ce qui est testé
  // ici : chat.spec.ts couvre le point d'entrée depuis le rail.
  await page.goto("/salons/nouveau");
  await page.getByLabel("Nom").fill(`Espace ${handle}`);
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const composer = page.getByPlaceholder("Écrire un message…");
  // Le champ de fichier existe avant qu'un salon soit actif : attendre sa
  // seule présence laisserait handleFileSelected ignorer la sélection.
  await expect(composer).toBeEnabled();

  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "image/png",
    buffer: PNG_BYTES,
  });
  await expect(page.getByText(fileName)).toBeVisible();

  await page.getByRole("button", { name: "Envoyer" }).click();

  await expect(page.getByAltText(fileName)).toBeVisible();
});
