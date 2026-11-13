import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fr } from "../i18n/fr.js";
import { SecurityPage } from "./SecurityPage.js";

vi.mock("../components/layout/RailPage.js", () => ({
  RailPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("page Sécurité", () => {
  it("montre les trois notes mesurées, datées, chacune avec un lien pour relancer le test", () => {
    render(<SecurityPage />);
    const list = screen.getByRole("list", { name: fr.security.measuredTitle });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    fr.security.measured.forEach((test, index) => {
      const row = within(rows[index]!);
      expect(row.getByText(test.tool)).toBeInTheDocument();
      expect(row.getByText(test.grade)).toBeInTheDocument();
      expect(row.getByRole("link", { name: fr.security.rerun })).toHaveAttribute("href", test.href);
    });
    expect(screen.getByText(fr.security.measuredDate)).toBeInTheDocument();
    expect(screen.getByText(fr.security.measuredScope)).toBeInTheDocument();
  });

  it("montre les autres tests avec Pas encore mesuré, jamais une note inventée", () => {
    render(<SecurityPage />);
    const list = screen.getByRole("list", { name: fr.security.testsTitle });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(fr.security.tests.length);
    fr.security.tests.forEach((test, index) => {
      const row = within(rows[index]!);
      expect(row.getByText(test.tool)).toBeInTheDocument();
      expect(row.getByText(test.result ?? fr.security.notMeasured)).toBeInTheDocument();
      if (test.result) expect(test.date).not.toBeNull();
    });
  });

  it("donne pour chaque protection le fichier où la lire", () => {
    render(<SecurityPage />);
    const list = screen.getByRole("list", { name: fr.security.protectionsTitle });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(fr.security.protections.length);
    for (const protection of fr.security.protections) {
      expect(protection.file).toMatch(/^(apps|packages|infra|evals)\//);
      expect(within(list).getByText(protection.file, { selector: "code" })).toBeInTheDocument();
    }
  });

  it("ouvre les outils extérieurs dans un nouvel onglet, sans transmettre la page", () => {
    render(<SecurityPage />);
    for (const link of screen.getAllByRole("link", { name: fr.security.rerun })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("dit ce qui reste à faire, sans promesse que rien ne prouve", () => {
    render(<SecurityPage />);
    expect(screen.getByRole("heading", { name: fr.security.remainingTitle })).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    // "Certificat" (HTTPS) est permis ; "certifié" ne doit jamais apparaître.
    expect(text).not.toMatch(/certifi(?!cat)/i);
    expect(text).not.toMatch(/vérifié|100 % sûr|inviolable/i);
  });
});
