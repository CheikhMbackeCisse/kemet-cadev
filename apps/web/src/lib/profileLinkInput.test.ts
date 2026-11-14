import { describe, expect, it } from "vitest";
import { linkFromInput, linkInputValue } from "./profileLinkInput.js";

describe("linkInputValue", () => {
  it("montre l'identifiant seul d'une adresse de forge ou de LinkedIn", () => {
    expect(linkInputValue("github", "https://github.com/awa-diop")).toBe("awa-diop");
    expect(linkInputValue("gitlab", "https://www.gitlab.com/awa/")).toBe("awa");
    expect(linkInputValue("linkedin", "https://www.linkedin.com/in/awa-diop/")).toBe("awa-diop");
    expect(linkInputValue("linkedin", "https://sn.linkedin.com/in/awa")).toBe("awa");
  });

  it("garde l'adresse entière quand elle ne suit pas la forme du service", () => {
    expect(linkInputValue("linkedin", "https://www.linkedin.com/company/kemet")).toBe(
      "https://www.linkedin.com/company/kemet",
    );
    expect(linkInputValue("portfolio", "https://awa.dev")).toBe("https://awa.dev");
  });
});

describe("linkFromInput", () => {
  it("ajoute le préfixe du service à un identifiant", () => {
    expect(linkFromInput("github", "awa-diop")).toBe("https://github.com/awa-diop");
    expect(linkFromInput("github", "@awa-diop")).toBe("https://github.com/awa-diop");
    expect(linkFromInput("linkedin", " awa-diop/ ")).toBe("https://linkedin.com/in/awa-diop");
  });

  it("accepte une adresse collée en entier", () => {
    expect(linkFromInput("github", "https://github.com/awa-diop/")).toBe("https://github.com/awa-diop");
    expect(linkFromInput("linkedin", "www.linkedin.com/in/awa")).toBe("https://linkedin.com/in/awa");
    expect(linkFromInput("linkedin", "https://www.linkedin.com/company/kemet")).toBe(
      "https://www.linkedin.com/company/kemet",
    );
  });

  it("laisse vide un champ vide, et telles quelles les adresses du portfolio et du site", () => {
    expect(linkFromInput("gitlab", "  ")).toBeNull();
    expect(linkFromInput("website", "https://awa.dev")).toBe("https://awa.dev");
  });
});
