import { describe, expect, it } from "vitest";
import { computeCompetitionPhase } from "./competitions.js";

describe("computeCompetitionPhase", () => {
  const window = {
    registrationClosesAt: new Date("2026-11-01T00:00:00.000Z"),
    submissionClosesAt: new Date("2026-11-08T00:00:00.000Z"),
    votingClosesAt: new Date("2026-11-15T00:00:00.000Z"),
  };

  it("est en inscription avant la première échéance", () => {
    expect(computeCompetitionPhase(window, new Date("2026-10-31T00:00:00.000Z"))).toBe("registration");
  });

  it("passe en soumission dès la clôture des inscriptions", () => {
    expect(computeCompetitionPhase(window, new Date("2026-11-01T00:00:00.000Z"))).toBe("submission");
    expect(computeCompetitionPhase(window, new Date("2026-11-05T00:00:00.000Z"))).toBe("submission");
  });

  it("passe en vote dès la clôture des soumissions", () => {
    expect(computeCompetitionPhase(window, new Date("2026-11-08T00:00:00.000Z"))).toBe("voting");
  });

  it("est close dès la clôture du vote", () => {
    expect(computeCompetitionPhase(window, new Date("2026-11-15T00:00:00.000Z"))).toBe("closed");
    expect(computeCompetitionPhase(window, new Date("2027-01-01T00:00:00.000Z"))).toBe("closed");
  });
});
