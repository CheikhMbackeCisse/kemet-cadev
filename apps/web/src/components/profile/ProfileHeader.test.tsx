import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileHeader } from "./ProfileHeader.js";

const BASE = {
  handle: "awa-ndiaye",
  avatarUrl: null,
  bannerUrl: null,
  country: "SN",
  bio: null,
  level: null,
} as const;

describe("ProfileHeader", () => {
  it("montre le nom puis l'identifiant", () => {
    render(<ProfileHeader profile={{ ...BASE, displayName: "Awa Ndiaye" }} stats={[]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Awa Ndiaye");
    expect(screen.getByText("@awa-ndiaye")).toBeInTheDocument();
  });

  it("n'écrit l'identifiant qu'une fois quand le nom le recopie, et propose d'ajouter un nom chez soi", () => {
    render(
      <ProfileHeader
        profile={{ ...BASE, displayName: "awa-ndiaye" }}
        stats={[]}
        addNameHref="/parametres/profil"
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("@awa-ndiaye");
    expect(screen.getAllByText(/awa-ndiaye/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Ajouter ton nom" })).toHaveAttribute(
      "href",
      "/parametres/profil",
    );
  });

  it("ne propose rien sur le profil de quelqu'un d'autre", () => {
    render(<ProfileHeader profile={{ ...BASE, displayName: "" }} stats={[]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("@awa-ndiaye");
    expect(screen.queryByRole("link", { name: "Ajouter ton nom" })).not.toBeInTheDocument();
  });
});
