import { expect, test } from "@playwright/test";
import { signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";

const WIDTHS = [360, 390];

// Une ligne de code plus large que l'écran : c'est elle qui élargissait la
// page à 560 px quand la couverture d'une carte de skill ne la coupait pas.
const LONG_LINE = `const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");`;

test("aucune page de lecture ne défile en largeur sur téléphone", async ({ page, request }) => {
  test.skip(test.info().project.name !== "mobile", "largeurs de téléphone seulement");

  const handle = uniqueHandle("e2ewide", test.info().project.name);
  await signUpVerifyAndSignIn(request, `${handle}@test.kemet`, handle);
  const created = await request.post("/api/skills", {
    data: {
      slug: `large-${Date.now()}`,
      name: "Couverture large",
      description: "Une ligne de code plus large que l'écran du téléphone.",
      content: `\`\`\`js\n${LONG_LINE}\n${LONG_LINE}\n\`\`\``,
    },
  });
  expect(created.ok(), `POST /api/skills : ${created.status()}`).toBe(true);

  // /u/ghizlane-amrani n'existe qu'avec les données de démonstration ; sans
  // elles la page introuvable est vérifiée, et le profil créé ici couvre la
  // carte de skill d'un profil.
  const paths = ["/skills", "/u/ghizlane-amrani", `/u/${handle}`, "/travaux", "/fil", "/salons"];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of paths) {
      await page.goto(path);
      // Sur /salons en téléphone, le <main> du salon reste caché derrière la
      // liste des espaces : la barre du bas est le seul repère commun.
      await page.getByRole("navigation", { name: "Navigation principale" }).waitFor();
      await page.waitForLoadState("networkidle");
      // Comparé à la largeur demandée, pas à innerWidth : en émulation mobile,
      // Chrome élargit la fenêtre de mise en page avec le contenu qui déborde.
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${path} en ${width} px`).toBeLessThanOrEqual(width);
    }
  }
});
