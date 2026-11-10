import { act, render, screen } from "@testing-library/react";
import { lazy, useEffect, type ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { navigate, ROUTER_STATE_KEY } from "../../lib/navigation/navigate.js";
import { Router } from "./Router.js";

function deferredPage() {
  let resolve: (page: { default: ComponentType }) => void = () => undefined;
  const promise = new Promise<{ default: ComponentType }>((done) => {
    resolve = done;
  });
  return { Page: lazy(() => promise), resolve };
}

function goBackTo(path: string) {
  window.history.replaceState({ [ROUTER_STATE_KEY]: true }, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state: { [ROUTER_STATE_KEY]: true } }));
}

describe("Router", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("annule une page encore en chargement quand on revient en arrière", async () => {
    window.history.replaceState(null, "", "/fil");
    const mountedAt = vi.fn();
    function Post() {
      useEffect(() => mountedAt(window.location.pathname), []);
      return <h1>Post</h1>;
    }
    const post = deferredPage();
    render(
      <Router
        fallback={<p>Chargement</p>}
        render={(pathname) => (pathname === "/fil" ? <h1>Fil</h1> : <post.Page />)}
      />,
    );

    // Retour avant que React ait rendu la page demandée.
    act(() => {
      navigate("/fil/abc");
      goBackTo("/fil");
    });
    await act(async () => post.resolve({ default: Post }));

    expect(mountedAt).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Fil" })).toBeTruthy();
  });
});
