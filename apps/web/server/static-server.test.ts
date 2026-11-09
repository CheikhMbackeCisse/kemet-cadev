// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { get, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error module JavaScript sans déclaration de types, lancé tel quel dans l'image
import { cacheControlFor, createStaticServer, pickEncoding } from "./static-server.mjs";

// fetch décompresse seul la réponse : on lit ici les octets envoyés.
function getRaw(url: string, headers: Record<string, string>): Promise<{ response: IncomingMessage; body: Buffer }> {
  return new Promise((resolve, reject) => {
    get(url, { headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({ response, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}

const SCRIPT = `console.log(${JSON.stringify("x".repeat(4000))});`;

describe("serveur statique", () => {
  let root: string;
  let server: ReturnType<typeof createStaticServer>;
  let base: string;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "kemet-web-"));
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "index.html"), "<!doctype html><title>Kemet</title>");
    writeFileSync(join(root, "assets", "index-abc.js"), SCRIPT);
    writeFileSync(join(root, "assets", "font-abc.woff2"), Buffer.alloc(2000, 1));
    server = createStaticServer(root);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("sert un fichier versionné compressé en Brotli et gardé un an", async () => {
    const { response, body } = await getRaw(`${base}/assets/index-abc.js`, { "accept-encoding": "gzip, br" });
    expect(response.headers["content-encoding"]).toBe("br");
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(body.length).toBeLessThan(SCRIPT.length / 10);
    expect(brotliDecompressSync(body).toString()).toBe(SCRIPT);
  });

  it("ne recompresse pas une police et lui donne son type", async () => {
    const response = await fetch(`${base}/assets/font-abc.woff2`, { headers: { "accept-encoding": "br" } });
    expect(response.headers.get("content-type")).toBe("font/woff2");
    expect(response.headers.get("content-encoding")).toBeNull();
  });

  it("renvoie 404 pour un fichier absent sous /assets/ au lieu de la page", async () => {
    const response = await fetch(`${base}/assets/disparu-123.js`);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-cache");
  });

  it("sert index.html pour une route de l'app, revalidé à chaque visite", async () => {
    const response = await fetch(`${base}/fil`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(await response.text()).toContain("<title>Kemet</title>");
  });

  it("refuse une adresse mal encodée sans s'arrêter", async () => {
    const { response } = await getRaw(`${base}/%E0`, {});
    expect(response.statusCode).toBe(400);
    expect((await fetch(`${base}/fil`)).status).toBe(200);
  });

  it("répond 304 quand l'ETag n'a pas changé", async () => {
    const first = await fetch(`${base}/fil`);
    const etag = first.headers.get("etag") ?? "";
    const second = await fetch(`${base}/fil`, { headers: { "if-none-match": etag } });
    expect(etag).not.toBe("");
    expect(second.status).toBe(304);
  });
});

describe("pickEncoding", () => {
  it("préfère Brotli, puis gzip", () => {
    expect(pickEncoding("gzip, deflate, br, zstd")).toBe("br");
    expect(pickEncoding("gzip;q=1.0")).toBe("gzip");
    expect(pickEncoding(undefined)).toBeNull();
  });
});

describe("cacheControlFor", () => {
  it("garde un an les fichiers versionnés, revalide le reste", () => {
    expect(cacheControlFor("/assets/x-1.js")).toContain("immutable");
    expect(cacheControlFor("/sw.js")).toBe("no-cache");
    expect(cacheControlFor("/index.html")).toBe("no-cache");
  });
});
