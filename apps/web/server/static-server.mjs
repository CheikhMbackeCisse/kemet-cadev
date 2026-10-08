import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.env.WEB_ROOT ?? "/app/dist";
const port = Number(process.env.PORT ?? 8080);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

/**
 * Pas de routeur côté client en dehors de la page unique pour l'instant : si
 * le fichier demandé n'existe pas, on retombe sur index.html plutôt que de
 * renvoyer 404, pour que les futures routes de la PWA fonctionnent au
 * rafraîchissement de la page.
 */
async function resolveFile(pathname) {
  // pathname vient toujours d'une URL (préfixe "/"), donc normalize() résout
  // déjà tout "../" vers la racine : pas besoin de les retirer nous-mêmes.
  const filePath = join(root, normalize(pathname));
  const info = await stat(filePath).catch(() => null);
  if (info?.isFile()) return filePath;
  return join(root, "index.html");
}

createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "web" }));
    return;
  }

  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const filePath = await resolveFile(pathname);

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Introuvable");
  }
}).listen(port, () => {
  console.log(`web statique à l'écoute sur le port ${port}`);
});
