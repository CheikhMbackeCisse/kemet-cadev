import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LevelBadge } from "./LevelBadge.js";

describe("LevelBadge", () => {
  it("annonce le niveau aux lecteurs d'écran", () => {
    render(<LevelBadge level="scribe" />);
    expect(screen.getByText(/Scribe/).textContent).toBe("Niveau Scribe");
  });

  it("garde la même teinte pour tous les niveaux sauf Légende", () => {
    const { rerender } = render(<LevelBadge level="apprenti" />);
    const badge = screen.getByText(/Apprenti/);
    expect(badge).toHaveClass("bg-accent-soft-2", "text-level-badge-text");
    expect(badge).not.toHaveClass("border");

    rerender(<LevelBadge level="legende" />);
    expect(screen.getByText(/Légende/)).toHaveClass("bg-primary", "text-white");
  });
});
