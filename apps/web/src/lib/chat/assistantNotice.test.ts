import { beforeEach, describe, expect, it } from "vitest";
import { markAssistantNoticeSeen, shouldShowAssistantNotice } from "./assistantNotice.js";

describe("shouldShowAssistantNotice", () => {
  beforeEach(() => localStorage.clear());

  it("s'affiche quand le brouillon appelle @kemet pour la première fois", () => {
    expect(shouldShowAssistantNotice("@kemet comment faire un webhook ?")).toBe(true);
  });

  it("ne s'affiche pas sans mention de l'assistant", () => {
    expect(shouldShowAssistantNotice("ping @kemetien")).toBe(false);
    expect(shouldShowAssistantNotice("bonjour")).toBe(false);
  });

  it("ne s'affiche plus après un premier appel envoyé", () => {
    markAssistantNoticeSeen();
    expect(shouldShowAssistantNotice("@kemet encore une question")).toBe(false);
  });
});
