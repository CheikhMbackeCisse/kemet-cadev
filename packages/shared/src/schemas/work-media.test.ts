import { describe, expect, it } from "vitest";
import { parseYoutubeId, workMediaFieldsSchema } from "./work-media.js";

const ID = "dQw4w9WgXcQ";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("parseYoutubeId", () => {
  it("lit les formes de lien courantes", () => {
    expect(parseYoutubeId(`https://www.youtube.com/watch?v=${ID}&t=42`)).toBe(ID);
    expect(parseYoutubeId(`https://youtu.be/${ID}?si=abc`)).toBe(ID);
    expect(parseYoutubeId(`https://m.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://youtube.com/live/${ID}`)).toBe(ID);
  });

  it("refuse un autre site, le HTTP simple et un identifiant malformé", () => {
    expect(parseYoutubeId(`https://example.com/watch?v=${ID}`)).toBeNull();
    expect(parseYoutubeId(`https://youtube.com.evil.dev/watch?v=${ID}`)).toBeNull();
    expect(parseYoutubeId(`http://youtu.be/${ID}`)).toBeNull();
    expect(parseYoutubeId("https://youtu.be/court")).toBeNull();
    expect(parseYoutubeId(`https://youtu.be/${ID}"><script>`)).toBeNull();
    expect(parseYoutubeId("pas un lien")).toBeNull();
  });
});

describe("workMediaFieldsSchema", () => {
  it("transforme les liens en identifiants", () => {
    const parsed = workMediaFieldsSchema.parse({
      media: [],
      youtubeUrls: [`https://youtu.be/${ID}`],
    });
    expect(parsed.youtubeUrls).toEqual([ID]);
  });

  it("refuse deux couvertures, un fichier en double et plus de trois vidéos", () => {
    expect(
      workMediaFieldsSchema.safeParse({
        media: [
          { id: uuid(1), role: "cover" },
          { id: uuid(2), role: "cover" },
        ],
        youtubeUrls: [],
      }).success,
    ).toBe(false);
    expect(
      workMediaFieldsSchema.safeParse({
        media: [
          { id: uuid(1), role: "gallery" },
          { id: uuid(1), role: "gallery" },
        ],
        youtubeUrls: [],
      }).success,
    ).toBe(false);
    expect(
      workMediaFieldsSchema.safeParse({
        media: [
          { id: uuid(1), role: "video" },
          { id: uuid(2), role: "video" },
        ],
        youtubeUrls: [`https://youtu.be/${ID}`, "https://youtu.be/aaaaaaaaaaa"],
      }).success,
    ).toBe(false);
  });
});
