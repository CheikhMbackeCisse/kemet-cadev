import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webmanifest": "application/manifest+json",
};

// Les images PNG et les polices woff2 sont déjà compressées : les recompresser
// coûterait du temps processeur pour quelques octets.
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".txt", ".svg", ".webmanifest"]);
const MIN_COMPRESSED_SIZE = 1024;

/** En-tête Cache-Control d'un fichier servi. */
export function cacheControlFor(pathname) {
  // Noms versionnés par Vite : un contenu différent change toujours de nom.
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/brand/")) return "public, max-age=86400";
  // index.html, sw.js, registerSW.js, manifeste : toujours revalidés, sinon
  // un déploiement resterait invisible jusqu'à expiration du cache.
  return "no-cache";
}

/** Encodage retenu pour un en-tête Accept-Encoding, ou null. */
export function pickEncoding(acceptEncoding) {
  const accepted = (acceptEncoding ?? "").split(",").map((part) => part.trim().split(";")[0]);
  if (accepted.includes("br")) return "br";
  if (accepted.includes("gzip")) return "gzip";
  return null;
}

export function createStaticServer(root) {
  const files = new Map();

  // Chaque fichier est lu et compressé une seule fois : dist/ ne change jamais
  // tant que le conteneur tourne.
  function load(filePath) {
    let entry = files.get(filePath);
    if (!entry) {
      entry = (async () => {
        const raw = await readFile(filePath);
        const info = await stat(filePath);
        return { raw, etag: `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`, encoded: new Map() };
      })();
      files.set(filePath, entry);
      entry.catch(() => files.delete(filePath));
    }
    return entry;
  }

  function encode(file, encoding) {
    let body = file.encoded.get(encoding);
    if (!body) {
      body =
        encoding === "br"
          ? brotli(file.raw, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } })
          : gzipAsync(file.raw, { level: 9 });
      file.encoded.set(encoding, body);
    }
    return body;
  }

  // Un fichier absent renvoie index.html : les routes de l'app sont gérées côté
  // client et doivent survivre à un rechargement. Jamais sous /assets/ : la page
  // servie à la place d'un script serait gardée un an comme ce script.
  async function resolveFile(pathname) {
    // pathname vient toujours d'une URL (préfixe "/"), donc normalize() résout
    // déjà tout "../" vers la racine : pas besoin de les retirer nous-mêmes.
    const filePath = join(root, normalize(pathname));
    const info = await stat(filePath).catch(() => null);
    if (info?.isFile()) return { filePath, pathname };
    if (pathname.startsWith("/assets/")) return null;
    return { filePath: join(root, "index.html"), pathname: "/index.html" };
  }

  async function handle(req, res) {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "web" }));
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Adresse invalide");
      return;
    }
    const resolved = await resolveFile(pathname);
    const file = resolved && (await load(resolved.filePath).catch(() => null));
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
      res.end("Introuvable");
      return;
    }

    const extension = extname(resolved.filePath);
    const headers = {
      "content-type": MIME_TYPES[extension] ?? "application/octet-stream",
      "cache-control": cacheControlFor(resolved.pathname),
      etag: file.etag,
    };
    if (COMPRESSIBLE.has(extension)) headers.vary = "Accept-Encoding";
    const ifNoneMatch = req.headers["if-none-match"] ?? "";
    if (ifNoneMatch === "*" || ifNoneMatch.split(",").some((tag) => tag.trim() === file.etag)) {
      res.writeHead(304, headers);
      res.end();
      return;
    }

    let body = file.raw;
    if (COMPRESSIBLE.has(extension)) {
      const encoding = file.raw.length >= MIN_COMPRESSED_SIZE ? pickEncoding(req.headers["accept-encoding"]) : null;
      if (encoding) {
        body = await encode(file, encoding);
        headers["content-encoding"] = encoding;
      }
    }
    headers["content-length"] = String(body.length);
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
  }

  // Une erreur imprévue ne doit jamais arrêter le processus, et le site avec.
  return createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end();
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = process.env.WEB_ROOT ?? "/app/dist";
  const port = Number(process.env.PORT ?? 8080);
  createStaticServer(root).listen(port, () => {
    console.log(`web statique à l'écoute sur le port ${port}`);
  });
}
