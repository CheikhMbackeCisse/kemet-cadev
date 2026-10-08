import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche le message d'accueil et l'état des services", async () => {
    render(<App />);
    expect(screen.getByText("Kemet arrive.")).toBeInTheDocument();
    expect(await screen.findAllByText("en ligne")).toHaveLength(2);
  });

  it("affiche l'indisponibilité quand une vérification échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    render(<App />);
    expect(await screen.findAllByText("indisponible")).toHaveLength(2);
  });
});
