import type { Page } from "@playwright/test";

/** Pour un test qui ne porte pas sur l'accueil : le navigateur l'a déjà vu. */
export async function skipIntro(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("kemet.intro", JSON.stringify({ seen: true, answers: {} }));
  });
}
