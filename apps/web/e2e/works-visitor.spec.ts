import { expect, test, type APIRequestContext } from "@playwright/test";
import { signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";

async function publishWork(request: APIRequestContext, slug: string, title: string, tag: string) {
  const response = await request.post("/api/works", {
    data: {
      slug,
      title,
      type: "application",
      summary: "Un travail publié pour vérifier la mise en relation sans compte.",
      tags: [tag],
      stack: [],
      publishRightConfirmed: true,
      links: [],
    },
  });
  expect(response.ok(), `POST /api/works : ${response.status()}`).toBe(true);
}

test("un visiteur voit qui a travaillé sur un sujet proche, sans appeler Kocc", async ({
  page,
  request,
  playwright,
  baseURL,
}) => {
  const project = test.info().project.name;
  const stamp = `${project}-${Date.now()}`;
  const tag = `relie${Date.now()}`;
  const author = uniqueHandle("e2erela", project);
  const neighbour = uniqueHandle("e2erelb", project);

  await signUpVerifyAndSignIn(request, `${author}@test.kemet`, author);
  await publishWork(request, `sujet-${stamp}`, "Le sujet", tag);
  const neighbourRequest = await playwright.request.newContext({ baseURL });
  await signUpVerifyAndSignIn(neighbourRequest, `${neighbour}@test.kemet`, neighbour);
  await publishWork(neighbourRequest, `voisin-${stamp}`, "Le travail voisin", tag);
  await neighbourRequest.dispose();

  const assistantCalls: string[] = [];
  page.on("request", (sent) => {
    if (sent.url().includes("/api/work-matches")) assistantCalls.push(sent.url());
  });
  await page.goto(`/travaux/sujet-${stamp}`);

  // Le bloc existe deux fois (sous le titre sur téléphone, colonne de droite
  // sur ordinateur) : seul celui de la largeur courante est affiché.
  const block = page.locator("section:visible", { hasText: "Qui a travaillé sur ce sujet ?" });
  await expect(block.getByText("1 personne a travaillé sur un sujet proche")).toBeVisible();
  await expect(block.getByRole("link", { name: neighbour })).toHaveAttribute(
    "href",
    `/u/${neighbour}`,
  );
  await expect(block.getByRole("link", { name: "Connecte-toi pour leur écrire" })).toBeVisible();
  expect(assistantCalls).toEqual([]);
});

test("sur téléphone, les filtres des travaux ont leur page et Entrée lance la recherche", async ({
  page,
}) => {
  test.skip(test.info().project.name !== "mobile", "téléphone seulement");

  await page.goto("/travaux");
  await page.getByRole("link", { name: "Filtres" }).click();
  await expect(page).toHaveURL(/\/travaux\/filtres$/);
  await page.getByLabel("Tag").fill("Hors-Ligne");
  await page.getByRole("button", { name: "Afficher les travaux" }).click();
  await expect(page).toHaveURL(/\/travaux\?tag=hors-ligne$/);
  await expect(page.getByRole("link", { name: "Filtres (1)" })).toBeVisible();

  await page.getByRole("searchbox").fill("manioc");
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/travaux\?q=manioc&tag=hors-ligne$/);
});
