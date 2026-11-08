import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
export const PASSWORD = "une-passphrase-solide";

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

const PROFILE_ATTEMPTS = 3;

/**
 * Pose l'identifiant, le nom et le pays d'un compte neuf. Tous les parcours
 * partagent l'adresse IP du runner, clé de la limite de PATCH
 * /api/me/profile (20 par minute) : un 429 attend la fenêtre suivante, comme
 * createPublicSpace. Sans cette vérification, un profil refusé faisait échouer
 * plus loin un parcours qui n'avait rien à voir.
 */
export async function completeProfile(request: APIRequestContext, handle: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const response = await request.patch("/api/me/profile", {
      data: { handle, displayName: handle, country: "SN" },
    });
    if (response.status() === 429 && attempt < PROFILE_ATTEMPTS) {
      const waitMs = (Number(response.headers()["retry-after"] ?? "60") + 1) * 1000;
      test.info().setTimeout(test.info().timeout + waitMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }
    expect(response.ok(), `PATCH /api/me/profile : ${response.status()}`).toBe(true);
    return;
  }
}

/** Crée un compte vérifié avec un profil complet, connecté dans `request`. */
export async function signUpVerifyAndSignIn(
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

export async function signInBrowser(page: Page, email: string): Promise<void> {
  await page.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
}

/**
 * Identifiant unique par projet et par essai. Le préfixe tient en 10
 * caractères : avec "desktop" et les 13 chiffres de Date.now(), l'identifiant
 * atteint la limite de 30 de handleSchema. Pas de troncature de
 * Date.now() : un essai et sa relance en CI, à quelques dizaines de ms
 * d'écart, entreraient en conflit sur l'identifiant.
 */
export function uniqueHandle(prefix: string, projectName: string): string {
  return `${prefix}${projectName}${Date.now()}`;
}
