import { describe, expect, it } from "vitest";
import { SERVER_NAVIGATION_DENYLIST } from "./navigation-denylist.js";

function isLeftToServer(pathname: string) {
  return SERVER_NAVIGATION_DENYLIST.some((pattern) => pattern.test(pathname));
}

describe("SERVER_NAVIGATION_DENYLIST", () => {
  it.each([
    "/api/auth/callback/google",
    "/api/auth/callback/github",
    "/api/auth/verify-email",
    "/api/auth/reset-password/abc",
    "/api/attachments/1/content",
    "/socket.io/",
    "/realtime/health",
  ])("laisse %s au serveur", (pathname) => {
    expect(isLeftToServer(pathname)).toBe(true);
  });

  it.each(["/", "/fil", "/connexion", "/salons/abc", "/apiculture"])(
    "garde %s dans l'application",
    (pathname) => {
      expect(isLeftToServer(pathname)).toBe(false);
    },
  );
});
