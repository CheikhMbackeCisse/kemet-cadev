import { afterEach, describe, expect, it, vi } from "vitest";
import { LANGUAGE_STORAGE_KEY } from "./language.js";

async function loadTexts() {
  vi.resetModules();
  return (await import("./fr.js")).fr;
}

describe("textes de l'interface", () => {
  afterEach(() => window.localStorage.removeItem(LANGUAGE_STORAGE_KEY));

  it("restent en français sans choix enregistré", async () => {
    const texts = await loadTexts();
    expect(texts.feed.title).toBe("Fil");
    expect(texts.auth.signupSubmit).toBe("Créer mon compte");
    expect(texts.intro.start).toBe("Commencer");
  });

  it("passent en anglais quand l'anglais est choisi", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    const texts = await loadTexts();
    expect(texts.feed.title).toBe("Feed");
    expect(texts.auth.signupSubmit).toBe("Create my account");
    expect(texts.intro.start).toBe("Get started");
  });

  it("n'ont aucun texte anglais vide", async () => {
    const { en } = await import("./en.js");
    const empty: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (typeof value === "string") {
        if (value.trim() === "") empty.push(path);
      } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
      }
    };
    walk(en, "en");
    expect(empty).toEqual([]);
  });
});
