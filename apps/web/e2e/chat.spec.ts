import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

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
  await request.patch("/api/me/profile", {
    data: { handle, displayName: handle, country: "SN" },
  });
}

async function signInBrowser(page: Page, email: string): Promise<void> {
  await page.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
}

test("envoie un message dans un salon et le voit apparaître", async ({ page, request }) => {
  const email = `e2e-${test.info().project.name}-${Date.now()}@test.kemet`;
  // Pas de troncature : couper les derniers chiffres de Date.now() ferait
  // collisionner deux essais lancés à quelques dizaines de ms d'écart (un
  // essai et sa relance en CI, par exemple), rejetant la mise à jour du
  // profil avec un conflit d'identifiant.
  const handle = `e2e${test.info().project.name}${Date.now()}`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/salons");
  // « Créer un espace » est un bouton dans le rail sur grand écran et un lien
  // dans l'en-tête sous lg : on prend celui des deux qui est visible. Le
  // raccourci de l'état vide ne convient pas, la base de démonstration de la
  // CI fournit déjà des espaces publics.
  await page
    .getByRole("button", { name: "Créer un espace" })
    .or(page.getByRole("link", { name: "Créer un espace" }))
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/salons\/nouveau$/);
  await page.getByLabel("Nom").fill(`Espace ${handle}`);
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const composer = page.getByPlaceholder("Écrire un message…");
  await composer.waitFor();
  const message = `Bonjour depuis le test bout en bout ${handle}`;
  await composer.fill(message);
  await page.getByRole("button", { name: "Envoyer" }).click();

  await expect(page.getByText(message)).toBeVisible();
});
