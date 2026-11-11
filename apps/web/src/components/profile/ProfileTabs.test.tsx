import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { Profile, ProfileLibrary } from "@kemet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileTabs } from "./ProfileTabs.js";

const getUserLibrary = vi.fn();

vi.mock("../../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/chat/api.js")>()),
  getUserLibrary: (handle: string) => getUserLibrary(handle),
  listUserWorks: () => Promise.resolve({ items: [], nextCursor: null }),
  listBookmarkedPosts: () => Promise.resolve({ items: [], nextCursor: null }),
}));

vi.mock("../../session/SessionProvider.js", () => ({
  useSession: () => ({ status: "ready", profile: null, isSuspended: false }),
}));

const PROFILE: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  handle: "nala-uwase",
  displayName: "Nala Uwase",
  country: "RW",
  role: "student",
  title: null,
  bio: null,
  stack: [],
  githubUrl: null,
  gitlabUrl: null,
  linkedinUrl: null,
  portfolioUrl: null,
  websiteUrl: "https://nala.demo.kemetlabs.dev",
  avatarUrl: null,
  bannerUrl: null,
  openToOpportunities: false,
  helpsBeginners: false,
  isDemo: true,
  level: "apprenti",
  createdAt: "2026-11-01T10:00:00.000Z",
};

const EMPTY_LIBRARY: ProfileLibrary = { cv: null, projects: [], skills: [] };

function renderTabs(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

describe("ProfileTabs", () => {
  beforeEach(() => {
    getUserLibrary.mockReset();
    getUserLibrary.mockResolvedValue(EMPTY_LIBRARY);
  });

  it("sur son propre profil, liste ce qui manque dans une seule carte", async () => {
    renderTabs(
      <ProfileTabs
        profile={PROFILE}
        workCount={0}
        credentials={[]}
        isOwnProfile
        includeSaved
        worksReloadKey={0}
      />,
    );
    const card = await screen.findByRole("region", { name: "Complète ton profil" });
    expect(card).toHaveTextContent("Ton CV");
    expect(card).toHaveTextContent("Un premier travail");
    // Un lien est déjà posé : la ligne des liens n'apparaît pas.
    expect(card).not.toHaveTextContent("Tes liens");
    expect(screen.getByRole("tab", { name: "Bibliothèque" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Enregistrés" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Travaux" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Skills" })).toBeNull();
  });

  it("sur le profil d'une autre personne, ne montre aucun onglet vide", async () => {
    renderTabs(
      <ProfileTabs
        profile={{ ...PROFILE, websiteUrl: null }}
        workCount={0}
        credentials={[]}
        isOwnProfile={false}
        worksReloadKey={0}
      />,
    );
    expect(await screen.findByText("Rien de publié pour l'instant.")).toBeVisible();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("region", { name: "Complète ton profil" })).toBeNull();
  });
});
