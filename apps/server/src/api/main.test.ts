import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { healthcheckResponseSchema } from "@kemet/shared";

describe("GET /health (api)", () => {
  it("répond ok", async () => {
    const app = Fastify();
    app.get("/health", async () =>
      healthcheckResponseSchema.parse({ status: "ok", service: "api" }),
    );

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });
  });
});
