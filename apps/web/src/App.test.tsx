import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("affiche le message d'accueil et l'état des services sur /statut", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    window.history.pushState({}, "", "/statut");
    render(<App />);
    expect(screen.getByText("Kemet arrive.")).toBeInTheDocument();
    expect(await screen.findAllByText("en ligne")).toHaveLength(2);
  });

  it("affiche l'indisponibilité quand une vérification échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    window.history.pushState({}, "", "/statut");
    render(<App />);
    expect(await screen.findAllByText("indisponible")).toHaveLength(2);
  });

  it("ouvre le fil sur /, y compris pour un visiteur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    window.history.pushState({}, "", "/");
    render(<App />);
    // Les pages sont chargees a la demande (React.lazy) : le delai par defaut
    // d'1 s de findBy ne suffit pas a transformer le module dans Vitest.
    expect(
      await screen.findByRole("heading", { name: "Fil" }, { timeout: 10000 }),
    ).toBeInTheDocument();
  });

  it("garde la page de connexion sur /connexion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    window.history.pushState({}, "", "/connexion");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Connexion" }, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Créer un compte")).toBeInTheDocument();
  });
});
