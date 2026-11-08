import { expect, test, type APIRequestContext } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const PASSWORD = "une-passphrase-solide";
const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
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

async function signUp(request: APIRequestContext, email: string, handle: string): Promise<void> {
  await request.post("/api/auth/sign-up/email", {
    data: { email, password: PASSWORD, name: handle },
  });
  const verificationUrl = new URL(await findVerificationUrl(email));
  await request.get(verificationUrl.pathname + verificationUrl.search);
  await request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
  await request.patch("/api/me/profile", { data: { handle, displayName: handle, country: "SN" } });
}

test("un travail montre sa couverture, sa galerie et sa vidéo YouTube chargée au clic", async ({
  page,
}) => {
  const stamp = `${test.info().project.name}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const email = `e2e-works-${stamp}@test.kemet`;
  const slug = `travail-media-${stamp}`;
  await signUp(page.request, email, `e2ework${Date.now()}`);

  const upload = await page.request.post("/api/works/media", {
    multipart: { file: { name: "couverture.png", mimeType: "image/png", buffer: PNG_BYTES } },
  });
  expect(upload.ok()).toBe(true);
  const coverId = (await upload.json()).media.id as string;

  const created = await page.request.post("/api/works", {
    data: {
      slug,
      title: "Un travail illustré",
      type: "application",
      summary: "Une application présentée par une couverture et une vidéo de démonstration.",
      tags: ["demo"],
      stack: [],
      publishRightConfirmed: true,
      links: [],
      media: {
        media: [{ id: coverId, role: "cover" }],
        youtubeUrls: ["https://youtu.be/dQw4w9WgXcQ"],
      },
    },
  });
  expect(created.ok()).toBe(true);

  await page.goto("/travaux");
  await expect(page.locator(`img[src="/api/work-media/${coverId}/content"]`).first()).toBeVisible();

  await page.goto(`/travaux/${slug}`);
  await expect(page.getByRole("img", { name: "Couverture de Un travail illustré" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: /sur YouTube/ }).click();
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
  );

  await page.goto(`/travaux/${slug}/modifier`);
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "ecran.png",
    mimeType: "image/png",
    buffer: PNG_BYTES,
  });
  await expect(page.getByRole("button", { name: "Retirer ecran.png" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/travaux/${slug}$`));
  await expect(page.getByRole("link", { name: "Ouvrir l'image 1 en grand" })).toBeVisible();
});
