import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MeResponse } from "@kemet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast.js";
import { DeleteAccountPage } from "./DeleteAccountPage.js";

const getMe = vi.fn();
const deleteMyAccount = vi.fn();

vi.mock("../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/chat/api.js")>()),
  getMe: () => getMe(),
  deleteMyAccount: (password?: string) => deleteMyAccount(password),
}));

vi.mock("../session/SessionProvider.js", () => ({
  useSession: () => ({ status: "ready", isSuspended: false }),
}));

vi.mock("../components/layout/RailPage.js", () => ({
  RailPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function me(overrides: Partial<MeResponse>): MeResponse {
  return {
    user: { id: "u1", email: "amina@test.kemet", emailVerified: true },
    profile: null,
    points: 0,
    credentials: [],
    isPlatformAdmin: false,
    isSuspended: false,
    hasPassword: true,
    socialProviders: [],
    onboarding: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <ToastProvider>
      <DeleteAccountPage />
    </ToastProvider>,
  );
}

const SUBMIT = { name: "Supprimer définitivement mon compte" };

// La case à cocher Radix mesure sa taille, ce que jsdom ne sait pas faire.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("DeleteAccountPage", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    getMe.mockReset();
    deleteMyAccount.mockReset();
  });

  it("demande la case et le mot de passe avant d'activer la suppression", async () => {
    getMe.mockResolvedValue(me({ hasPassword: true }));
    renderPage();

    const password = await screen.findByLabelText("Ton mot de passe");
    expect(screen.getByRole("button", SUBMIT)).toBeDisabled();
    expect(screen.getByText("Coche la case pour confirmer.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Saisis ton mot de passe.")).toBeInTheDocument();

    fireEvent.change(password, { target: { value: "secret" } });
    expect(screen.getByRole("button", SUBMIT)).toBeEnabled();
  });

  it("dit clairement qu'un mot de passe est faux, sans quitter la page", async () => {
    getMe.mockResolvedValue(me({ hasPassword: true }));
    const { ChatApiError } = await import("../lib/chat/api.js");
    deleteMyAccount.mockRejectedValue(new ChatApiError("wrong_password", "Mot de passe incorrect.", 403));
    renderPage();

    fireEvent.change(await screen.findByLabelText("Ton mot de passe"), { target: { value: "faux" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", SUBMIT));

    expect(await screen.findByRole("alert")).toHaveTextContent("Mot de passe incorrect.");
    expect(deleteMyAccount).toHaveBeenCalledWith("faux");
  });

  it("propose de se reconnecter à un compte sans mot de passe", async () => {
    getMe.mockResolvedValue(me({ hasPassword: false, socialProviders: ["github"] }));
    renderPage();

    expect(await screen.findByRole("button", { name: "Se reconnecter avec GitHub" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Ton mot de passe")).not.toBeInTheDocument();
  });
});
