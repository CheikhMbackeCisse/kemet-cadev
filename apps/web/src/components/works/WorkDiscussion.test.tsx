import { describe, expect, it } from "vitest";
import { suggestedMessages } from "./WorkDiscussion.js";

describe("suggestedMessages", () => {
  it("propose trois débuts de message, avec le titre et le premier tag", () => {
    expect(suggestedMessages({ title: "Capteurs LoRa", tags: ["iot", "agriculture"] })).toEqual([
      `Bonjour, j'ai lu le travail « Capteurs LoRa ».`,
      "Une question sur la partie iot : ",
      "Je travaille sur un sujet proche, on peut échanger ?",
    ]);
  });

  it("saute la question sur le tag quand le travail n'en a pas", () => {
    expect(suggestedMessages({ title: "Capteurs LoRa", tags: [] })).toHaveLength(2);
  });
});
