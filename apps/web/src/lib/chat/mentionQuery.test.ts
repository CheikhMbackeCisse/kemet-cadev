import { describe, expect, it } from "vitest";
import { applySuggestion, findMentionQuery } from "./mentionQuery.js";

describe("findMentionQuery", () => {
  it("finds a handle being typed after a space or at the start", () => {
    expect(findMentionQuery("@ami", 4)).toEqual({ kind: "profile", query: "ami", start: 1 });
    expect(findMentionQuery("salut @ami", 10)).toEqual({ kind: "profile", query: "ami", start: 7 });
  });

  it("offers suggestions as soon as @ is typed", () => {
    expect(findMentionQuery("salut @", 7)).toEqual({ kind: "profile", query: "", start: 7 });
  });

  it("ignores an @ inside a word, such as an email address", () => {
    expect(findMentionQuery("ecris a moi@exem", 16)).toBeNull();
  });

  it("stops once the handle is followed by a space", () => {
    expect(findMentionQuery("@amina ", 7)).toBeNull();
  });

  it("only looks at the text before the caret", () => {
    expect(findMentionQuery("@amina bonjour", 3)).toEqual({
      kind: "profile",
      query: "am",
      start: 1,
    });
  });

  it("switches to skills after @kocc avec", () => {
    expect(findMentionQuery("@kocc avec wave", 15)).toEqual({
      kind: "skill",
      query: "wave",
      start: 11,
    });
    // L'ancienne mention ouvre toujours les suggestions de skills.
    expect(findMentionQuery("@Kemet  avec ", 13)).toEqual({ kind: "skill", query: "", start: 13 });
  });
});

describe("applySuggestion", () => {
  it("replaces the partial handle and puts the caret after a space", () => {
    const query = findMentionQuery("salut @am et toi", 9)!;
    expect(applySuggestion("salut @am et toi", 9, query, "amina-diallo")).toEqual({
      text: "salut @amina-diallo  et toi",
      caret: 20,
    });
  });
});
