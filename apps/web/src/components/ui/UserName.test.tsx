import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserName } from "./UserName.js";

describe("UserName", () => {
  it("écrit Organisation à côté du nom d'une organisation, sans insigne de niveau", () => {
    render(<UserName name="Systalink" organization level="legende" />);
    expect(screen.getByText("Organisation")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Niveau/ })).not.toBeInTheDocument();
  });

  it("garde l'insigne d'une personne", () => {
    render(<UserName name="Awa Diop" level="scribe" />);
    expect(screen.getByRole("img", { name: "Niveau Scribe" })).toBeInTheDocument();
    expect(screen.queryByText("Organisation")).not.toBeInTheDocument();
  });

  it("n'affiche rien après le nom quand le niveau est absent (Kocc)", () => {
    const { container } = render(<UserName name="Kocc" level={null} />);
    expect(container.textContent).toBe("Kocc");
  });
});
