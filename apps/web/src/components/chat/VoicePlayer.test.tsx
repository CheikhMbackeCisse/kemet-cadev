import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Attachment } from "@kemet/shared";
import { VoicePlayer } from "./VoicePlayer.js";

function voice(id: string, durationMs: number): Attachment {
  return {
    id,
    kind: "voice",
    mimeType: "audio/webm",
    originalName: "message-vocal.webm",
    byteSize: 4000,
    durationMs,
    createdAt: new Date().toISOString(),
    removed: false,
  };
}

describe("VoicePlayer", () => {
  it("affiche la durée sans rien télécharger ni jouer avant un appui", () => {
    const { container } = render(<VoicePlayer attachment={voice("a", 65_000)} />);
    const audio = container.querySelector("audio")!;
    expect(audio.getAttribute("preload")).toBe("none");
    expect(audio.autoplay).toBe(false);
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Écouter le message vocal, 1:05" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Position dans le message vocal" })).toHaveAttribute(
      "max",
      "65000",
    );
  });

  it("met en pause les autres messages vocaux quand un autre démarre", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    render(
      <>
        <VoicePlayer attachment={voice("a", 3000)} />
        <VoicePlayer attachment={voice("b", 4000)} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Écouter le message vocal, 0:04" }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    play.mockRestore();
    pause.mockRestore();
  });
});
