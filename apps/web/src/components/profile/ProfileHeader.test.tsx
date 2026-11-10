import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileHeader } from "./ProfileHeader.js";

const profile = {
  displayName: "Amina Diallo",
  handle: "amina",
  avatarUrl: null,
  bannerUrl: null,
  country: "SN" as const,
  bio: "Backend et paiements.",
  level: "apprenti" as const,
};

describe("ProfileHeader", () => {
  it("écrit le pays à côté de l'identifiant et montre les chiffres", () => {
    render(
      <ProfileHeader
        profile={profile}
        stats={[
          { label: "Points", value: 340 },
          { label: "Travaux", value: 2 },
          { label: "Abonnés", value: null },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Amina Diallo" })).toBeVisible();
    expect(screen.getByText("@amina")).toBeVisible();
    expect(screen.getByText("Sénégal")).toBeVisible();
    const stats = screen.getByRole("list", { name: "Chiffres du profil" });
    expect(stats).toHaveTextContent("340 Points");
    expect(stats).toHaveTextContent("2 Travaux");
  });

  it("rend un chiffre cliquable quand il ouvre une liste", () => {
    const onClick = vi.fn();
    render(<ProfileHeader profile={profile} stats={[{ label: "Abonnés", value: 12, onClick }]} />);
    fireEvent.click(screen.getByRole("button", { name: "12 Abonnés" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
