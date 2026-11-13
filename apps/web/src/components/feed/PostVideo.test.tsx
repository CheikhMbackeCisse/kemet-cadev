import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "@kemet/shared";
import { PostVideo } from "./PostVideo.js";

const attachment: Attachment = {
  id: "8f6f7a52-8e1f-4a8a-9a36-3d4c2f0e9b11",
  kind: "video",
  mimeType: "video/webm",
  originalName: "clip.webm",
  byteSize: 1000,
  durationMs: 12000,
  width: 720,
  height: 1280,
  createdAt: "2026-11-13T10:00:00.000Z",
  removed: false,
};

describe("vidéo d'un post", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  it("ouvre la vue plein écran à cette vidéo quand on la touche, sans bouton à part", () => {
    render(<PostVideo attachment={attachment} postId="post-1" authorName="Awa" />);
    expect(screen.getByRole("link", { name: "Vidéo de Awa, voir en plein écran" })).toHaveAttribute(
      "href",
      "/videos/post-1",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("se lit sur place quand elle n'appartient à aucun post", () => {
    render(<PostVideo attachment={attachment} authorName="Awa" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Lire : Vidéo de Awa" })).toBeInTheDocument();
  });

  it("reste un simple aperçu dans un post partagé", () => {
    render(<PostVideo attachment={attachment} playable={false} postId="post-1" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
