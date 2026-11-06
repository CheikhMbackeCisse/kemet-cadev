import { describe, expect, it } from "vitest";
import { appendAssistantChunk, dropFailedStream, failureForViewer } from "./assistantStream.js";

const ASKER = "11111111-1111-4111-8111-111111111111";
const VIEWER = "22222222-2222-4222-8222-222222222222";
const TRIGGER = "33333333-3333-4333-8333-333333333333";

function failedEvent(errorCode: string) {
  return { invocationId: "a", errorCode, requestedBy: ASKER, triggerMessageId: TRIGGER };
}

describe("assistantStream", () => {
  it("ajoute les morceaux d'une même réponse", () => {
    const first = appendAssistantChunk(null, { invocationId: "a", delta: "Bon", recorded: false });
    expect(
      appendAssistantChunk(first, { invocationId: "a", delta: "jour", recorded: false }).text,
    ).toBe("Bonjour");
  });

  it("retire du fil une réponse commencée qui échoue", () => {
    const started = appendAssistantChunk(null, {
      invocationId: "a",
      delta: "Début",
      recorded: false,
    });
    expect(dropFailedStream(started, { invocationId: "a" })).toBeNull();
  });

  it("garde la réponse en cours quand l'échec concerne une autre question", () => {
    const ongoing = appendAssistantChunk(null, {
      invocationId: "b",
      delta: "Réponse",
      recorded: false,
    });
    expect(dropFailedStream(ongoing, { invocationId: "a" })).toBe(ongoing);
  });

  it("montre l'échec à la personne qui a posé la question", () => {
    expect(failureForViewer(failedEvent("assistant_unavailable"), ASKER)).toEqual({
      invocationId: "a",
      errorCode: "assistant_unavailable",
      triggerMessageId: TRIGGER,
    });
  });

  it("ne montre l'échec ni aux autres membres ni à un visiteur", () => {
    for (const code of ["assistant_unavailable", "quota_exceeded", "internal_error"]) {
      expect(failureForViewer(failedEvent(code), VIEWER)).toBeNull();
      expect(failureForViewer(failedEvent(code), null)).toBeNull();
    }
  });
});
