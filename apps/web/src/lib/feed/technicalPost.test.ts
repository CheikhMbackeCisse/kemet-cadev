import { describe, expect, it } from "vitest";
import { isTechnicalPost } from "./technicalPost.js";

describe("isTechnicalPost", () => {
  it("reconnaît un bloc ou un morceau de code", () => {
    expect(isTechnicalPost("Regardez :\n```ts\nconst a = 1;\n```")).toBe(true);
    expect(isTechnicalPost("Pensez à `await` ici.")).toBe(true);
  });

  it("reconnaît un mot technique entier, sans tenir compte de la casse", () => {
    expect(isTechnicalPost("Mon API Laravel renvoie une 500.")).toBe(true);
    expect(isTechnicalPost("Une base de données pour débuter ?")).toBe(true);
  });

  it("ignore un mot technique caché dans un autre mot", () => {
    expect(isTechnicalPost("Une réponse rapide et un gâteau.")).toBe(false);
  });

  it("ignore un post sans sujet technique", () => {
    expect(isTechnicalPost("Belle journée à Dakar, bon week-end à tous !")).toBe(false);
  });
});
