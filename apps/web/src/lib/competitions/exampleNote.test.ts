import { describe, expect, it } from "vitest";
import { splitExampleNote } from "./exampleNote.js";

describe("splitExampleNote", () => {
  it("retire la mention d'exemple en tête de la description", () => {
    const description =
      "*Compétition d'exemple, créée pour la démonstration de Kemet. Ses dates sont calculées.*\n\nLe vrai sujet.";
    expect(splitExampleNote(description)).toEqual({ isExample: true, body: "Le vrai sujet." });
  });

  it("laisse une description ordinaire telle quelle", () => {
    expect(splitExampleNote("Un défi *en italique*.")).toEqual({
      isExample: false,
      body: "Un défi *en italique*.",
    });
  });
});
