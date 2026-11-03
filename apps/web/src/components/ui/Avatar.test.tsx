import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar.js";

describe("Avatar", () => {
  it("montre les initiales d'une personne", () => {
    render(<Avatar name="Amina Diallo" />);
    expect(screen.getByRole("img", { name: "Amina Diallo" })).toHaveTextContent("AD");
  });

  it("montre une icône neutre, sans initiales ni drapeau, pour un compte supprimé", () => {
    render(<Avatar name="Compte supprimé" countryCode="SN" deleted />);
    const avatar = screen.getByRole("img", { name: "Compte supprimé" });
    expect(avatar).toHaveTextContent("");
    expect(avatar.querySelector("svg")).not.toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});
