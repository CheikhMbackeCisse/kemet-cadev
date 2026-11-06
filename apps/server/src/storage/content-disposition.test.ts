import { describe, expect, it } from "vitest";
import { contentDisposition } from "./content-disposition.js";

describe("contentDisposition", () => {
  it("garde un nom ASCII tel quel et encode le nom exact", () => {
    expect(contentDisposition("attachment", "rapport.pdf")).toBe(
      "attachment; filename=\"rapport.pdf\"; filename*=UTF-8''rapport.pdf",
    );
  });

  it("remplace les caractères hors ASCII dans le nom de repli", () => {
    const header = contentDisposition("inline", "Mémoire d’ingénieur.pdf");
    expect(header).toMatch(/^inline; filename="M_moire d_ing_nieur\.pdf"; filename\*=UTF-8''/);
    expect(/^[\x20-\x7e]*$/.test(header)).toBe(true);
  });
});
