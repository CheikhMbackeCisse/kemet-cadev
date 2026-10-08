import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const FORBIDDEN = ["GPL", "AGPL", "LGPL"];

/**
 * OFL-1.1 n'est autorisée que pour ces paquets de polices (fichiers de
 * police eux-mêmes, pas du code) : voir docs/adr/ du lot 4.
 */
const OFL_ALLOWED_PACKAGES = new Set([
  "@fontsource/plus-jakarta-sans",
  "@fontsource-variable/geist-mono",
]);

interface LicensePackage {
  name: string;
  versions: string[];
  license: string;
}

function isForbidden(license: string, entries: { name: string }[]): boolean {
  if (FORBIDDEN.some((forbidden) => license.toUpperCase().includes(forbidden))) {
    return true;
  }
  if (license.toUpperCase().includes("OFL")) {
    return entries.some((entry) => !OFL_ALLOWED_PACKAGES.has(entry.name));
  }
  return false;
}

/**
 * `license-checker` ne suit pas correctement la structure de node_modules de
 * pnpm (dépendances dans le store .pnpm) et ne voit qu'une fraction des
 * paquets. `pnpm licenses list` est pensé pour pnpm et couvre tout le
 * workspace, y compris les dépendances de chaque app et package.
 */
/**
 * shell: true est nécessaire sur Windows pour résoudre pnpm.cmd ; sans danger
 * ici, les arguments sont une liste fixe du script, jamais une entrée externe.
 */
const raw = execFileSync("pnpm", ["licenses", "list", "--json"], {
  encoding: "utf-8",
  shell: true,
});
const byLicense: Record<string, { name: string; version: string }[]> = JSON.parse(raw);

const packages: LicensePackage[] = Object.entries(byLicense).map(([license, entries]) => ({
  name: entries.map((e) => e.name).join(", "),
  versions: entries.map((e) => e.version),
  license,
}));

const violations = Object.keys(byLicense).filter((license) => isForbidden(license, byLicense[license]));

if (violations.length > 0) {
  console.error("Licences interdites détectées :");
  for (const license of violations) {
    for (const pkg of byLicense[license]) {
      console.error(`  ${pkg.name}@${pkg.version} : ${license}`);
    }
  }
  process.exit(1);
}

const lines = [
  "# Licences des dépendances tierces",
  "",
  "Généré par `pnpm licenses:check`. Ne pas modifier à la main.",
  "",
  "| Licence | Paquets |",
  "| --- | --- |",
  ...Object.entries(byLicense)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([license, entries]) => {
      const names = entries
        .map((e) => `${e.name}@${e.version}`)
        .sort()
        .join(", ");
      return `| ${license} | ${names} |`;
    }),
  "",
];

writeFileSync("THIRD_PARTY_LICENSES.md", lines.join("\n"));
const totalPackages = Object.values(byLicense).reduce((sum, entries) => sum + entries.length, 0);
console.log(
  `Aucune licence interdite. ${totalPackages} paquets listés dans THIRD_PARTY_LICENSES.md.`,
);
