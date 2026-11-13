// Copie dans apps/web/src/components/arrival/devicon/ les logos en couleurs
// (variantes "original") de Devicon, licence MIT, version figée :
// pnpm tsx scripts/build-devicon.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const VERSION = "2.17.0";
export const DEVICON_NAMES = [
  "python",
  "javascript",
  "typescript",
  "react",
  "flutter",
  "dart",
  "nodejs",
  "go",
  "java",
  "php",
  "html5",
  "css3",
  "docker",
  "postgresql",
  "git",
  "linux",
] as const;

const directory = resolve(import.meta.dirname, "../apps/web/src/components/arrival/devicon");
mkdirSync(directory, { recursive: true });

for (const name of DEVICON_NAMES) {
  const url = `https://unpkg.com/devicon@${VERSION}/icons/${name}/${name}-original.svg`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Logo absent de Devicon ${VERSION} : ${name}`);
  const svg = await response.text();
  if (!svg.trimStart().startsWith("<svg") || /<script|on\w+=|href="(?!#)/i.test(svg))
    throw new Error(`Contenu inattendu dans ${name}`);
  writeFileSync(resolve(directory, `${name}.svg`), svg.trim() + "\n");
}
console.log(`${DEVICON_NAMES.length} logos copiés depuis Devicon ${VERSION}`);
