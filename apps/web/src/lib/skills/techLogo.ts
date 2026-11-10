import type { TechLogoName } from "../../components/ui/techLogos.js";

// Mot (tag, langue d'un bloc, mot du nom) vers logo. Les mots courts ne
// comptent qu'entiers, comme pour les domaines.
const KEYWORDS: [string, TechLogoName][] = [
  ["flutter", "flutter"],
  ["dart", "dart"],
  ["react", "react"],
  ["next.js", "nextdotjs"],
  ["nextjs", "nextdotjs"],
  ["vue", "vuedotjs"],
  ["tailwind", "tailwindcss"],
  ["typescript", "typescript"],
  ["ts", "typescript"],
  ["tsx", "typescript"],
  ["javascript", "javascript"],
  ["js", "javascript"],
  ["node", "nodedotjs"],
  ["python", "python"],
  ["py", "python"],
  ["django", "django"],
  ["fastapi", "fastapi"],
  ["pytorch", "pytorch"],
  ["tensorflow", "tensorflow"],
  ["airflow", "apacheairflow"],
  ["kubernetes", "kubernetes"],
  ["docker", "docker"],
  ["dockerfile", "docker"],
  ["github actions", "githubactions"],
  ["postgres", "postgresql"],
  ["postgresql", "postgresql"],
  ["sql", "postgresql"],
  ["mysql", "mysql"],
  ["mongodb", "mongodb"],
  ["firebase", "firebase"],
  ["kotlin", "kotlin"],
  ["android", "android"],
  ["swift", "swift"],
  ["go", "go"],
  ["golang", "go"],
  ["php", "php"],
  ["laravel", "laravel"],
  ["rust", "rust"],
  ["unity", "unity"],
  ["arduino", "arduino"],
  ["firmware", "arduino"],
  ["linux", "linux"],
  ["git", "git"],
  ["bash", "gnubash"],
  ["shell", "gnubash"],
  ["sh", "gnubash"],
];

function mentions(text: string, keyword: string): boolean {
  if (keyword.length > 4) return text.includes(keyword);
  return new RegExp(String.raw`(^|[^\p{L}.])${keyword.replace(".", String.raw`\.`)}($|[^\p{L}])`, "u").test(text);
}

/** Logo de la technologie principale : tags d'abord, puis langue du code, puis nom. */
export function techLogoFor(sources: (string | null | undefined)[]): TechLogoName | null {
  for (const source of sources) {
    if (!source) continue;
    const text = source.toLowerCase();
    const match = KEYWORDS.find(([keyword]) => mentions(text, keyword));
    if (match) return match[1];
  }
  return null;
}
