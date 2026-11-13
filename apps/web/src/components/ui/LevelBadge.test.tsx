import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LevelBadge } from "./LevelBadge.js";

describe("LevelBadge", () => {
  it("montre une icône nommée pour les lecteurs d'écran et au survol", () => {
    render(<LevelBadge level="scribe" />);
    const badge = screen.getByRole("img", { name: "Niveau Scribe" });
    expect(badge).toHaveAttribute("title", "Scribe");
    expect(badge).toHaveClass("text-level-scribe");
    expect(badge.textContent).toBe("");
  });

  it("donne à chaque niveau sa couleur", () => {
    const { rerender } = render(<LevelBadge level="apprenti" />);
    expect(screen.getByRole("img", { name: "Niveau Apprenti" })).toHaveClass("text-level-apprenti");
    rerender(<LevelBadge level="legende" />);
    expect(screen.getByRole("img", { name: "Niveau Légende" })).toHaveClass("text-level-legende");
  });

  it("écrit le nom du niveau quand on le demande", () => {
    render(<LevelBadge level="architecte" showLabel />);
    expect(screen.getByText(/Architecte/).textContent).toBe("Niveau Architecte");
  });
});
