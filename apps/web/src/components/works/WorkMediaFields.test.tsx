import { describe, expect, it } from "vitest";
import type { WorkDetail } from "@kemet/shared";
import { initialMediaDraft, mediaDraftToInput } from "./WorkMediaFields.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("médias du formulaire d'un travail", () => {
  it("reprend les médias d'un travail et les renvoie dans le même ordre", () => {
    const work = {
      coverMediaId: id(1),
      gallery: [{ id: id(2), originalName: "ecran.png" }],
      videos: [
        { kind: "file", id: id(3), mimeType: "video/mp4", originalName: "demo.mp4" },
        { kind: "youtube", id: id(4), youtubeId: "dQw4w9WgXcQ" },
      ],
    } as unknown as WorkDetail;
    const draft = initialMediaDraft(work);
    expect(draft.cover?.previewUrl).toBe(`/api/work-media/${id(1)}/content`);
    expect(mediaDraftToInput(draft)).toEqual({
      media: [
        { id: id(1), role: "cover" },
        { id: id(2), role: "gallery" },
        { id: id(3), role: "video" },
      ],
      youtubeUrls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    });
  });

  it("part vide pour un nouveau travail", () => {
    expect(mediaDraftToInput(initialMediaDraft(null))).toEqual({ media: [], youtubeUrls: [] });
  });
});
