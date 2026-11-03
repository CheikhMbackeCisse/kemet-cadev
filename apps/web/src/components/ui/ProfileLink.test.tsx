import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { authorLevel, ProfileLink } from "./ProfileLink.js";

describe("ProfileLink", () => {
  it("relie un auteur à son profil", () => {
    render(<ProfileLink handle="amina-diallo">Amina</ProfileLink>);
    expect(screen.getByRole("link", { name: "Amina" })).toHaveAttribute("href", "/u/amina-diallo");
  });

  it("n'offre ni lien ni niveau pour un compte supprimé", () => {
    render(<ProfileLink handle="supprime-ab12cd34">Compte supprimé</ProfileLink>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Compte supprimé")).toBeInTheDocument();
    expect(authorLevel("supprime-ab12cd34", "architecte")).toBeUndefined();
    expect(authorLevel("amina-diallo", "architecte")).toBe("architecte");
  });
});
