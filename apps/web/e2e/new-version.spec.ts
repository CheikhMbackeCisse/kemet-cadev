import { expect, test, type Page } from "@playwright/test";
import { fr } from "../src/i18n/fr.js";
import { signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";
import { skipIntro } from "./support/intro.js";
import {
  makeNextVersion,
  removeVersion,
  startVersionServer,
  type VersionServer,
} from "./support/versionServer.js";

// Une version construite est nécessaire (service worker, noms de fichiers
// versionnés) : KEMET_WEB_DIST pointe sur son dossier dist/. En CI, il est
// copié depuis le conteneur web de la pile.
const builtVersion = process.env.KEMET_WEB_DIST;
test.skip(!builtVersion, "KEMET_WEB_DIST absent : aucune version construite à servir");

const API_TARGET = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
const BASE_PORT = 4790;

let nextVersion = "";
let server: VersionServer;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  nextVersion = await makeNextVersion(builtVersion!);
});

test.afterAll(async () => {
  await removeVersion(nextVersion);
});

test.beforeEach(async ({ page }, testInfo) => {
  // Installer le service worker et télécharger la précache prend quelques
  // secondes par test, deux fois dans certains cas.
  test.setTimeout(90_000);
  server = await startVersionServer({
    root: builtVersion!,
    port: BASE_PORT + testInfo.parallelIndex,
    apiTarget: API_TARGET,
  });
  await skipIntro(page);
  const handle = uniqueHandle("version", testInfo.project.name);
  await signUpVerifyAndSignIn(page.request, `${handle}@example.com`, handle);
});

test.afterEach(async () => {
  await server.close();
});

/** Ouvre le fil sous le contrôle du service worker de la version servie. */
async function openUnderServiceWorker(page: Page) {
  await page.goto(`${server.origin}/fil`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { versionMarker?: boolean }).versionMarker = true;
  });
}

/** Changement de page de l'application, comme un clic sur un lien. */
async function navigateInApp(page: Page, path: string) {
  await page.evaluate((target) => {
    const link = document.createElement("a");
    link.href = target;
    document.body.append(link);
    link.click();
    link.remove();
  }, path);
}

async function expectNextVersionShowing(page: Page, path: string) {
  await expect(page).toHaveURL(`${server.origin}${path}`);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.getByText(fr.shell.pageLoadFailed)).toHaveCount(0);
  expect(await page.evaluate(() => "versionMarker" in window)).toBe(false);
  expect(await page.locator('script[src*="-next"]').count()).toBeGreaterThan(0);
}

test("une nouvelle version déjà téléchargée s'applique au changement de page suivant", async ({ page }) => {
  await openUnderServiceWorker(page);
  server.serve(nextVersion);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.waiting !== null)))
    .toBe(true);
  // La page en cours de lecture ne bouge pas tant qu'on ne change pas de page.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => "versionMarker" in window)).toBe(true);

  await navigateInApp(page, "/parametres");
  await expectNextVersionShowing(page, "/parametres");
});

const PAGES = [
  "/parametres",
  "/parametres/compte",
  "/parametres/profil",
  "/parametres/apparence",
  "/parametres/donnees",
  "/parametres/aide",
  "/confidentialite",
];

for (const path of PAGES) {
  test(`${path} s'ouvre après un déploiement que le navigateur n'a pas encore vu`, async ({ page }) => {
    await openUnderServiceWorker(page);
    server.serve(nextVersion);
    await navigateInApp(page, path);
    await expectNextVersionShowing(page, path);
  });
}

test("un morceau introuvable après rechargement montre l'erreur, sans boucle", async ({ page }) => {
  await openUnderServiceWorker(page);
  server.serve(nextVersion);
  server.breakFiles("SettingsPage");
  let loads = 0;
  page.on("load", () => {
    loads += 1;
  });
  await navigateInApp(page, "/parametres");
  await expect(page.getByText(fr.shell.pageLoadFailed)).toBeVisible();
  await page.waitForTimeout(3000);
  expect(loads).toBe(1);
  await expect(page.getByText(fr.shell.pageLoadFailed)).toBeVisible();
});
