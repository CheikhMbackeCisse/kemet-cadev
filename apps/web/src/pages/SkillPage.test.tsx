import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { SkillDetail } from "@kemet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillPage } from "./SkillPage.js";

const AMINA_ID = "00000000-0000-4000-8000-000000000001";
const FATIMA_ID = "00000000-0000-4000-8000-000000000002";

const getSkill = vi.fn();

vi.mock("../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/chat/api.js")>()),
  getSkill: (slug: string) => getSkill(slug),
}));

vi.mock("../session/SessionProvider.js", () => ({
  useSession: () => ({
    status: "ready",
    isSuspended: false,
    profile: { id: AMINA_ID, handle: "amina-diallo", displayName: "Amina Diallo" },
  }),
}));

vi.mock("../components/layout/RailPage.js", () => ({
  RailPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/content/RichText.js", () => ({
  RichText: ({ source }: { source: string }) => <div>{source}</div>,
}));

function skillBy(authorId: string): SkillDetail {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    slug: "ci-docker-fiable",
    name: "ci-docker-fiable",
    description: "Rendre une CI stable.",
    tags: [],
    visibility: "public",
    authorId,
    authorHandle: "fatima-benali",
    authorDisplayName: "Fatima Benali",
    authorAvatarUrl: null,
    codeExcerpt: { language: null, lines: [] },
    averageStars: null,
    ratingCount: 0,
    usageCount: 0,
    isBeginner: false,
    createdAt: new Date(0).toISOString(),
    content: "Contenu",
    spaceId: null,
  };
}

describe("SkillPage", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/skills/ci-docker-fiable");
    getSkill.mockReset();
  });

  it("ne propose pas la suppression du skill d'un autre compte", async () => {
    getSkill.mockResolvedValue({ skill: skillBy(FATIMA_ID) });
    render(<SkillPage />);

    await screen.findByRole("heading", { name: "ci-docker-fiable" });
    expect(screen.queryByRole("button", { name: "Actions sur ce skill" })).toBeNull();
    expect(screen.queryByText("Supprimer")).toBeNull();
  });

  it("propose la suppression à l'auteur, dans le menu des actions", async () => {
    getSkill.mockResolvedValue({ skill: skillBy(AMINA_ID) });
    render(<SkillPage />);

    expect(await screen.findByRole("button", { name: "Actions sur ce skill" })).toBeInTheDocument();
  });
});
