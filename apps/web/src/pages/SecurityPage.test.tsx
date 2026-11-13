import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fr } from "../i18n/fr.js";
import { SecurityPage } from "./SecurityPage.js";

vi.mock("../components/layout/RailPage.js", () => ({
  RailPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("page Sécurité", () => {
  it("montre chaque test, avec sa note ou Pas encore mesuré, jamais une note inventée", () => {
    render(<SecurityPage />);
    const list = screen.getByRole("heading", { name: fr.security.testsTitle }).nextElementSibling;
    const rows = within(list as HTMLElement).getAllByRole("listitem");
    expect(rows).toHaveLength(fr.security.tests.length);
    fr.security.tests.forEach((test, index) => {
      const row = within(rows[index]!);
      expect(row.getByText(test.tool)).toBeInTheDocument();
      expect(row.getByText(test.result ?? fr.security.notMeasured)).toBeInTheDocument();
      if (test.result) expect(test.date).not.toBeNull();
    });
  });

  it("ouvre les outils extérieurs dans un nouvel onglet, sans transmettre la page", () => {
    render(<SecurityPage />);
    for (const link of screen.getAllByRole("link", { name: fr.security.rerun })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("dit ce qui reste à faire, à côté des protections en place", () => {
    render(<SecurityPage />);
    expect(screen.getByRole("heading", { name: fr.security.protectionsTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: fr.security.remainingTitle })).toBeInTheDocument();
    expect(fr.security.protections).toHaveLength(5);
    // "Certificat" (HTTPS) est permis ; "certifié" ne doit jamais apparaître.
    expect(document.body.textContent).not.toMatch(/certifi(?!cat)/i);
  });
});
