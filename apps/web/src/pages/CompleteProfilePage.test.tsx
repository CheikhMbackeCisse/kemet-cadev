import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompleteProfilePage } from "./CompleteProfilePage.js";

const api = vi.hoisted(() => ({
  checkHandleAvailability: vi.fn(),
  updateMyProfile: vi.fn(),
}));

vi.mock("../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/chat/api.js")>()),
  checkHandleAvailability: api.checkHandleAvailability,
  updateMyProfile: api.updateMyProfile,
}));

const session = vi.hoisted(() => ({
  status: "incomplete",
  onboarding: null,
  refresh: vi.fn(),
  user: { id: "u1", email: "awa@test.kemet", emailVerified: true, name: "" },
}));
vi.mock("../session/SessionProvider.js", () => ({ useSession: () => session }));

vi.mock("../components/auth/AuthLayout.js", () => ({
  AuthLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

describe("CompleteProfilePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.checkHandleAvailability.mockResolvedValue({ available: true });
    localStorage.setItem(
      "kemet.intro",
      JSON.stringify({ seen: true, answers: { role: "student" }, savedAt: Date.now() }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("tire le @ du nom, sans accents ni espaces, et montre la carte de profil", () => {
    render(<CompleteProfilePage />);
    expect(screen.queryByRole("figure")).toBeNull();
    fireEvent.change(screen.getByLabelText("Ton nom"), { target: { value: "Aïssatou Ndiaye" } });
    expect(screen.getByLabelText("Ton @")).toHaveValue("aissatou-ndiaye");
    const card = screen.getByRole("figure", { name: "Aperçu de ton profil" });
    expect(card).toHaveTextContent("Aïssatou Ndiaye");
    expect(card).toHaveTextContent("Étudie l'informatique");
    expect(card).toHaveTextContent("@aissatou-ndiaye");
    expect(screen.getByText(/\/u\/aissatou-ndiaye$/)).toBeInTheDocument();
  });

  it("ne suit plus le nom une fois le @ modifié à la main", () => {
    render(<CompleteProfilePage />);
    fireEvent.change(screen.getByLabelText("Ton nom"), { target: { value: "Awa" } });
    fireEvent.change(screen.getByLabelText("Ton @"), { target: { value: "@awa-dev" } });
    fireEvent.change(screen.getByLabelText("Ton nom"), { target: { value: "Awa Ndiaye" } });
    expect(screen.getByLabelText("Ton @")).toHaveValue("awa-dev");
  });

  it("dit si le @ est libre ou déjà pris, une fois la frappe arrêtée", async () => {
    api.checkHandleAvailability.mockResolvedValueOnce({ available: false, reason: "taken" });
    render(<CompleteProfilePage />);
    fireEvent.change(screen.getByLabelText("Ton @"), { target: { value: "awa-ndiaye" } });
    expect(api.checkHandleAvailability).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(api.checkHandleAvailability).toHaveBeenCalledWith("awa-ndiaye", expect.any(AbortSignal));
    expect(screen.getByText("Déjà pris")).toBeInTheDocument();
  });

  it("refuse un @ réservé sans le demander au serveur", async () => {
    render(<CompleteProfilePage />);
    fireEvent.change(screen.getByLabelText("Ton @"), { target: { value: "kocc" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(api.checkHandleAvailability).not.toHaveBeenCalled();
    expect(screen.getByText("Réservé")).toBeInTheDocument();
  });

  it("préremplit le nom donné à l'inscription", () => {
    session.user = { ...session.user, name: "Moussa Sall" };
    render(<CompleteProfilePage />);
    expect(screen.getByLabelText("Ton nom")).toHaveValue("Moussa Sall");
    expect(screen.getByLabelText("Ton @")).toHaveValue("moussa-sall");
    session.user = { ...session.user, name: "" };
  });
});
