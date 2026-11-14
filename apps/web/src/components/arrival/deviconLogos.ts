// Logos en couleurs de Devicon 2.17.0 (https://devicon.dev), licence MIT,
// copiés par scripts/build-devicon.ts : voir THIRD-PARTY.md. Les logos
// appartiennent à leurs propriétaires et servent seulement à désigner les
// technologies, en décor du parcours d'arrivée.

export type DeviconName =
  | "python"
  | "javascript"
  | "typescript"
  | "react"
  | "flutter"
  | "dart"
  | "nodejs"
  | "go"
  | "java"
  | "php"
  | "html5"
  | "css3"
  | "docker"
  | "postgresql"
  | "git"
  | "linux"
  | "pytorch";

const FILES = import.meta.glob<string>("./devicon/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

/** Adresse du fichier SVG d'un logo, servi comme une image. */
export function deviconUrl(name: DeviconName): string {
  const url = FILES[`./devicon/${name}.svg`];
  if (!url) throw new Error(`Logo Devicon absent : ${name}`);
  return url;
}

/**
 * Logos trop lourds pour une connexion lente (Tux de Linux pèse 190 Ko, fait
 * de centaines de tracés) : laissés de côté quand la connexion est lente.
 */
export const HEAVY_DEVICONS: ReadonlySet<DeviconName> = new Set(["linux"]);
