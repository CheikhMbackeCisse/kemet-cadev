import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, generatedAvatarColor } from "./Avatar.js";

describe("Avatar", () => {
  it("montre les initiales d'une personne, sans les faire lire une seconde fois", () => {
    const { container } = render(<Avatar name="Amina Diallo" />);
    expect(container.firstElementChild).toHaveTextContent("AD");
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("montre une icône neutre, sans initiales ni drapeau, pour un compte supprimé", () => {
    render(<Avatar name="Compte supprimé" countryCode="SN" deleted />);
    const avatar = screen.getByRole("img", { name: "Compte supprimé" });
    expect(avatar).toHaveTextContent("");
    expect(avatar.querySelector("svg")).not.toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("donne toujours la même couleur au même nom", () => {
    expect(generatedAvatarColor("Amina Diallo")).toBe(generatedAvatarColor("Amina Diallo"));
    expect(generatedAvatarColor("Amina Diallo")).toMatch(/^var\(--space-tint-/);
  });

  it("n'ajoute pas de drapeau à 88 px, où le pays est écrit à côté", () => {
    const { container } = render(<Avatar name="Amina Diallo" size={88} countryCode="SN" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
