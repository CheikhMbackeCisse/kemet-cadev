import { describe, expect, it } from "vitest";
import { healthcheckResponseSchema } from "./healthcheck.js";

describe("healthcheckResponseSchema", () => {
  it("accepte une réponse valide", () => {
    const result = healthcheckResponseSchema.safeParse({ status: "ok", service: "api" });
    expect(result.success).toBe(true);
  });

  it("rejette un service inconnu", () => {
    const result = healthcheckResponseSchema.safeParse({ status: "ok", service: "unknown" });
    expect(result.success).toBe(false);
  });
});
