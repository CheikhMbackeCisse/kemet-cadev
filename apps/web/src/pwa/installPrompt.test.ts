import { beforeEach, describe, expect, it } from "vitest";
import {
  countVisit,
  dismissInstallOffer,
  shouldOfferInstall,
  VISITS_BEFORE_INSTALL_OFFER,
} from "./installPrompt.js";

describe("installPrompt", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("counts one visit per tab, not per page", () => {
    expect(countVisit(window.localStorage, window.sessionStorage)).toBe(1);
    expect(countVisit(window.localStorage, window.sessionStorage)).toBe(1);
    window.sessionStorage.clear();
    expect(countVisit(window.localStorage, window.sessionStorage)).toBe(2);
  });

  it("waits for enough visits before offering installation", () => {
    expect(shouldOfferInstall(window.localStorage, VISITS_BEFORE_INSTALL_OFFER - 1)).toBe(false);
    expect(shouldOfferInstall(window.localStorage, VISITS_BEFORE_INSTALL_OFFER)).toBe(true);
  });

  it("never offers installation again once dismissed", () => {
    dismissInstallOffer(window.localStorage);
    expect(shouldOfferInstall(window.localStorage, VISITS_BEFORE_INSTALL_OFFER + 5)).toBe(false);
  });
});
