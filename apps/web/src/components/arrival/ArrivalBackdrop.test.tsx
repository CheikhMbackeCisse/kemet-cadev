import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArrivalBackdrop } from "./ArrivalBackdrop.js";

const session = vi.hoisted(() => ({ status: "visitor" }));
vi.mock("../../session/SessionProvider.js", () => ({ useSession: () => session }));

describe("ArrivalBackdrop", () => {
  afterEach(() => {
    session.status = "visitor";
    localStorage.clear();
  });

  it("garde le même fond d'un écran du parcours à l'autre", () => {
    const { container, rerender } = render(<ArrivalBackdrop pathname="/decouvrir/role" />);
    const background = container.querySelector(".arrival-background");
    expect(background).not.toBeNull();
    expect(document.documentElement.hasAttribute("data-arrival")).toBe(true);

    rerender(<ArrivalBackdrop pathname="/inscription" />);
    expect(container.querySelector(".arrival-background")).toBe(background);
  });

  it("porte le réseau sur l'accueil seulement", () => {
    const { container, rerender } = render(<ArrivalBackdrop pathname="/decouvrir" />);
    expect(container.querySelector(".africa-watermark-network")).not.toBeNull();
    rerender(<ArrivalBackdrop pathname="/connexion" />);
    expect(container.querySelector(".africa-watermark-network")).toBeNull();
  });

  it("se retire en quittant le parcours", () => {
    const { container, rerender } = render(<ArrivalBackdrop pathname="/bienvenue/pays" />);
    rerender(<ArrivalBackdrop pathname="/fil" />);
    expect(container.querySelector(".arrival-background")).toBeNull();
    expect(document.documentElement.hasAttribute("data-arrival")).toBe(false);
  });

  it("laisse la racine au fil pour un compte connecté", () => {
    session.status = "ready";
    const { container } = render(<ArrivalBackdrop pathname="/" />);
    expect(container.querySelector(".arrival-background")).toBeNull();
    expect(document.documentElement.hasAttribute("data-arrival")).toBe(false);
  });
});
