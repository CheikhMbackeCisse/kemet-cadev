import { expect, test, type APIRequestContext } from "@playwright/test";

export interface CreatedSpace {
  spaceId: string;
  generalId: string;
  memesId: string;
}

const MAX_ATTEMPTS = 3;

// Tous les parcours partagent l'adresse IP du runner, clé de la limite de
// création d'espaces (10 par minute) : un 429 attend la fenêtre suivante
// plutôt que de faire échouer un parcours qui ne teste pas cette limite.
export async function createPublicSpace(
  request: APIRequestContext,
  name: string,
  slug: string,
): Promise<CreatedSpace> {
  for (let attempt = 1; ; attempt++) {
    const response = await request.post("/api/spaces", {
      data: { name, slug, visibility: "public" },
    });
    if (response.status() === 429 && attempt < MAX_ATTEMPTS) {
      const waitMs = (Number(response.headers()["retry-after"] ?? "60") + 1) * 1000;
      test.info().setTimeout(test.info().timeout + waitMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }
    expect(response.ok()).toBe(true);
    const spaceId = (await response.json()).space.id as string;
    const channels = await request.get(`/api/spaces/${spaceId}/channels`);
    const items = (await channels.json()).items as { id: string; slug: string }[];
    return {
      spaceId,
      generalId: items.find((channel) => channel.slug === "general")!.id,
      memesId: items.find((channel) => channel.slug === "memes")!.id,
    };
  }
}
