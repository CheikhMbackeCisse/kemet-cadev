import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Attachment } from "@kemet/shared";
import { PostImages } from "./PostImages.js";

function image(position: number): Attachment {
  return {
    id: `8f6f7a52-8e1f-4a8a-9a36-3d4c2f0e9b1${position}`,
    kind: "image",
    mimeType: "image/png",
    originalName: `visuel-${position}.png`,
    byteSize: 1000,
    durationMs: null,
    width: 1080,
    height: 1350,
    createdAt: "2026-11-13T10:00:00.000Z",
    removed: false,
  };
}

describe("images d'un post", () => {
  it("ouvre la visionneuse sur l'image touchée sans changer d'adresse ni ouvrir le fichier", async () => {
    window.history.replaceState(null, "", "/fil/post-1");
    render(<PostImages attachments={[image(1), image(2), image(3)]} postId="post-1" />);
    expect(document.querySelector('a[href*="/api/post-attachments/"]')).toBeNull();

    const trigger = screen.getByRole("button", { name: "Afficher l'image visuel-2.png en grand" });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    expect(window.location.pathname).toBe("/fil/post-1");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fermer l'image" })).toHaveFocus();
    expect(dialog.querySelector('img[alt="visuel-2.png"]')).not.toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe("/fil/post-1");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("se ferme par le retour du navigateur", async () => {
    render(<PostImages attachments={[image(1)]} postId="post-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Afficher l'image visuel-1.png en grand" }));
    await screen.findByRole("dialog");
    expect(screen.queryByText(/\/ 1/)).toBeNull();
    window.history.back();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("garde l'aperçu sans visionneuse dans un post partagé", () => {
    render(<PostImages attachments={[image(1), image(2)]} linked={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
