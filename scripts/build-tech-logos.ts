// Régénère apps/web/src/components/ui/techLogos.ts depuis Simple Icons
// (CC0-1.0), version figée : pnpm tsx scripts/build-tech-logos.ts
import { writeFileSync } from "node:fs";

const VERSION = "16.37.0";
const SLUGS = [
  "python", "javascript", "typescript", "kotlin", "dart", "flutter", "react", "nodedotjs",
  "postgresql", "mysql", "mongodb", "docker", "kubernetes", "apacheairflow", "go", "php",
  "laravel", "django", "fastapi", "android", "swift", "firebase", "tailwindcss", "vuedotjs",
  "nextdotjs", "pytorch", "tensorflow", "arduino", "unity", "linux", "git", "githubactions",
  "rust", "gnubash",
] as const;

interface IconData {
  title: string;
  slug: string;
  hex: string;
}

const base = `https://unpkg.com/simple-icons@${VERSION}`;
const data = (await (await fetch(`${base}/data/simple-icons.json`)).json()) as IconData[];

const entries: string[] = [];
for (const slug of SLUGS) {
  const icon = data.find((item) => item.slug === slug);
  if (!icon) throw new Error(`Icône absente de Simple Icons ${VERSION} : ${slug}`);
  const svg = await (await fetch(`${base}/icons/${slug}.svg`)).text();
  const path = /<path d="([^"]+)"/.exec(svg)?.[1];
  if (!path) throw new Error(`Tracé introuvable : ${slug}`);
  entries.push(
    `  ${slug}: {\n    title: ${JSON.stringify(icon.title)},\n    color: "#${icon.hex}",\n    path: ${JSON.stringify(path)},\n  },`,
  );
}

const output = `// Tracés et couleurs officielles de Simple Icons ${VERSION}
// (https://simpleicons.org), licence CC0-1.0, générés par
// scripts/build-tech-logos.ts : voir THIRD_PARTY_LICENSES.md. Les marques
// restent à leurs propriétaires ; affichées pour nommer une technologie,
// jamais comme un partenariat.

export type TechLogoName =
${SLUGS.map((slug) => `  | "${slug}"`).join("\n")};

/** Nom, tracé SVG (boîte de 24 sur 24) et couleur officielle de chaque logo. */
export const TECH_LOGOS: Record<TechLogoName, { title: string; path: string; color: string }> = {
${entries.join("\n")}
};
`;
writeFileSync("apps/web/src/components/ui/techLogos.ts", output);
console.log(`${SLUGS.length} logos écrits.`);
