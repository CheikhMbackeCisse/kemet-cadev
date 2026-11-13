import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { createStaticServer } from "../../server/static-server.mjs";

const TEXT_EXTENSIONS = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest"]);

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Fabrique une "version suivante" à partir d'une version construite : chaque
 * fichier de assets/ change de nom, comme après un vrai déploiement, et les
 * anciens noms n'existent plus. Les révisions de la précache changent aussi,
 * sans quoi le nouveau service worker garderait l'ancien index.html.
 */
export async function makeNextVersion(sourceDist: string): Promise<string> {
  const target = join(tmpdir(), `kemet-next-version-${process.pid}-${Date.now()}`);
  await cp(sourceDist, target, { recursive: true });
  const assets = join(target, "assets");
  const renames = new Map<string, string>();
  for (const name of await readdir(assets)) {
    const extension = extname(name);
    const next = `${name.slice(0, -extension.length)}-next${extension}`;
    renames.set(name, next);
    await rename(join(assets, name), join(assets, next));
  }
  const pattern = new RegExp(
    [...renames.keys()]
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"),
    "g",
  );
  for (const file of await filesUnder(target)) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue;
    let content = await readFile(file, "utf8");
    content = content.replace(pattern, (name) => renames.get(name) ?? name);
    if (basename(file) === "sw.js") {
      content = content.replace(/revision:"([^"]+)"/g, (_, revision: string) => `revision:"${revision}-next"`);
    }
    await writeFile(file, content);
  }
  return target;
}

export interface VersionServer {
  origin: string;
  /** Sert désormais cette version : le déploiement simulé. */
  serve(root: string): void;
  /** Répond 404 aux fichiers dont le nom contient ce texte, quelle que soit la version. */
  breakFiles(fragment: string | null): void;
  close(): Promise<void>;
}

/**
 * Serveur web de production (static-server.mjs) dont on change la version à
 * chaud, avec /api relayée vers une API réelle. L'en-tête Origin est réécrit
 * pour que l'authentification accepte les requêtes relayées.
 */
export async function startVersionServer(options: {
  root: string;
  port: number;
  apiTarget: string;
}): Promise<VersionServer> {
  let handler = createStaticServer(options.root).listeners("request")[0] as (
    req: unknown,
    res: unknown,
  ) => void;
  let broken: string | null = null;
  const api = new URL(options.apiTarget);

  const server: Server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (broken && url.includes(broken)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
      res.end("Introuvable");
      return;
    }
    if (!url.startsWith("/api/")) {
      handler(req, res);
      return;
    }
    const headers = { ...req.headers, host: api.host };
    if (headers.origin) headers.origin = api.origin;
    const proxied = httpRequest(
      { hostname: api.hostname, port: api.port, path: url, method: req.method, headers },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    proxied.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(proxied);
  });
  await new Promise<void>((resolve) => server.listen(options.port, "127.0.0.1", resolve));

  return {
    origin: `http://localhost:${options.port}`,
    serve(root) {
      handler = createStaticServer(root).listeners("request")[0] as typeof handler;
    },
    breakFiles(fragment) {
      broken = fragment;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Le navigateur garde ses connexions ouvertes : close() les attendrait.
        server.closeAllConnections();
      }),
  };
}

export async function removeVersion(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}
