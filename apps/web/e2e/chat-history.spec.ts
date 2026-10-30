import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";
import { createPublicSpace, type CreatedSpace } from "./support/spaces.js";

type Room = CreatedSpace;

function createRoom(request: APIRequestContext, slug: string): Promise<Room> {
  return createPublicSpace(request, `Espace ${slug}`, slug);
}

// Un message de plusieurs lignes occupe assez de hauteur pour que trois
// d'entre eux dépassent la liste : la limite d'envoi d'un compte neuf
// interdit d'en envoyer des dizaines.
function tallBody(label: string): string {
  return [label, ...Array.from({ length: 11 }, (_, line) => `Ligne ${line + 1} de ${label}`)].join(
    "\n",
  );
}

async function post(request: APIRequestContext, channelId: string, body: string) {
  const response = await request.post(`/api/channels/${channelId}/messages`, {
    data: { clientId: crypto.randomUUID(), body },
  });
  expect(response.ok()).toBe(true);
}

function roomUrl(room: Room, channelId: string): string {
  return `/salons?space=${room.spaceId}&channel=${channelId}`;
}

async function shortenViewport(page: Page) {
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.width, height: 560 });
}

test("ouvre le salon sur le dernier message, signale les nouveaux et propose d'y descendre", async ({
  page,
  request,
}) => {
  const project = test.info().project.name;
  const authorHandle = uniqueHandle("e2ehista", project);
  const readerHandle = uniqueHandle("e2ehistb", project);
  await signUpVerifyAndSignIn(request, `${authorHandle}@test.kemet`, authorHandle);
  await signUpVerifyAndSignIn(page.request, `${readerHandle}@test.kemet`, readerHandle);

  const room = await createRoom(request, authorHandle);
  for (const label of ["Premier", "Deuxième", "Troisième"]) {
    await post(request, room.generalId, tallBody(`${label} ${authorHandle}`));
  }
  // Arrivée dans l'espace après ces messages : rien n'est nouveau pour elle.
  await request.post(`/api/spaces/${room.spaceId}/members`, { data: { handle: readerHandle } });

  await shortenViewport(page);
  await page.goto(roomUrl(room, room.generalId));
  const messageList = page.getByRole("log", { name: "Messages du salon" });

  await expect(messageList.getByText(`Troisième ${authorHandle}`)).toBeInViewport();
  await expect(messageList.getByText(`Premier ${authorHandle}`)).not.toBeInViewport();
  await expect(messageList.getByRole("separator", { name: "Nouveaux messages" })).toHaveCount(0);

  // Lecture plus haut : un message qui arrive ne fait pas sauter la lecture.
  await messageList.evaluate((list) => list.scrollTo({ top: 0 }));
  await expect(messageList.getByText(`Premier ${authorHandle}`)).toBeInViewport();
  await post(request, room.generalId, tallBody(`Quatrième ${authorHandle}`));
  const jump = page.getByRole("button", { name: "Aller au dernier message" });
  await expect(jump).toBeVisible();
  await expect(messageList.getByText(`Premier ${authorHandle}`)).toBeInViewport();

  await jump.click();
  await expect(messageList.getByText(`Quatrième ${authorHandle}`)).toBeInViewport();
  await expect(jump).toBeHidden();
  await expect(messageList).toBeFocused();

  // Absente, puis de retour : le salon s'ouvre sur le premier message non lu.
  await page.goto("/fil");
  await post(request, room.generalId, `Cinquième ${authorHandle}`);
  await page.goto(roomUrl(room, room.generalId));
  const separator = messageList.getByRole("separator", { name: "Nouveaux messages" });
  await expect(separator).toBeInViewport();
  const separatorBox = (await separator.boundingBox())!;
  const fourthBox = (await messageList.getByText(`Quatrième ${authorHandle}`).boundingBox())!;
  const fifthBox = (await messageList.getByText(`Cinquième ${authorHandle}`).boundingBox())!;
  expect(fourthBox.y).toBeLessThan(separatorBox.y);
  expect(separatorBox.y).toBeLessThan(fifthBox.y);
});

test("garde le brouillon de chaque salon et le focus du composeur après l'envoi", async ({
  page,
}) => {
  const project = test.info().project.name;
  const handle = uniqueHandle("e2edraft", project);
  await signUpVerifyAndSignIn(page.request, `${handle}@test.kemet`, handle);
  const room = await createRoom(page.request, handle);

  await page.goto(roomUrl(room, room.generalId));
  const composer = page.getByPlaceholder("Écrire un message…");
  const draft = `Brouillon de ${handle}`;
  await composer.fill(draft);

  // Changement de salon par l'interface, puis retour.
  if (project === "mobile")
    await page.getByRole("button", { name: "Ouvrir la liste des salons" }).click();
  await page.getByRole("button", { name: "mèmes" }).filter({ visible: true }).click();
  await expect(composer).toHaveValue("");
  if (project === "mobile")
    await page.getByRole("button", { name: "Ouvrir la liste des salons" }).click();
  await page.getByRole("button", { name: "général" }).filter({ visible: true }).click();
  await expect(composer).toHaveValue(draft);

  // Le brouillon survit aussi à un rechargement de la page.
  await page.reload();
  await expect(composer).toHaveValue(draft);

  const send = page.getByRole("button", { name: "Envoyer" });
  if (project === "mobile") {
    const box = (await send.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await composer.focus();
  await send.click();
  await expect(page.getByRole("log", { name: "Messages du salon" }).getByText(draft)).toBeVisible();
  await expect(composer).toHaveValue("");
  await expect(composer).toBeFocused();
});
