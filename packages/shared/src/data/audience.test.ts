import { describe, expect, it } from "vitest";
import { isBeginnerAudience, prefersTalentFeed } from "./audience.js";

describe("isBeginnerAudience", () => {
  it("retient le rôle Étudiant, quels que soient les domaines", () => {
    expect(isBeginnerAudience({ role: "student", interests: ["web"], intents: [] })).toBe(true);
  });

  it("retient l'intention Apprendre sans aucun domaine", () => {
    expect(isBeginnerAudience({ role: null, interests: [], intents: ["learn"] })).toBe(true);
    expect(isBeginnerAudience({ role: null, interests: ["data"], intents: ["learn"] })).toBe(false);
  });

  it("ne retient pas un compte qui n'a répondu à rien", () => {
    expect(isBeginnerAudience({ role: null, interests: [], intents: [] })).toBe(false);
  });
});

describe("prefersTalentFeed", () => {
  it("vaut pour les RH et les entrepreneurs seulement", () => {
    expect(prefersTalentFeed("hr")).toBe(true);
    expect(prefersTalentFeed("entrepreneur")).toBe(true);
    expect(prefersTalentFeed("developer")).toBe(false);
    expect(prefersTalentFeed(null)).toBe(false);
  });
});
