import { describe, expect, it } from "vitest";
import { skillDomain } from "./skillDomain.js";

const skill = (tags: string[], name = "skill", description = "") => ({ tags, name, description });

describe("skillDomain", () => {
  it("lit le domaine dans les tags, le nom ou la description", () => {
    expect(skillDomain(skill(["wave"]))).toBe("payments");
    expect(skillDomain(skill([], "migrations-postgres"))).toBe("data");
    expect(skillDomain(skill([], "x", "Déployer avec Docker et Caddy."))).toBe("infra");
    expect(skillDomain(skill(["react"]))).toBe("front");
    expect(skillDomain(skill(["api"]))).toBe("back");
  });

  it("ne prend un mot court que s'il est entier", () => {
    expect(skillDomain(skill(["ia"]))).toBe("ai");
    expect(skillDomain(skill([], "x", "Une liste triée par date."))).toBe("other");
    expect(skillDomain(skill([], "x", "Un build plus rapide."))).toBe("other");
  });

  it("garde le premier domaine trouvé dans l'ordre fixé", () => {
    expect(skillDomain(skill(["api", "wave"]))).toBe("payments");
  });
});
