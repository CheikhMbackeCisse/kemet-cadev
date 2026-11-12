import { describe, expect, it } from "vitest";
import { KEMET_ASSISTANT_PROFILE_ID } from "../chat/kemet-assistant.js";
import { shownLevel } from "./serializers.js";

describe("shownLevel", () => {
  it("garde le niveau d'une personne", () => {
    expect(
      shownLevel({ id: "00000000-0000-4000-8000-000000000001", kind: "person" }, "scribe"),
    ).toBe("scribe");
  });

  it("n'en donne aucun à une organisation", () => {
    expect(
      shownLevel({ id: "00000000-0000-4000-8000-000000000002", kind: "organization" }, "apprenti"),
    ).toBeNull();
  });

  it("n'en donne aucun au profil de l'assistant", () => {
    expect(shownLevel({ id: KEMET_ASSISTANT_PROFILE_ID, kind: "person" }, "apprenti")).toBeNull();
  });
});
