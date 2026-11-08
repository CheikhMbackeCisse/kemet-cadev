import { describe, expect, it } from "vitest";
import { isNewAccount } from "./anti-spam.js";
import { loadAntiSpamConfig } from "./anti-spam-config.js";
import type { AntiSpamConfig } from "./anti-spam-config.js";

const config: AntiSpamConfig = { newAccountWindowHours: 24, newAccountFactor: 0.25, anonymousIpFactor: 3 };

describe("isNewAccount", () => {
  it("considère un compte créé il y a une heure comme récent", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const createdAt = new Date("2026-01-01T23:00:00Z");
    expect(isNewAccount(createdAt, config, now)).toBe(true);
  });

  it("considère un compte créé il y a 25 heures comme établi", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const createdAt = new Date("2025-12-31T23:00:00Z");
    expect(isNewAccount(createdAt, config, now)).toBe(false);
  });

  it("considère la limite exacte de la fenêtre comme déjà établie", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const createdAt = new Date("2026-01-01T00:00:00Z");
    expect(isNewAccount(createdAt, config, now)).toBe(false);
  });
});

describe("loadAntiSpamConfig", () => {
  it("plafonne le facteur des requêtes sans session", () => {
    expect(loadAntiSpamConfig({ RATE_LIMIT_ANONYMOUS_IP_FACTOR: "1000000000" }).anonymousIpFactor).toBe(10);
  });

  it("garde 3 par défaut et ignore une valeur vide", () => {
    expect(loadAntiSpamConfig({ RATE_LIMIT_ANONYMOUS_IP_FACTOR: "" }).anonymousIpFactor).toBe(3);
  });
});
