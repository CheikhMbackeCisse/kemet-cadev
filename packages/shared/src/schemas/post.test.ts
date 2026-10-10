import { describe, expect, it } from "vitest";
import { createPostSchema } from "./post.js";

describe("createPostSchema", () => {
  it("accepte un post sans format", () => {
    const result = createPostSchema.safeParse({ body: "Un post simple." });
    expect(result.success).toBe(true);
  });

  it("rejette un post sans texte", () => {
    const result = createPostSchema.safeParse({ body: "   " });
    expect(result.success).toBe(false);
  });

  it("rejette un lien de démo sur un post qui n'est pas À tester", () => {
    const result = createPostSchema.safeParse({ body: "Un post.", testUrl: "https://example.com" });
    expect(result.success).toBe(false);
  });

  it("rejette un post À tester sans lien de démo", () => {
    const result = createPostSchema.safeParse({ body: "Un post.", format: "a_tester" });
    expect(result.success).toBe(false);
  });

  it("rejette un lien javascript: sur un post À tester", () => {
    const result = createPostSchema.safeParse({
      body: "Un post.",
      format: "a_tester",
      testUrl: "javascript:alert(document.cookie)",
    });
    expect(result.success).toBe(false);
  });

  it("accepte un post À tester avec un lien de démo", () => {
    const result = createPostSchema.safeParse({
      body: "Un post.",
      format: "a_tester",
      testUrl: "https://example.com/demo",
      testAsk: "Dites-moi si l'inscription fonctionne.",
    });
    expect(result.success).toBe(true);
  });
});
