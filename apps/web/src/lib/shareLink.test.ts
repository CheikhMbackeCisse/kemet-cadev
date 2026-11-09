import { afterEach, describe, expect, it, vi } from "vitest";
import { shareLink } from "./shareLink.js";

function stubNavigator(value: Partial<Navigator>) {
  vi.stubGlobal("navigator", value);
}

describe("shareLink", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ouvre la feuille de partage quand elle existe", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });
    expect(await shareLink("https://kemetlabs.dev/fil/1", "Post")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ url: "https://kemetlabs.dev/fil/1", title: "Post" });
  });

  it("ne signale rien quand la feuille est fermée sans choix", async () => {
    stubNavigator({ share: vi.fn().mockRejectedValue(new DOMException("annulé", "AbortError")) });
    expect(await shareLink("https://kemetlabs.dev/fil/1", "Post")).toBe("cancelled");
  });

  it("copie le lien sans feuille de partage, ou quand elle échoue", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
    expect(await shareLink("https://kemetlabs.dev/fil/1", "Post")).toBe("copied");
    stubNavigator({
      share: vi.fn().mockRejectedValue(new DOMException("refusé", "NotAllowedError")),
      clipboard: { writeText } as unknown as Clipboard,
    });
    expect(await shareLink("https://kemetlabs.dev/fil/1", "Post")).toBe("copied");
  });

  it("échoue quand ni le partage ni le presse-papiers ne marchent", async () => {
    stubNavigator({
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("non")) } as unknown as Clipboard,
    });
    expect(await shareLink("https://kemetlabs.dev/fil/1", "Post")).toBe("failed");
  });
});
