import { describe, expect, it } from "vitest";
import { isValidProfileLink } from "./profile-link.js";

describe("isValidProfileLink", () => {
  it("accepte un lien https vers le bon service", () => {
    expect(isValidProfileLink("github", "https://github.com/awa")).toBe(true);
    expect(isValidProfileLink("gitlab", "https://gitlab.com/awa")).toBe(true);
    expect(isValidProfileLink("linkedin", "https://www.linkedin.com/in/awa")).toBe(true);
    expect(isValidProfileLink("portfolio", "https://awa.dev")).toBe(true);
  });

  it("refuse un autre protocole, des identifiants ou un faux domaine", () => {
    expect(isValidProfileLink("website", "javascript:alert(1)")).toBe(false);
    expect(isValidProfileLink("website", "http://awa.dev")).toBe(false);
    expect(isValidProfileLink("github", "https://github.com.evil.com/x")).toBe(false);
    expect(isValidProfileLink("github", "https://user:pw@github.com/x")).toBe(false);
    expect(isValidProfileLink("linkedin", "https://linkedin.com.evil.com/in/x")).toBe(false);
  });

  it("refuse un lien de service sans chemin", () => {
    expect(isValidProfileLink("github", "https://github.com/")).toBe(false);
  });
});
