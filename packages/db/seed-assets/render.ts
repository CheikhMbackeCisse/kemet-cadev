// Régénère les images, vidéos et CV de démonstration à partir des pages HTML
// de `pages/`. Usage : pnpm --filter @kemet/db seed-assets:render [--no-video] [--only-cv]
// [--page=<fichier.html>] (une seule page d'images, sans les vidéos ni les CV)
// Chaque `.frame[data-out]` devient `out/<data-out>.jpg` ; chaque page de
// `VIDEOS` est filmée quelques secondes en WebM. Rien n'est chargé depuis le
// réseau : les pages n'utilisent que du HTML, du CSS et les polices du système.
// Chaque page `cv-<identifiant>.html` est imprimée en `out/cv-<identifiant>.pdf`.
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser } from "@playwright/test";

const root = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(root, "pages");
const outDir = join(root, "out");

const VIDEOS = [
  { page: "video-paiement.html", out: "work-idempotence-video", seconds: 7 },
  { page: "video-capteurs.html", out: "work-capteurs-video", seconds: 7 },
];

const onlyPage = process.argv.find((arg) => arg.startsWith("--page="))?.slice("--page=".length);

async function renderFrames(browser: Browser): Promise<void> {
  const files = (await readdir(pagesDir)).filter(
    (name) =>
      name.endsWith(".html") &&
      !name.startsWith("video-") &&
      !name.startsWith("cv-") &&
      (!onlyPage || name === onlyPage),
  );
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  for (const file of files) {
    await page.goto(pathToFileURL(join(pagesDir, file)).href);
    const frames = await page.locator(".frame[data-out]").all();
    for (const frame of frames) {
      const name = await frame.getAttribute("data-out");
      const path = join(outDir, `${name}.jpg`);
      await frame.screenshot({ path, type: "jpeg", quality: 80, animations: "disabled" });
      console.log(`${name}.jpg  ${Math.round((await stat(path)).size / 1024)} ko`);
    }
  }
  await page.close();
}

async function renderCvs(browser: Browser): Promise<void> {
  const files = (await readdir(pagesDir)).filter((name) => name.startsWith("cv-") && name.endsWith(".html"));
  const page = await browser.newPage();
  for (const file of files) {
    await page.goto(pathToFileURL(join(pagesDir, file)).href);
    const path = join(outDir, file.replace(/.html$/, ".pdf"));
    await page.pdf({ path, format: "A4", printBackground: true, preferCSSPageSize: true });
    console.log(`${file.replace(/.html$/, ".pdf")}  ${Math.round((await stat(path)).size / 1024)} ko`);
  }
  await page.close();
}

async function renderVideo(browser: Browser, video: (typeof VIDEOS)[number]): Promise<void> {
  const tmpDir = join(outDir, ".video-tmp");
  await rm(tmpDir, { recursive: true, force: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(join(pagesDir, video.page)).href);
  await page.waitForTimeout(video.seconds * 1000);
  const recorded = await page.video()!.path();
  await context.close();
  const path = join(outDir, `${video.out}.webm`);
  await rename(recorded, path);
  await rm(tmpDir, { recursive: true, force: true });
  console.log(`${video.out}.webm  ${Math.round((await stat(path)).size / 1024)} ko`);
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const onlyCv = process.argv.includes("--only-cv");
  if (!onlyCv) await renderFrames(browser);
  if (!onlyPage) await renderCvs(browser);
  const skipVideos = onlyCv || Boolean(onlyPage) || process.argv.includes("--no-video");
  if (!skipVideos) for (const video of VIDEOS) await renderVideo(browser, video);
} finally {
  await browser.close();
}
