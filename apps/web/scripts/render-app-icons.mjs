// Fabrique les icônes de la web app (écran d'accueil du téléphone) à partir
// du mot-symbole sombre, posé tel quel sur le fond sombre des tokens.
// Usage : pnpm --filter @kemet/web icons:render [--preview <dossier>]
// Avec --preview, écrit aussi l'icône vue à 48 et 96 px, découpée comme le
// ferait le téléphone (cercle pour la version maskable, carré arrondi sinon).
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
// --bg du thème sombre.
const BACKGROUND = "#0D1320";

// `wordmarkWidth` : part de la largeur occupée par le mot. La version
// maskable garde le mot dans la zone sûre, que le téléphone ne coupe jamais.
const ICONS = [
  { file: "app-icon-192.png", size: 192, wordmarkWidth: 0.74 },
  { file: "app-icon-512.png", size: 512, wordmarkWidth: 0.74 },
  { file: "app-icon-maskable-512.png", size: 512, wordmarkWidth: 0.6 },
  { file: "apple-touch-icon.png", size: 180, wordmarkWidth: 0.74 },
];

function iconHtml(wordmark, size, wordmarkWidth) {
  return `<!doctype html><body style="margin:0">
<div id="icon" style="width:${size}px;height:${size}px;background:${BACKGROUND};display:flex;align-items:center;justify-content:center">
<img src="${wordmark}" style="width:${Math.round(size * wordmarkWidth)}px;display:block" alt="">
</div></body>`;
}

function previewHtml(icons) {
  const cells = icons
    .map(
      ({ src, radius }) =>
        [48, 96]
          .map(
            (px) =>
              `<img src="${src}" width="${px}" height="${px}" style="border-radius:${radius};margin:12px">`,
          )
          .join(""),
    )
    .join("");
  return `<!doctype html><body style="margin:0;padding:12px;background:#E5E7EB;display:flex;align-items:center">${cells}</body>`;
}

const previewIndex = process.argv.indexOf("--preview");
const previewDir = previewIndex === -1 ? null : process.argv[previewIndex + 1];

const svg = await readFile(join(root, "public", "brand", "kemet-wordmark-dark.svg"));
const wordmark = `data:image/svg+xml;base64,${svg.toString("base64")}`;
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
for (const icon of ICONS) {
  await page.setContent(iconHtml(wordmark, icon.size, icon.wordmarkWidth));
  await page.locator("#icon").screenshot({ path: join(outDir, icon.file) });
  console.log(icon.file);
}

if (previewDir) {
  const read = async (file) =>
    `data:image/png;base64,${(await readFile(join(outDir, file))).toString("base64")}`;
  await page.setViewportSize({ width: 380, height: 120 });
  await page.setContent(
    previewHtml([
      { src: await read("app-icon-maskable-512.png"), radius: "50%" },
      { src: await read("app-icon-512.png"), radius: "22%" },
    ]),
  );
  await mkdir(previewDir, { recursive: true });
  await page.screenshot({ path: join(previewDir, "icone-48-96.png"), fullPage: true });
  console.log(`${previewDir}/icone-48-96.png`);
}
await browser.close();
