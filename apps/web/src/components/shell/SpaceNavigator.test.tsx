import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../ui/Tooltip.js";
import { SpaceNavigator, type SpaceNavigatorProps } from "./SpaceNavigator.js";

function renderNavigator(overrides: Partial<SpaceNavigatorProps> = {}) {
  const props: SpaceNavigatorProps = {
    layout: "panel",
    title: "Mes espaces",
    status: "ready",
    onRetry: vi.fn(),
    spaces: [
      { id: "cadev", name: "CADEV 2026" },
      { id: "flutter", name: "Flutter Dakar", hasUnread: true },
    ],
    activeSpaceId: "cadev",
    onSelectSpace: vi.fn(),
    spaceName: "CADEV 2026",
    channels: [
      { id: "general", name: "général", unreadCount: 3 },
      { id: "memes", name: "mèmes" },
    ],
    channelsLoading: false,
    channelsError: false,
    onRetryChannels: vi.fn(),
    activeChannelId: "general",
    onSelectChannel: vi.fn(),
    canCreateSpace: false,
    ...overrides,
  };
  render(
    <TooltipProvider>
      <SpaceNavigator {...props} />
    </TooltipProvider>,
  );
  return props;
}

describe("navigation des espaces", () => {
  it("montre les logos de tous les espaces et seulement les salons de l'espace choisi, sous son nom", () => {
    renderNavigator();
    expect(screen.getByRole("button", { name: "CADEV 2026" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Flutter Dakar, messages non lus" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { name: "CADEV 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "général, 3 messages non lus" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "mèmes" })).toBeInTheDocument();
  });

  it("transmet le choix d'un espace et d'un salon", () => {
    const props = renderNavigator();
    fireEvent.click(screen.getByRole("button", { name: "Flutter Dakar, messages non lus" }));
    fireEvent.click(screen.getByRole("button", { name: "mèmes" }));
    expect(props.onSelectSpace).toHaveBeenCalledWith("flutter");
    expect(props.onSelectChannel).toHaveBeenCalledWith("memes");
  });

  it("montre un squelette pendant le chargement des espaces", () => {
    renderNavigator({ status: "loading" });
    expect(screen.getByRole("navigation", { name: "Mes espaces" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("propose de réessayer après une erreur", () => {
    const props = renderNavigator({ status: "error" });
    expect(screen.getByText("Impossible de charger les espaces.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it("dit qu'il n'y a aucun espace", () => {
    renderNavigator({ spaces: [] });
    expect(
      screen.getByText("Aucun espace pour l'instant. Cherche un espace public ou crée le tien."),
    ).toBeInTheDocument();
  });

  it("charge les salons de l'espace choisi sans le montrer vide", () => {
    renderNavigator({ channelsLoading: true });
    expect(screen.queryByRole("button", { name: "mèmes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CADEV 2026" })).toBeInTheDocument();
  });

  it("propose de créer un espace en bas de la liste sur téléphone", () => {
    renderNavigator({ layout: "page", canCreateSpace: true });
    expect(screen.getByRole("link", { name: "Créer un espace" })).toHaveAttribute(
      "href",
      "/salons/nouveau",
    );
  });
});
