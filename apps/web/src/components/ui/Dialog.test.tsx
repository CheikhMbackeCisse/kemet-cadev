import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog } from "./Dialog.js";
import { Sheet } from "./Sheet.js";

describe("focus à l'ouverture", () => {
  it("place le focus sur le dialogue, pas sur son bouton de fermeture", async () => {
    render(
      <Dialog open onOpenChange={() => {}} title="Titre">
        <button type="button">Action</button>
      </Dialog>,
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveFocus();
    expect(screen.getByRole("button", { name: "Fermer" })).not.toHaveFocus();
  });

  it("laisse le focus au champ marqué autoFocus", async () => {
    render(
      <Dialog open onOpenChange={() => {}} title="Titre">
        <textarea aria-label="Réponse" autoFocus />
      </Dialog>,
    );
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Réponse")).toHaveFocus();
  });

  it("place le focus sur la feuille, pas sur son bouton de fermeture", async () => {
    render(
      <Sheet open onOpenChange={() => {}} side="bottom" title="Titre">
        <button type="button">Action</button>
      </Sheet>,
    );
    expect(await screen.findByRole("dialog")).toHaveFocus();
  });
});
