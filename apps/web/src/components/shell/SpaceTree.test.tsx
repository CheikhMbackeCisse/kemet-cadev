import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpaceTree, type SpaceTreeProps } from "./SpaceTree.js";

function renderTree(overrides: Partial<SpaceTreeProps> = {}) {
  const props: SpaceTreeProps = {
    title: "Mes espaces",
    status: "ready",
    onRetry: vi.fn(),
    spaces: [
      { id: "cadev", name: "CADEV 2026" },
      { id: "flutter", name: "Flutter Dakar", hasUnread: true },
    ],
    activeSpaceId: "cadev",
    onSelectSpace: vi.fn(),
    channels: [
      { id: "general", name: "général", unreadCount: 3 },
      { id: "memes", name: "mèmes" },
    ],
    channelsLoading: false,
    activeChannelId: "general",
    onSelectChannel: vi.fn(),
    ...overrides,
  };
  render(<SpaceTree {...props} />);
  return props;
}

describe("arbre des espaces", () => {
  it("nomme chaque espace sans son monogramme et montre les salons de l'espace ouvert", () => {
    renderTree();
    expect(screen.getByRole("button", { name: "CADEV 2026" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Flutter Dakar, messages non lus" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "général, 3 messages non lus" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "mèmes" })).toBeInTheDocument();
  });

  it("transmet le choix d'un espace et d'un salon", () => {
    const props = renderTree();
    fireEvent.click(screen.getByRole("button", { name: "Flutter Dakar, messages non lus" }));
    fireEvent.click(screen.getByRole("button", { name: "mèmes" }));
    expect(props.onSelectSpace).toHaveBeenCalledWith("flutter");
    expect(props.onSelectChannel).toHaveBeenCalledWith("memes");
  });

  it("montre un squelette pendant le chargement des espaces", () => {
    renderTree({ status: "loading" });
    expect(screen.getByRole("navigation", { name: "Mes espaces" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("propose de réessayer après une erreur", () => {
    const props = renderTree({ status: "error" });
    expect(screen.getByText("Impossible de charger les espaces.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it("dit qu'il n'y a aucun espace", () => {
    renderTree({ spaces: [] });
    expect(screen.getByText("Aucun espace pour l'instant.")).toBeInTheDocument();
  });

  it("charge les salons de l'espace ouvert sans le montrer vide", () => {
    renderTree({ channelsLoading: true });
    expect(screen.queryByRole("button", { name: "mèmes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CADEV 2026" })).toBeInTheDocument();
  });
});
