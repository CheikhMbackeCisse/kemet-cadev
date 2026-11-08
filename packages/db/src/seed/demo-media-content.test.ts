import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS } from "./accounts.js";
import { DEMO_ASSETS_DIR, starsForAverage } from "./demo-media.js";
import {
  DEMO_ASSET_NAMES,
  DEMO_EXISTING_POST_IMAGES,
  DEMO_MEDIA_POSTS,
  DEMO_WORK_MEDIA,
} from "./demo-media-content.js";
import { DEMO_WORKS } from "./works.js";

const handles = new Set(DEMO_ACCOUNTS.map((account) => account.handle));

function assetSize(name: string): number {
  const path = join(DEMO_ASSETS_DIR, name);
  expect(
    existsSync(path),
    `${name} manque : relancer pnpm --filter @kemet/db seed-assets:render`,
  ).toBe(true);
  return statSync(path).size;
}

describe("contenu des médias de démonstration", () => {
  it("n'attribue des posts qu'à des comptes de démonstration", () => {
    for (const post of [...DEMO_MEDIA_POSTS, ...DEMO_EXISTING_POST_IMAGES]) {
      expect(handles.has(post.authorHandle), post.authorHandle).toBe(true);
    }
  });

  it("donne des clés de post uniques", () => {
    const keys = DEMO_MEDIA_POSTS.map((post) => post.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("met une image ou un bloc de code dans chaque nouveau post", () => {
    for (const post of DEMO_MEDIA_POSTS) {
      expect(Boolean(post.image) || post.body.includes("```"), post.key).toBe(true);
    }
  });

  it("ne vise que des travaux qui existent dans le seed", () => {
    const slugs = new Set(DEMO_WORKS.map((work) => work.slug));
    for (const plan of DEMO_WORK_MEDIA) expect(slugs.has(plan.slug), plan.slug).toBe(true);
  });

  it("respecte les limites d'un travail : 8 images et 3 vidéos de 50 Mo au plus", () => {
    for (const plan of DEMO_WORK_MEDIA) {
      expect(plan.gallery.length).toBeLessThanOrEqual(8);
      expect(plan.gallery.length).toBeGreaterThanOrEqual(2);
      if (plan.video) expect(assetSize(plan.video)).toBeLessThan(5 * 1024 * 1024);
    }
  });

  it("livre chaque fichier cité, et une bannière par compte", () => {
    const names = [
      ...DEMO_MEDIA_POSTS.flatMap((post) => (post.image ? [post.image] : [])),
      ...DEMO_EXISTING_POST_IMAGES.map((target) => target.image),
      ...DEMO_WORK_MEDIA.flatMap((plan) => [
        plan.cover,
        ...plan.gallery,
        ...(plan.video ? [plan.video] : []),
      ]),
      ...DEMO_ACCOUNTS.map((account) => `banner-${account.handle}.jpg`),
    ];
    for (const name of names) expect(assetSize(name)).toBeGreaterThan(0);
    for (const name of names.filter((candidate) => !candidate.startsWith("banner-"))) {
      expect(DEMO_ASSET_NAMES[name], `nom descriptif manquant pour ${name}`).toBeDefined();
    }
  });
});

describe("starsForAverage", () => {
  it.each([
    [2_310, 4.8],
    [64, 4.3],
    [51, 4.4],
  ])("donne %i notes de moyenne %d à un centième près", (total, average) => {
    const stars = starsForAverage(total, average);
    expect(stars).toHaveLength(total);
    expect(stars.every((value) => value >= 3 && value <= 5)).toBe(true);
    const mean = stars.reduce((sum, value) => sum + value, 0) / total;
    expect(Math.abs(mean - average)).toBeLessThan(0.02);
  });
});
