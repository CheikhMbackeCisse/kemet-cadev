import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichText } from "./RichText.js";

// RichText charge son moteur Markdown à la demande : attendre que le texte
// brut affiché en attendant ait été remplacé.
async function renderRichText(source: string) {
  const result = render(<RichText source={source} />);
  // Le premier import du module, transformé à la volée par Vitest, dépasse
  // le délai par défaut de waitFor (1 s) ; les suivants sont immédiats.
  await waitFor(() => expect(result.container.querySelector(".whitespace-pre-wrap")).toBeNull(), {
    timeout: 10_000,
  });
  return result;
}

describe("RichText", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("affiche le HTML brut comme du texte, sans créer d'élément", async () => {
    const { container } = await renderRichText(
      '<img src=x onerror="alert(1)"> et <script>alert(2)</script>',
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.textContent).toContain("<script>alert(2)</script>");
  });

  it("retire l'adresse d'un lien javascript:", async () => {
    await renderRichText("[clique](javascript:alert(1))");
    expect(screen.getByText("clique").closest("a")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("ouvre un lien externe sans transmettre l'origine ni le référent", async () => {
    await renderRichText("[doc](https://example.com)");
    const link = screen.getByRole("link", { name: /^doc/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("traite comme externe une adresse sans protocole vers un autre site", async () => {
    await renderRichText("[piège](//evil.example)");
    expect(screen.getByRole("link", { name: /^piège/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer nofollow",
    );
  });

  it("garde dans l'onglet un lien interne ou une ancre", async () => {
    await renderRichText("[profil](/u/awa-ndiaye) et [note](#user-content-fn-1)");
    expect(screen.getByRole("link", { name: "profil" })).not.toHaveAttribute("target");
    expect(screen.getByRole("link", { name: "note" })).not.toHaveAttribute("target");
  });

  it("remplace une image Markdown par un lien, sans la charger", async () => {
    const { container } = await renderRichText("![schéma](https://tracker.example/pixel.png)");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: /^Image externe : schéma/ })).toHaveAttribute(
      "href",
      "https://tracker.example/pixel.png",
    );
  });

  it("transforme une mention en lien vers le profil, mais pas une adresse email", async () => {
    await renderRichText("Merci @awa-ndiaye, écris à awa@example.com");
    expect(screen.getByRole("link", { name: "@awa-ndiaye" })).toHaveAttribute(
      "href",
      "/u/awa-ndiaye",
    );
    expect(screen.queryByRole("link", { name: "@example" })).toBeNull();
  });

  it("met en valeur @kemet sans en faire un lien de profil", async () => {
    await renderRichText("@kemet comment signer un webhook ?");
    expect(screen.getByText("@kemet").tagName).toBe("SPAN");
    expect(screen.queryByRole("link", { name: "@kemet" })).toBeNull();
  });

  it("ne transforme pas une mention écrite dans du code", async () => {
    await renderRichText("`@awa-ndiaye`");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("@awa-ndiaye").tagName).toBe("CODE");
  });

  it("affiche un bloc de code avec son langage, le copie et l'annonce", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await renderRichText("```ts\nconst total = 2;\n```");

    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Code ts" })).toHaveAttribute("tabindex", "0");

    const button = screen.getByRole("button", { name: "Copier le code ts" });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith("const total = 2;");
    expect(button).toHaveTextContent("Copié");
    expect(screen.getByText("Copié", { selector: "[aria-live]" })).toBeInTheDocument();
  });

  it("dit que la copie a échoué si le presse-papiers est refusé", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("refusé"))) },
    });
    await renderRichText("```ts\nconst total = 2;\n```");
    const button = screen.getByRole("button", { name: "Copier le code ts" });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveTextContent("Copie impossible");
  });

  it("revient à « Copier » après le retour visuel", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
    await renderRichText("```\nls\n```");
    const button = screen.getByRole("button", { name: "Copier le code texte" });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveTextContent("Copié");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(button).toHaveTextContent("Copier"));
  });

  it("rend les titres d'un contenu sous ceux de la page", async () => {
    await renderRichText("# Installation\n\n### Détails");
    expect(screen.getByRole("heading", { level: 3, name: "Installation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Détails" })).toBeInTheDocument();
  });

  it("annonce qu'un lien externe s'ouvre dans un nouvel onglet", async () => {
    await renderRichText("[doc](https://example.com)");
    expect(screen.getByRole("link", { name: "doc (nouvel onglet)" })).toBeInTheDocument();
  });

  it("colore un bloc de code dont le langage est connu, pour les deux thèmes", async () => {
    const { container } = await renderRichText("```ts\nconst total: number = 2;\n```");
    await waitFor(() => expect(container.querySelector(".shiki-token")).not.toBeNull(), {
      timeout: 10_000,
    });
    const keyword = [...container.querySelectorAll<HTMLElement>(".shiki-token")].find(
      (token) => token.textContent === "const",
    );
    expect(keyword?.style.getPropertyValue("--shiki-light")).not.toBe("");
    expect(keyword?.style.getPropertyValue("--shiki-dark")).not.toBe("");
    expect(container.querySelector("pre")?.textContent).toBe("const total: number = 2;");
  });

  it("laisse en texte brut un bloc de code trop long pour être coloré", async () => {
    const longCode = "x".repeat(20_001);
    const { container } = await renderRichText("```ts\n" + longCode + "\n```");
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(container.querySelector(".shiki-token")).toBeNull();
    expect(container.querySelector("pre")?.textContent).toBe(longCode);
  });

  it("laisse en texte brut un langage inconnu", async () => {
    const { container } = await renderRichText("```brainfuck\n+++\n```");
    expect(container.querySelector(".shiki-token")).toBeNull();
    expect(screen.getByText("brainfuck")).toBeInTheDocument();
  });

  it("garde les retours à la ligne d'un message", async () => {
    const { container } = await renderRichText("ligne une\nligne deux");
    expect(container.querySelector("br")).not.toBeNull();
  });
});
