import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const seedDirectory = fileURLToPath(new URL(".", import.meta.url));
const DEMO_LINK = /^https:\/\/([a-z0-9-]+\.)*demo\.kemetlabs\.dev(\/|$)/;
// Espace de noms XML des avatars SVG, jamais affiché comme un lien.
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// Un lien vers un domaine tiers (GitHub, GitLab, Hugging Face...) peut
// pointer vers le compte d'une vraie personne qui porte le même nom qu'un
// compte de démonstration.
describe("liens des données de démonstration", () => {
  it("ne pointent que vers le domaine de démonstration", () => {
    const foreignUrls = readdirSync(seedDirectory)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .flatMap((file) =>
        [...readFileSync(`${seedDirectory}/${file}`, "utf8").matchAll(/https?:\/\/[^\s"'`)]+/g)]
          .map(([url]) => url)
          .filter((url) => url !== SVG_NAMESPACE && !DEMO_LINK.test(url))
          .map((url) => `${file}: ${url}`),
      );
    expect(foreignUrls).toEqual([]);
  });
});
