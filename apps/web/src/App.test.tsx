import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it("répond Page introuvable à une adresse inconnue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    window.history.pushState({}, "", "/nulle-part");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Page introuvable" }, { timeout: 10000 }),
    ).toBeInTheDocument();
  });

  it.each(["/statut", "/dev/ui", "/dev/ui/shell"])(
    "cache %s hors développement",
    async (pathname) => {
      vi.stubEnv("DEV", false);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 401 })),
      );
      window.history.pushState({}, "", pathname);
      render(<App />);
      expect(
        await screen.findByRole("heading", { name: "Page introuvable" }, { timeout: 10000 }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Kemet arrive.")).not.toBeInTheDocument();
    },
  );

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

  it("ouvre la politique de confidentialité à un visiteur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    window.history.pushState({}, "", "/confidentialite");
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Confidentialité" }, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Google peut se servir de ces données/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contact" })).not.toBeInTheDocument();
  });

  it("montre le contact de confidentialité quand le serveur le fournit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input) === "/api/privacy-contact"
          ? Response.json({ contact: { name: "Responsable", email: "contact@example.org" } })
          : new Response(null, { status: 401 }),
      ),
    );
    window.history.pushState({}, "", "/confidentialite");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Contact" }, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "contact@example.org" })).toHaveAttribute(
      "href",
      "mailto:contact@example.org",
    );
  });
});
