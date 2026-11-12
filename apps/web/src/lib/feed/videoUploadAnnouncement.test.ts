import { describe, expect, it } from "vitest";
import { fr } from "../../i18n/fr.js";
import {
  videoUploadAnnouncement,
  videoUploadLabel,
  type VideoUploadState,
} from "./videoUploadAnnouncement.js";

describe("videoUploadAnnouncement", () => {
  it("n'annonce que le début, 50 % et la fin d'un envoi", () => {
    const steps: VideoUploadState[] = [
      { phase: "preparing" },
      ...Array.from({ length: 101 }, (_, percent) => ({ phase: "uploading" as const, percent })),
      { phase: "done" },
    ];
    const announced = steps
      .map(videoUploadAnnouncement)
      .filter((text, index, all) => text !== all[index - 1]);
    expect(announced).toEqual([
      fr.feed.videoPreparing,
      fr.feed.videoUploading(50),
      fr.feed.videoUploaded,
    ]);
  });

  it("se tait hors d'un envoi", () => {
    expect(videoUploadAnnouncement({ phase: "idle" })).toBe("");
  });
});

describe("videoUploadLabel", () => {
  it("affiche chaque pourcent, et rien une fois l'envoi fini", () => {
    expect(videoUploadLabel({ phase: "uploading", percent: 42 })).toBe(fr.feed.videoUploading(42));
    expect(videoUploadLabel({ phase: "done" })).toBeNull();
    expect(videoUploadLabel({ phase: "idle" })).toBeNull();
  });
});
