import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ARRIVAL_PATH_PATTERN, arrivalMotionFor } from "./arrival.js";

describe("parcours d'arrivée", () => {
  afterEach(() => localStorage.clear());

  it("suit la même liste d'adresses que theme-init.js", () => {
    const script = readFileSync(resolve(import.meta.dirname, "../../../public/theme-init.js"), "utf8");
    expect(script).toContain(ARRIVAL_PATH_PATTERN.source);
  });

  it("pose le fond riche sur l'accueil et le fond calme sur le reste du parcours", () => {
    expect(arrivalMotionFor("/decouvrir")).toBe("rich");
    expect(arrivalMotionFor("/decouvrir/role")).toBe("calm");
    expect(arrivalMotionFor("/inscription")).toBe("calm");
    expect(arrivalMotionFor("/completer-profil")).toBe("calm");
    expect(arrivalMotionFor("/bienvenue/espaces")).toBe("calm");
    expect(arrivalMotionFor("/fil")).toBeNull();
    expect(arrivalMotionFor("/decouvrirx")).toBeNull();
  });

  it("pose le fond de l'accueil sur la racine d'une première visite seulement", () => {
    expect(arrivalMotionFor("/")).toBe("rich");
    localStorage.setItem("kemet.intro", JSON.stringify({ seen: true, answers: {} }));
    expect(arrivalMotionFor("/")).toBeNull();
  });
});
