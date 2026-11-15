import type { MeResponse } from "@kemet/shared";
import { describe, expect, it } from "vitest";
import { publishesOffers } from "./publishesOffers.js";

type Profile = NonNullable<MeResponse["profile"]>;

function profile(kind: Profile["kind"], role: Profile["role"]): Profile {
  return { kind, role } as Profile;
}

describe("publishesOffers", () => {
  it("montre le raccourci aux recruteurs, aux entrepreneurs et aux organisations", () => {
    expect(publishesOffers(profile("person", "hr"))).toBe(true);
    expect(publishesOffers(profile("person", "entrepreneur"))).toBe(true);
    expect(publishesOffers(profile("organization", null))).toBe(true);
  });

  it("ne le montre ni aux autres rôles ni sans profil", () => {
    expect(publishesOffers(profile("person", "developer"))).toBe(false);
    expect(publishesOffers(profile("person", "student"))).toBe(false);
    expect(publishesOffers(profile("person", null))).toBe(false);
    expect(publishesOffers(null)).toBe(false);
  });
});
