import { describe, expect, it } from "vitest";
import { interleaveProjects } from "./interleave.js";

const posts = (count: number) => Array.from({ length: count }, (_, index) => `post-${index + 1}`);

function kinds(entries: { kind: string; item: string }[]) {
  return entries.map((entry) => entry.item);
}

describe("interleaveProjects", () => {
  it("place un projet après chaque groupe de cinq posts, dans l'ordre du classement", () => {
    const entries = interleaveProjects(posts(11), ["projet-a", "projet-b", "projet-c"]);
    expect(kinds(entries)).toEqual([
      "post-1",
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "projet-a",
      "post-6",
      "post-7",
      "post-8",
      "post-9",
      "post-10",
      "projet-b",
      "post-11",
    ]);
  });

  it("ne montre aucun projet dans un fil de moins de cinq posts", () => {
    expect(interleaveProjects(posts(4), ["projet-a"]).every((entry) => entry.kind === "post")).toBe(
      true,
    );
  });

  it("garde tous les posts quand il n'y a aucun projet", () => {
    expect(interleaveProjects(posts(10), [])).toHaveLength(10);
  });
});
