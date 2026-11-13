import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fr } from "../i18n/fr.js";
import { NewSkillPage } from "./NewSkillPage.js";

vi.mock("../session/SessionProvider.js", () => ({
  useSession: () => ({ status: "ready", isSuspended: false }),
}));

vi.mock("../components/layout/FormPage.js", () => ({
  FormPage: ({ children }: { children: ReactNode }) => <form>{children}</form>,
}));

vi.mock("../components/content/RichText.js", () => ({
  RichText: ({ source }: { source: string }) => <div>{source}</div>,
}));

// jsdom n'a ni File.arrayBuffer ni File.text : la lecture du fichier est
// testée à part (skillFile.test.ts), ici on garde l'analyse de son texte.
vi.mock("../lib/skills/skillFile.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/skills/skillFile.js")>();
  const readText = (file: File) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(file);
    });
  return {
    ...actual,
    readSkillFile: async (file: File) => actual.parseSkillMarkdown(await readText(file)),
  };
});

// Le Select de Radix mesure son déclencheur.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const SKILL_FILE = `---
name: Revue de code
description: Relire une pull request comme une équipe senior.
---
Lire le diff en entier avant de commenter.`;

describe("NewSkillPage", () => {
  it("importe un fichier puis rend ce qu'on avait écrit quand on annule l'import", async () => {
    const { container } = render(<NewSkillPage />);
    const name = screen.getByLabelText("Nom");
    fireEvent.change(name, { target: { value: "Mon brouillon" } });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([SKILL_FILE], "SKILL.md", { type: "text/markdown" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Importé depuis SKILL.md")).toBeInTheDocument();
    expect(name).toHaveValue("Revue de code");
    expect(screen.getByRole("tab", { name: "Aperçu" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tablist")).toHaveAccessibleName(fr.skills.contentLabel);

    fireEvent.click(screen.getByRole("button", { name: "Annuler l'import" }));
    expect(name).toHaveValue("Mon brouillon");
    expect(screen.queryByText("Importé depuis SKILL.md")).not.toBeInTheDocument();
  });
});
