import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { matchesTarget, readPlatformPackages, splitKey } from "./lockfile-platforms.js";

const FORBIDDEN = ["GPL", "AGPL", "LGPL"];

// OFL-1.1 n'est acceptée que pour ces polices : des fichiers de police, pas du code.
const OFL_ALLOWED_PACKAGES = new Set([
  "@fontsource/plus-jakarta-sans",
  "@fontsource-variable/geist-mono",
]);

// Plateforme des images de production (node:22-alpine, musl) et de la CI
// (Ubuntu, glibc).
const TARGET = { os: "linux", cpu: "x64" };
const REGISTRY_TIMEOUT_MS = 10_000;

// Les paquets du dépôt (tous droits réservés) ne sont pas des dépendances
// tierces. Un homonyme publié sur npm sous une autre licence reste contrôlé.
const WORKSPACE_DIRECTORIES = ["apps", "packages"];
const WORKSPACE_LICENSE = "UNLICENSED";

function readWorkspacePackageNames(): Set<string> {
  const manifests = [
    "package.json",
    ...WORKSPACE_DIRECTORIES.flatMap((directory) =>
      readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${directory}/${entry.name}/package.json`),
    ),
  ];
  return new Set(
    manifests.map((path) => (JSON.parse(readFileSync(path, "utf-8")) as { name: string }).name),
  );
}

interface PackageLicense {
  name: string;
  version: string;
  license: string;
}

function isForbidden(pkg: PackageLicense): boolean {
  const license = pkg.license.toUpperCase();
  if (FORBIDDEN.some((forbidden) => license.includes(forbidden))) {
    return true;
  }
  return license.includes("OFL") && !OFL_ALLOWED_PACKAGES.has(pkg.name);
}

// `license-checker` ne voit qu'une partie du store pnpm ; `pnpm licenses list`
// couvre tout le workspace. shell: true résout pnpm.cmd sous Windows, sans
// risque : les arguments sont fixes.
function listInstalledPackages(): PackageLicense[] {
  const raw = execFileSync("pnpm", ["licenses", "list", "--json"], {
    encoding: "utf-8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const byLicense: Record<string, { name: string; versions: string[] }[]> = JSON.parse(raw);
  return Object.entries(byLicense).flatMap(([license, entries]) =>
    entries.flatMap((entry) =>
      entry.versions.map((version) => ({ name: entry.name, version, license })),
    ),
  );
}

async function fetchRegistryLicense(name: string, version: string): Promise<string> {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) },
  );
  if (!response.ok) {
    throw new Error(`Registre npm : ${name}@${version} introuvable (${response.status}).`);
  }
  const manifest = (await response.json()) as { license?: unknown };
  if (typeof manifest.license !== "string") {
    throw new Error(
      `Registre npm : licence de ${name}@${version} absente ou dans un format inattendu.`,
    );
  }
  return manifest.license;
}

/**
 * pnpm n'installe que les binaires de la machine qui lance l'installation
 * (Windows en local, Linux glibc en CI). Les paquets propres à une plateforme
 * sont donc pris dans le lockfile, qui les décrit tous, et leur licence lue
 * sur le registre npm : le fichier généré est le même quelle que soit la
 * machine.
 */
async function collectTargetPackages(): Promise<PackageLicense[]> {
  const platformPackages = readPlatformPackages(readFileSync("pnpm-lock.yaml", "utf-8"));
  const workspacePackages = readWorkspacePackageNames();
  const portable = listInstalledPackages().filter(
    (pkg) =>
      !(workspacePackages.has(pkg.name) && pkg.license === WORKSPACE_LICENSE) &&
      !platformPackages.has(`${pkg.name}@${pkg.version}`),
  );
  const platformSpecific = await Promise.all(
    [...platformPackages]
      .filter(([, constraint]) => matchesTarget(constraint, TARGET))
      .map(([key]) => splitKey(key))
      .map(async ({ name, version }) => ({
        name,
        version,
        license: await fetchRegistryLicense(name, version),
      })),
  );
  return [...portable, ...platformSpecific];
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ");
}

const packages = await collectTargetPackages();
const violations = packages.filter(isForbidden);

if (violations.length > 0) {
  console.error("Licences interdites détectées :");
  for (const pkg of violations) {
    console.error(`  ${pkg.name}@${pkg.version} : ${pkg.license}`);
  }
  process.exit(1);
}

const byLicense = new Map<string, Set<string>>();
for (const pkg of packages) {
  const names = byLicense.get(pkg.license) ?? new Set<string>();
  names.add(`${pkg.name}@${pkg.version}`);
  byLicense.set(pkg.license, names);
}

const lines = [
  "# Licences des dépendances tierces",
  "",
  "Généré par `pnpm licenses:check`. Ne pas modifier à la main.",
  "",
  `Plateforme couverte : ${TARGET.os} ${TARGET.cpu} (glibc et musl), celle des images de production et de la CI. Les binaires propres à cette plateforme sont lus dans \`pnpm-lock.yaml\`, leur licence sur le registre npm, même quand l'installation locale ne les contient pas.`,
  "",
  "| Licence | Paquets |",
  "| --- | --- |",
  ...[...byLicense]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([license, names]) =>
        `| ${escapeTableCell(license)} | ${escapeTableCell([...names].sort().join(", "))} |`,
    ),
  "",
];

writeFileSync("THIRD_PARTY_LICENSES.md", lines.join("\n"));
console.log(
  `Aucune licence interdite. ${packages.length} paquets listés dans THIRD_PARTY_LICENSES.md.`,
);
