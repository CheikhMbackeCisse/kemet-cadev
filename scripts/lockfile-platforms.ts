export interface PlatformConstraint {
  os?: string[];
  cpu?: string[];
  libc?: string[];
}

export interface Target {
  os: string;
  cpu: string;
}

const CONSTRAINT_FIELDS = ["os", "cpu", "libc"] as const;
type ConstraintField = (typeof CONSTRAINT_FIELDS)[number];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Même règle que npm pour `os` et `cpu` : `!valeur` exclut une plateforme, une
 * liste qui ne contient que des exclusions accepte tout le reste.
 */
function allows(values: string[] | undefined, target: string): boolean {
  if (!values) return true;
  if (values.includes(`!${target}`)) return false;
  const inclusions = values.filter((value) => !value.startsWith("!"));
  return inclusions.length === 0 || inclusions.includes(target);
}

/** La libc n'est pas filtrée : glibc (CI) et musl (images Alpine) sont toutes deux visées. */
export function matchesTarget(constraint: PlatformConstraint, target: Target): boolean {
  return allows(constraint.os, target.os) && allows(constraint.cpu, target.cpu);
}

function parseInlineList(raw: string, line: string): string[] {
  const match = /^\[(.*)\]$/.exec(raw.trim());
  if (!match) {
    throw new Error(`pnpm-lock.yaml : contrainte de plateforme illisible : "${line.trim()}"`);
  }
  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter((value) => value.length > 0);
}

/**
 * Lit les champs `os`, `cpu` et `libc` de la section `packages:` d'un
 * lockfile pnpm au format 9, ligne à ligne pour ne pas ajouter de dépendance
 * YAML. Toute forme non reconnue fait échouer la lecture : un paquet dont la
 * contrainte serait mal lue échapperait sinon au contrôle des licences.
 */
export function readPlatformPackages(lockfile: string): Map<string, PlatformConstraint> {
  const platformPackages = new Map<string, PlatformConstraint>();
  let inPackages = false;
  let current: { key: string; constraint: PlatformConstraint } | undefined;

  const flush = () => {
    if (current && CONSTRAINT_FIELDS.some((field) => current!.constraint[field])) {
      platformPackages.set(current.key, current.constraint);
    }
    current = undefined;
  };

  for (const line of lockfile.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      flush();
      inPackages = line === "packages:";
      continue;
    }
    if (!inPackages) continue;
    const entry = /^ {2}'?([^\s'][^']*?)'?:$/.exec(line);
    if (entry) {
      flush();
      current = { key: entry[1], constraint: {} };
      continue;
    }
    const field = /^ {4}(os|cpu|libc):(.*)$/.exec(line);
    if (field && current) {
      current.constraint[field[1] as ConstraintField] = parseInlineList(field[2], line);
    }
  }
  flush();
  return platformPackages;
}

/** Sépare `@scope/nom@1.2.3` en nom et version, et refuse toute version qui n'est pas semver. */
export function splitKey(key: string): { name: string; version: string } {
  const at = key.lastIndexOf("@");
  const name = key.slice(0, at);
  const version = key.slice(at + 1);
  if (at <= 0 || !SEMVER.test(version)) {
    throw new Error(`pnpm-lock.yaml : clé de paquet inattendue "${key}".`);
  }
  return { name, version };
}
