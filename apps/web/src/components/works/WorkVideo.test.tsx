import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkVideo } from "./WorkVideo.js";

describe("WorkVideo", () => {
  it("ne charge YouTube qu'au clic, depuis youtube-nocookie", () => {
    const { container } = render(
      <WorkVideo video={{ kind: "youtube", id: "x", youtubeId: "dQw4w9WgXcQ" }} title="Démo" />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /sur YouTube/ }));
    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
    );
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  });

  it("lit un fichier avec le lecteur du navigateur", () => {
    const { container } = render(
      <WorkVideo
        video={{
          kind: "file",
          id: "00000000-0000-4000-8000-000000000001",
          mimeType: "video/webm",
          originalName: "d.webm",
        }}
        title="Démo"
      />,
    );
    const source = container.querySelector("video source")!;
    expect(source.getAttribute("src")).toBe(
      "/api/work-media/00000000-0000-4000-8000-000000000001/content",
    );
    expect(source.getAttribute("type")).toBe("video/webm");
  });
});
