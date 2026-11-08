import { describe, expect, it } from "vitest";
import { loadSiteConfig } from "./site-config.js";

describe("loadSiteConfig", () => {
  it("n'affiche la mention de démonstration que si la variable vaut true", () => {
    expect(loadSiteConfig({}).demoContentNotice).toBe(false);
    expect(loadSiteConfig({ DEMO_CONTENT_NOTICE: "false" }).demoContentNotice).toBe(false);
    expect(loadSiteConfig({ DEMO_CONTENT_NOTICE: "1" }).demoContentNotice).toBe(false);
    expect(loadSiteConfig({ DEMO_CONTENT_NOTICE: " TRUE " }).demoContentNotice).toBe(true);
  });
});
