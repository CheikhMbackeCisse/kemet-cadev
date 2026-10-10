import { describe, expect, it } from "vitest";
import { httpUrlSchema } from "./url.js";

describe("httpUrlSchema", () => {
  const schema = httpUrlSchema(500);

  it("accepte une URL https", () => {
    expect(schema.safeParse("https://example.com/demo").success).toBe(true);
  });

  it("accepte une URL http", () => {
    expect(schema.safeParse("http://example.com").success).toBe(true);
  });

  it("rejette un lien javascript:", () => {
    expect(schema.safeParse("javascript:alert(1)").success).toBe(false);
  });

  it("rejette un lien data:", () => {
    expect(schema.safeParse("data:text/html,<script>alert(1)</script>").success).toBe(false);
  });

  it("rejette une chaîne qui n'est pas une URL", () => {
    expect(schema.safeParse("pas une url").success).toBe(false);
  });
});
