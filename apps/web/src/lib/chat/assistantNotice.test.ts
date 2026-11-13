import { describe, expect, it } from "vitest";
import { mentionsAssistant } from "./assistantNotice.js";

describe("mentionsAssistant", () => {
  it("reconnaît @kocc et l'ancien @kemet", () => {
    expect(mentionsAssistant("@kocc comment faire un webhook ?")).toBe(true);
    expect(mentionsAssistant("tu peux voir @kemet ?")).toBe(true);
  });

  it("ignore un identifiant plus long et un texte sans mention", () => {
    expect(mentionsAssistant("ping @kemetien")).toBe(false);
    expect(mentionsAssistant("bonjour")).toBe(false);
  });
});
