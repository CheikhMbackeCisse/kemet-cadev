import { CI_DOCKER_RECORDING, DESIGN_SYSTEM_RECORDING } from "@kemet/db";
import { describe, expect, it } from "vitest";
import { findRecordedAnswer, splitForReplay } from "./recorded-answers.js";

describe("findRecordedAnswer", () => {
  it("retrouve une question de démo retapée sans accents ni ponctuation", () => {
    const typed = "Mes tests E2E echouent au hasard sur GitHub Actions juste apres le demarrage des conteneurs une idee";
    expect(findRecordedAnswer(typed, [])).toBe(CI_DOCKER_RECORDING);
  });

  it("accepte le skill de l'enregistrement demandé explicitement", () => {
    expect(findRecordedAnswer(CI_DOCKER_RECORDING.question, ["ci-docker-fiable"])).toBe(CI_DOCKER_RECORDING);
  });

  it("refuse un autre skill demandé explicitement", () => {
    expect(findRecordedAnswer(DESIGN_SYSTEM_RECORDING.question, ["wave-paiements"])).toBeNull();
  });

  it("ne répond jamais à une question approchante", () => {
    expect(findRecordedAnswer("comment ajouter un thème sombre ?", [])).toBeNull();
    expect(findRecordedAnswer("", [])).toBeNull();
  });
});

describe("splitForReplay", () => {
  it("découpe sans rien perdre, sauts de ligne et blocs de code compris", () => {
    const chunks = splitForReplay(CI_DOCKER_RECORDING.answer);
    expect(chunks.length).toBeGreaterThan(10);
    expect(chunks.join("")).toBe(CI_DOCKER_RECORDING.answer);
  });
});
