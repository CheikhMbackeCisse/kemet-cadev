import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInBrowser, signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";

// PNG 1x1 valide, comme dans feed.spec.ts.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
  "base64",
);
// Vidéo WebM d'une seconde, la même que les tests du serveur. Chromium de
// Playwright lit le WebM, pas forcément le H.264 d'un MP4.
const CLIP_WEBM = readFileSync(
  new URL("../../../packages/shared/src/fixtures/clip.webm", import.meta.url),
);

test.describe.configure({ timeout: 90_000 });

async function signUpAndOpenComposer(page: Page, prefix: string, projectName: string) {
  const handle = uniqueHandle(prefix, projectName);
  const email = `e2e-${handle}@test.kemet`;
  await signUpVerifyAndSignIn(page.request, email, handle);
  await signInBrowser(page, email);
  await page.goto("/fil/nouveau");
  return handle;
}

// Le post s'ouvre par son identifiant : dans une base déjà remplie, un post
// neuf sans cœur n'est pas forcément sur la première page de "Pour toi".
async function publishAndOpen(page: Page, body: string) {
  await page.getByPlaceholder("Partager quelque chose…").fill(body);
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === "/api/posts",
  );
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  const { post } = (await (await created).json()) as { post: { id: string } };
  await expect(page).toHaveURL(/\/fil$/);
  await page.goto(`/fil/${post.id}`);
}

// Un vrai geste tactile, envoyé par le protocole de Chrome comme le ferait un
// écran de téléphone (voir tab-swipe.spec.ts).
async function swipeLeft(page: Page, on: Locator) {
  const box = await on.boundingBox();
  if (!box) throw new Error("élément hors de l'écran");
  const y = box.y + box.height / 2;
  const [fromX, toX] = [box.x + box.width * 0.85, box.x + box.width * 0.15];
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(fromX) });
  for (let step = 1; step <= 6; step += 1) {
    const x = fromX + ((toX - fromX) * step) / 6;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(x) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("un carrousel de deux images se fait défiler au doigt sans quitter le post", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "geste propre au téléphone");
  const handle = await signUpAndOpenComposer(page, "e2ecarou", test.info().project.name);
  const images = page.locator('input[type="file"][accept="image/*"]');
  for (const position of [1, 2]) {
    const name = `carte-${position}-${handle}.png`;
    await images.setInputFiles({ name, mimeType: "image/png", buffer: PNG_BYTES });
    await expect(page.getByAltText(name)).toBeVisible();
  }
  await publishAndOpen(page, `Deux cartes ${handle}`);

  const carousel = page.getByRole("group", { name: /2 images/ });
  await expect(carousel.getByText("1/2")).toBeVisible();
  const url = page.url();
  await swipeLeft(page, carousel.getByRole("group", { name: "1 sur 2", exact: true }));
  await expect(carousel.getByText("2/2")).toBeVisible();
  expect(page.url()).toBe(url);
});

test("une vidéo publiée se lit dans le post et s'ouvre en plein écran", async ({ page }) => {
  const handle = await signUpAndOpenComposer(page, "e2evideo", test.info().project.name);
  const name = `clip-${handle}.webm`;
  await page
    .locator('input[type="file"][accept="video/mp4,video/webm"]')
    .setInputFiles({ name, mimeType: "video/webm", buffer: CLIP_WEBM });
  // Aperçu tiré dans le navigateur, puis vidéo envoyée.
  await expect(page.getByAltText(name)).toBeVisible();
  await publishAndOpen(page, `Ma vidéo ${handle}`);

  // Une seule vidéo sur la page du post ; son nom accessible est celui de
  // l'auteur, pas celui du fichier.
  const inline = page.locator("main video");
  await expect(inline).toHaveCount(1);
  await expect(inline).toBeVisible();
  const label = await inline.getAttribute("aria-label");
  expect(label).toMatch(/^Vidéo de /);
  await expect.poll(() => inline.evaluate((video: HTMLVideoElement) => video.muted)).toBe(true);

  // Toucher la vidéo ouvre la vue plein écran : plus de bouton à part.
  await expect(page.getByRole("button", { name: "Voir en plein écran" })).toHaveCount(0);
  await page.getByRole("link", { name: `${label}, voir en plein écran` }).click();
  await expect(page).toHaveURL(/\/videos\/[0-9a-f-]{36}$/);
  await expect(page).toHaveTitle(/Vidéos/);
  const fullscreen = page.locator(`main section video[aria-label="${label}"]`);
  await expect(fullscreen).toBeVisible();
  await expect
    .poll(() => fullscreen.evaluate((video: HTMLVideoElement) => video.currentTime > 0))
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/fil\/[0-9a-f-]{36}$/);
});
