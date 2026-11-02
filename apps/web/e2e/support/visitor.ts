import { expect, type Page } from "@playwright/test";

// Sur bureau, une carte en haut de la page ; sur mobile, une seule barre
// fixée au-dessus des onglets.
export async function expectVisitorInvitation(page: Page, isMobile: boolean) {
  if (isMobile) {
    const bar = page.getByRole("region", { name: "Compte" });
    await expect(bar.getByRole("link", { name: "Créer un compte" })).toBeVisible();
    await expect(page.getByText("Tu consultes Kemet sans compte.")).toBeHidden();
  } else {
    await expect(page.getByText("Tu consultes Kemet sans compte.")).toBeVisible();
  }
}
