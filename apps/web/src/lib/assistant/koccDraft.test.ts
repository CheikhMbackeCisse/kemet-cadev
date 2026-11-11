import { describe, expect, it } from "vitest";
import { addKoccMention, asksKocc, removeKoccMention } from "./koccDraft.js";

describe("addKoccMention", () => {
  it("met @kocc en tête d'un brouillon vide, le curseur après l'espace", () => {
    expect(addKoccMention("")).toEqual({ value: "@kocc ", caret: 6 });
  });

  it("garde ce qui était écrit, derrière la mention", () => {
    expect(addKoccMention("  comment signer un webhook ?")).toEqual({
      value: "@kocc comment signer un webhook ?",
      caret: 6,
    });
  });

  it("n'ajoute pas une seconde mention, ni sur l'ancien @kemet", () => {
    expect(addKoccMention("@kocc pourquoi ?")).toEqual({ value: "@kocc pourquoi ?", caret: 6 });
    expect(addKoccMention("@kemet pourquoi ?")).toEqual({ value: "@kemet pourquoi ?", caret: 7 });
  });
});

describe("asksKocc", () => {
  it("reconnaît une question à Kocc en tête du brouillon", () => {
    expect(asksKocc("@kocc avec wave-paiements, comment ?")).toBe(true);
    expect(asksKocc("@Kemet bonjour")).toBe(true);
  });

  it("ignore une mention au milieu ou un identifiant plus long", () => {
    expect(asksKocc("merci @kocc")).toBe(false);
    expect(asksKocc("@kocc-fan salut")).toBe(false);
  });
});

describe("removeKoccMention", () => {
  it("retire seulement la mention de tête", () => {
    expect(removeKoccMention("@kocc comment faire ? merci @kocc")).toBe(
      "comment faire ? merci @kocc",
    );
  });
});
