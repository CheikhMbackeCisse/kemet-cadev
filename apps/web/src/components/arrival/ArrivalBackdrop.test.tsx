import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArrivalBackdrop } from "./ArrivalBackdrop.js";

const session = vi.hoisted(() => ({ status: "visitor" }));
vi.mock("../../session/SessionProvider.js", () => ({ useSession: () => session }));
const firstPaint = vi.hoisted(() => ({ done: true }));
vi.mock("../../lib/useAfterFirstPaint.js", () => ({ useAfterFirstPaint: () => firstPaint.done }));

describe("ArrivalBackdrop", () => {
  afterEach(() => {
    firstPaint.done = true;
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

  it("porte le réseau sur l'accueil et les écrans de compte seulement", () => {
    const { container, rerender } = render(<ArrivalBackdrop pathname="/decouvrir" />);
    expect(container.querySelector(".africa-watermark-network")).not.toBeNull();
    rerender(<ArrivalBackdrop pathname="/connexion" />);
    expect(container.querySelector(".africa-watermark-network")).not.toBeNull();
    rerender(<ArrivalBackdrop pathname="/bienvenue/pays" />);
    expect(container.querySelector(".africa-watermark-network")).toBeNull();
  });

  it("se retire en quittant le parcours", () => {
    const { container, rerender } = render(<ArrivalBackdrop pathname="/bienvenue/pays" />);
    rerender(<ArrivalBackdrop pathname="/fil" />);
    expect(container.querySelector(".arrival-background")).toBeNull();
    expect(document.documentElement.hasAttribute("data-arrival")).toBe(false);
  });

  it("attend le premier affichage pour poser le continent, la couleur du fond tout de suite", () => {
    firstPaint.done = false;
    const { container } = render(<ArrivalBackdrop pathname="/decouvrir" />);
    expect(container.querySelector(".arrival-background")).toBeNull();
    expect(document.documentElement.hasAttribute("data-arrival")).toBe(true);
  });

  it("retire l'accueil statique sur toute autre page", () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="static-welcome"></div>');
    const { rerender } = render(<ArrivalBackdrop pathname="/decouvrir" />);
    expect(document.getElementById("static-welcome")).not.toBeNull();
    rerender(<ArrivalBackdrop pathname="/connexion" />);
    expect(document.getElementById("static-welcome")).toBeNull();
  });

  it("laisse la racine au fil pour un compte connecté", () => {
    session.status = "ready";
    const { container } = render(<ArrivalBackdrop pathname="/" />);
    expect(container.querySelector(".arrival-background")).toBeNull();
    expect(document.documentElement.hasAttribute("data-arrival")).toBe(false);
  });
});
