import { expect, test, type Locator, type Page } from "@playwright/test";

// Un vrai geste tactile : appui, déplacements, relâchement, envoyés par le
// protocole de Chrome comme le ferait l'écran d'un téléphone.
async function swipe(page: Page, on: Locator, direction: "left" | "right") {
  const box = await on.boundingBox();
  if (!box) throw new Error("élément hors de l'écran");
  const viewport = page.viewportSize()!;
  const y = box.y + box.height / 2;
  const [fromX, toX] =
    direction === "left"
      ? [viewport.width * 0.8, viewport.width * 0.2]
      : [viewport.width * 0.2, viewport.width * 0.8];
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(fromX) });
  for (let step = 1; step <= 6; step += 1) {
    const x = fromX + ((toX - fromX) * step) / 6;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(x) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test.skip(({ isMobile }) => !isMobile, "geste propre au téléphone");
// Chaque test charge trois écrans sur un téléphone émulé.
test.describe.configure({ timeout: 60_000 });

test("un glissement change d'onglet dans le fil, puis passe à l'onglet voisin de la barre du bas", async ({
  page,
}) => {
  await page.goto("/fil");
  const tabs = page.getByRole("tablist");
  await expect(page.getByRole("tab", { name: "Pour toi" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await swipe(page, tabs, "left");
  await expect(page.getByRole("tab", { name: "Projets" })).toHaveAttribute("aria-selected", "true");
  await swipe(page, tabs, "left");
  await expect(page.getByRole("tab", { name: "Opportunités" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await swipe(page, tabs, "left");
  await expect(page).toHaveURL(/\/salons/);

  const channel = page.getByRole("button", { name: "général" }).first();
  await expect(channel).toBeVisible();
  await swipe(page, channel, "right");
  await expect(page).toHaveURL(/\/fil/);
});

test("un glissement parti d'un champ, dans un salon ouvert ou avec le mouvement réduit ne change pas d'onglet", async ({
  page,
}) => {
  await page.goto("/skills");
  const search = page.getByRole("searchbox", { name: "Chercher un skill" });
  await expect(search).toBeVisible();
  await swipe(page, search, "left");
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/skills$/);

  await page.goto("/salons");
  await page.getByRole("button", { name: "général" }).first().click();
  const room = page.url();
  await swipe(page, page.getByRole("log").first(), "left");
  await page.waitForTimeout(500);
  expect(page.url()).toBe(room);

  await page.goto("/skills");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await swipe(page, page.getByRole("heading", { level: 1 }), "left");
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/skills$/);
});
