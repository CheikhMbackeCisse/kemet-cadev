import { expect, test, type APIResponse } from "@playwright/test";

// Ces en-têtes sont posés par Caddy (infra/Caddyfile) : vérifiés seulement à
// travers la pile complète (job e2e de la CI, infra/deploy.sh en production),
// jamais contre le serveur de développement de Vite.
test.skip(!process.env.PLAYWRIGHT_BASE_URL, "En-têtes posés par Caddy, absent en développement.");

const SHARED_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
};

function headerValues(response: APIResponse, name: string): string[] {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === name)
    .map((header) => header.value);
}

function expectSharedHeaders(response: APIResponse) {
  for (const [name, value] of Object.entries(SHARED_HEADERS)) {
    expect(headerValues(response, name), name).toEqual([value]);
  }
}

test(
  "la page d'accueil porte chaque en-tête de sécurité une seule fois",
  { tag: "@prod-smoke" },
  async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    expectSharedHeaders(response);
    const [policy] = headerValues(response, "content-security-policy");
    expect(policy).toContain("script-src 'self';");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  },
);

test(
  "l'api porte chaque en-tête de sécurité une seule fois",
  { tag: "@prod-smoke" },
  async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    expectSharedHeaders(response);
    expect(headerValues(response, "content-security-policy")).toEqual(["default-src 'none'"]);
  },
);
