import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "../App.js";

const uuid = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-30T10:00:00Z").toISOString();

const project = {
  id: uuid,
  slug: "kemet-cli",
  name: "Kemet CLI",
  pitch: "Un outil en ligne de commande pour parcourir Kemet.",
  stack: ["TypeScript"],
  ownerId: uuid,
  ownerHandle: "amina-diallo",
  ownerDisplayName: "Amina Diallo",
  ownerAvatarUrl: null,
  ownerCountry: "SN",
  openHelpRequestCount: 1,
  createdAt: now,
  description: "Lancer l'outil :\n\n```bash\nnpx kemet-cli login\n```\n\n**Bêta** ouverte.",
  repoUrl: "https://example.com/kemet-cli",
  demoUrl: null,
  datacloudDeployUrl: null,
  updatedAt: now,
};

const helpRequest = {
  id: uuid,
  projectId: uuid,
  authorId: uuid,
  kind: "help",
  title: "Relire la connexion",
  description: "Le jeton expire trop tôt dans `auth.ts`.",
  stack: [],
  status: "open",
  applicationCount: 0,
  createdAt: now,
  closedAt: null,
};

function respond(url: string): Response {
  if (url.endsWith("/api/projects/kemet-cli")) return Response.json({ project });
  if (url.endsWith("/api/projects/kemet-cli/help-requests")) {
    return Response.json({ items: [helpRequest] });
  }
  return new Response(null, { status: 401 });
}

describe("ProjectPage", () => {
  // La page et le moteur Markdown sont chargés à la demande, transformés à froid
  // par Vitest (environ 2 s chacun) : les charger ici sort ce temps du test.
  beforeAll(async () => {
    await import("./ProjectPage.js");
    await import("../components/content/MarkdownContent.js");
  }, 30_000);

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  // Premier rendu de toute l'app : jusqu'à 3 s quand la suite complète occupe
  // tous les cœurs, d'où un délai propre à ce test.
  it(
    "rend la description du projet et des demandes d'aide en Markdown",
    { timeout: 10_000 },
    async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => respond(String(input))),
      );
      window.history.pushState({}, "", "/projets/kemet-cli");
      render(<App />);

      expect(await screen.findByText("Bêta", {}, { timeout: 8_000 })).toHaveProperty(
        "tagName",
        "STRONG",
      );
      expect(await screen.findByText("auth.ts")).toHaveProperty("tagName", "CODE");
      expect(screen.queryByText(/```/)).not.toBeInTheDocument();
    },
  );
});
