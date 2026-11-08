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

test("envoie un message dans un salon et le voit apparaître", async ({
  page,
  request,
}) => {
  const email = `e2e-${test.info().project.name}-${Date.now()}@test.kemet`;
  // Pas de troncature : couper les derniers chiffres de Date.now() ferait
  // collisionner deux essais lancés à quelques dizaines de ms d'écart (un
  // essai et sa relance en CI, par exemple), rejetant la mise à jour du
  // profil avec un conflit d'identifiant.
  const handle = `e2e${test.info().project.name}${Date.now()}`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/salons");
  // « Créer un espace » est dans le panneau latéral sur grand écran, et en
  // bas de la colonne des espaces sous lg. Le raccourci de l'état vide ne
  // convient pas, la base de démonstration de la CI fournit déjà des espaces publics.
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

test("sépare les messages par jour et ne montre leurs actions qu'à la demande", async ({
  page,
  request,
}) => {
  const email = `e2e-day-${test.info().project.name}-${Date.now()}@test.kemet`;
  const handle = `e2eday${test.info().project.name}${Date.now()}`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/salons/nouveau");
  await page.getByLabel("Nom").fill(`Espace ${handle}`);
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const composer = page.getByPlaceholder("Écrire un message…");
  await composer.waitFor();
  const message = `Message du jour ${handle}`;
  await composer.fill(message);
  await page.getByRole("button", { name: "Envoyer" }).click();
  const messageList = page.getByRole("log", { name: "Messages du salon" });
  await expect(messageList.getByText(message)).toBeVisible();

  await expect(messageList.getByRole("separator", { name: "Aujourd'hui" })).toBeVisible();

  // Pointeur hors du message : sur bureau, le survol suffit à montrer les actions.
  await page.mouse.move(0, 0);
  // L'opacité se lit sur la barre : elle ne s'hérite pas, le bouton qu'elle
  // contient garde toujours la sienne à 1.
  const actions = messageList.getByRole("toolbar", { name: "Actions du message" });
  const addReaction = actions.getByRole("button", { name: "Ajouter une réaction" });
  await expect(actions).toHaveCSS("opacity", "0");

  // Un clic sur le texte montre les actions : c'est le geste du mobile, et
  // sur bureau le survol qui l'accompagne les montre aussi.
  await messageList.getByText(message).click();
  await expect(actions).toHaveCSS("opacity", "1");
  await addReaction.click();
  await expect(page.getByRole("button", { name: /👍/ })).toBeVisible();
});
