import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantMessage } from "./AssistantMessage.js";

const skill = {
  skillName: "wave-paiements",
  skillHref: "/skills/wave-paiements",
  authorName: "Awa Ndiaye",
  authorHref: "/u/awa-ndiaye",
};

function setContentHeight(height: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(height);
}

describe("AssistantMessage, réponse longue", () => {
  beforeEach(() => vi.stubGlobal("ResizeObserver", undefined));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("replie une réponse de plus de huit lignes, la citation restant visible", () => {
    setContentHeight(600);
    render(<AssistantMessage content={<p>Longue réponse</p>} skill={skill} hideFeedback />);

    const toggle = screen.getByRole("button", { name: "Voir plus" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "wave-paiements" })).toBeVisible();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Voir moins" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("montre dépliée la réponse d'un post épinglé, qui peut encore se replier", () => {
    setContentHeight(600);
    render(<AssistantMessage content={<p>Longue réponse</p>} hideFeedback defaultExpanded />);

    const toggle = screen.getByRole("button", { name: "Voir moins" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Voir plus" })).toBeInTheDocument();
  });

  it("se déplie au toucher de la réponse, mais pas d'un lien qu'elle contient", () => {
    setContentHeight(600);
    render(
      <AssistantMessage
        content={
          <p>
            Texte <a href="/doc">documentation</a>
          </p>
        }
        hideFeedback
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "documentation" }));
    expect(screen.getByRole("button", { name: "Voir plus" })).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Texte/));
    expect(screen.getByRole("button", { name: "Voir moins" })).toBeInTheDocument();
  });

  it("laisse entière une réponse courte et une réponse en train d'arriver", () => {
    setContentHeight(150);
    const { unmount } = render(<AssistantMessage content="Courte" hideFeedback />);
    expect(screen.queryByRole("button", { name: "Voir plus" })).not.toBeInTheDocument();
    unmount();

    setContentHeight(600);
    render(<AssistantMessage content="En cours" hideFeedback streaming />);
    expect(screen.queryByRole("button", { name: "Voir plus" })).not.toBeInTheDocument();
  });
});
