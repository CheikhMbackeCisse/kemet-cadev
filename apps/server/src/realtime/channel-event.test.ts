import { describe, expect, it, vi } from "vitest";
import { acknowledge, readChannelId } from "./channel-event.js";

describe("événements de salon", () => {
  it("lit un identifiant de salon valide", () => {
    const channelId = "3f1c2a8e-6b7d-4c1e-9a2b-1d2e3f4a5b6c";
    expect(readChannelId({ channelId })).toBe(channelId);
  });

  it("refuse une charge nulle, absente ou un identifiant qui n'est pas un UUID", () => {
    expect(readChannelId(null)).toBeNull();
    expect(readChannelId(undefined)).toBeNull();
    expect(readChannelId("salon")).toBeNull();
    expect(readChannelId({ channelId: "pas-un-uuid" })).toBeNull();
    expect(readChannelId({ channelId: 42 })).toBeNull();
  });

  it("n'appelle l'accusé de réception que s'il s'agit d'une fonction", () => {
    const ack = vi.fn();
    acknowledge(ack, true);
    expect(ack).toHaveBeenCalledWith(true);
    expect(() => acknowledge("pas une fonction", false)).not.toThrow();
  });
});
