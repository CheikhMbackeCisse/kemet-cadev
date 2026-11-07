import { afterEach, describe, expect, it, vi } from "vitest";
import { followUser, updateOnboarding } from "./api.js";

describe("request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("n'annonce pas de JSON pour une requête sans corps", async () => {
    const fetchMock = stubFetch();
    await followUser("awa");
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("annonce du JSON quand la requête porte un corps", async () => {
    const fetchMock = stubFetch();
    await updateOnboarding({ step: "role" });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });
});
