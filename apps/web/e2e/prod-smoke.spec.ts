import { expect, test } from "@playwright/test";

// Joué par infra/deploy.sh contre l'adresse de production après chaque
// déploiement (--grep @prod-smoke) : lecture seule, aucun compte créé et
// aucune donnée écrite dans la base de production.

test("le fil s'affiche pour un visiteur", { tag: "@prod-smoke" }, async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fil" })).toBeVisible();
});

test("la page de connexion s'affiche", { tag: "@prod-smoke" }, async ({ page }) => {
  await page.goto("/connexion");
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});

test("l'api répond en bonne santé", { tag: "@prod-smoke" }, async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test(
  "le temps réel accepte la poignée de main Socket.IO",
  { tag: "@prod-smoke" },
  async ({ request }) => {
    const response = await request.get("/socket.io/?EIO=4&transport=polling");
    expect(response.status()).toBe(200);
  },
);
