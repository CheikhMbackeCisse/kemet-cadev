import { describe, expect, it } from "vitest";
import { createPostSchema } from "./post.js";

describe("createPostSchema", () => {
  it("accepte un post sans format", () => {
    const result = createPostSchema.safeParse({ body: "Un post simple." });
    expect(result.success).toBe(true);
  });

  it("rejette un post sans texte ni image", () => {
    const result = createPostSchema.safeParse({ body: "   " });
    expect(result.success).toBe(false);
  });

  it("accepte un post sans texte s'il a au moins une image", () => {
    const result = createPostSchema.safeParse({ body: "", attachmentIds: ["3f6b2b5a-2b1f-4c3e-9b1a-1a2b3c4d5e6f"] });
    expect(result.success).toBe(true);
  });

  it("rejette plus de quatre images sur un post", () => {
    const attachmentIds = [
      "3f6b2b5a-2b1f-4c3e-9b1a-1a2b3c4d5e61",
      "3f6b2b5a-2b1f-4c3e-9b1a-1a2b3c4d5e62",
      "3f6b2b5a-2b1f-4c3e-9b1a-1a2b3c4d5e63",
      "3f6b2b5a-2b1f-4c3e-9b1a-1a2b3c4d5e64",
      "3f6b2b5a-2b1f-4c3e-9b1a-1a2b3c4d5e65",
    ];
    const result = createPostSchema.safeParse({ body: "Un post.", attachmentIds });
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
