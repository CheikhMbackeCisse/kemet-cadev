import { describe, expect, it } from "vitest";
import { fontPreloadTags } from "./preloadFonts.js";

describe("fontPreloadTags", () => {
  const files = [
    "assets/index-abc.js",
    "assets/plus-jakarta-sans-latin-400-normal-Dhut76fR.woff2",
    "assets/plus-jakarta-sans-latin-400-normal-BDKaGhyp.woff",
    "assets/plus-jakarta-sans-latin-ext-400-normal-D127hM_v.woff2",
    "assets/plus-jakarta-sans-latin-600-normal-DLTa1BUW.woff2",
    "assets/space-grotesk-latin-wght-normal-BhU9QXUp.woff2",
    "assets/space-grotesk-latin-ext-wght-normal-D9tNdqV9.woff2",
  ];

  it("précharge seulement le latin 400 de Jakarta et le latin de Space Grotesk, en woff2", () => {
    const tags = fontPreloadTags(files);
    expect(tags).toContain('href="/assets/plus-jakarta-sans-latin-400-normal-Dhut76fR.woff2"');
    expect(tags).toContain('href="/assets/space-grotesk-latin-wght-normal-BhU9QXUp.woff2"');
    expect(tags.match(/<link/g)).toHaveLength(2);
    expect(tags).toContain('as="font" type="font/woff2" crossorigin');
  });

  it("ne renvoie rien quand aucune police ne correspond", () => {
    expect(fontPreloadTags(["assets/index-abc.js"])).toBe("");
  });
});
