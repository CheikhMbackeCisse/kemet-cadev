import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime.js";

const now = new Date("2026-11-08T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("formatRelativeTime", () => {
  it("donne une durée courte pour une date récente", () => {
    expect(formatRelativeTime(ago(20_000), now)).toBe("à l'instant");
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("il y a 5 min");
    expect(formatRelativeTime(ago(3 * 3_600_000 + 59 * 60_000), now)).toBe("il y a 3 h");
    expect(formatRelativeTime(ago(30 * 3_600_000), now)).toBe("hier");
    expect(formatRelativeTime(ago(4 * 86_400_000), now)).toBe("il y a 4 j");
  });

  it("traite une date future comme récente", () => {
    expect(formatRelativeTime(ago(-60_000), now)).toBe("à l'instant");
  });

  it("passe à la date au-delà d'une semaine, avec l'année si elle diffère", () => {
    expect(formatRelativeTime("2026-10-12T10:00:00Z", now)).toBe("12 oct.");
    expect(formatRelativeTime("2025-10-12T10:00:00Z", now)).toBe("12 oct. 2025");
  });
});
