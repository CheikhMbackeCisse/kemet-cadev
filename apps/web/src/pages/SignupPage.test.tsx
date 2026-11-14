import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast.js";
import { fr } from "../i18n/fr.js";
import { SignupPage } from "./SignupPage.js";

const signUp = vi.fn();

vi.mock("../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/chat/api.js")>()),
  signUp: (input: unknown) => signUp(input),
  getAuthConfig: () => new Promise(() => {}),
}));

vi.mock("../session/SessionProvider.js", () => ({
  useSession: () => ({ status: "anonymous", refresh: vi.fn() }),
}));

function fillForm(email: string) {
  fireEvent.change(screen.getByLabelText(fr.auth.nameLabel), { target: { value: "Awa" } });
  fireEvent.change(screen.getByLabelText(fr.auth.emailLabel), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(fr.auth.passwordLabel), {
    target: { value: "une-passphrase-solide" },
  });
}

// Les écrans de compte mesurent la carte pour placer le réseau (ArrivalLayout).
class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    signUp.mockReset();
    render(
      <ToastProvider>
        <SignupPage />
      </ToastProvider>,
    );
  });

  it("refuse une adresse du domaine de démonstration avec un message sous le champ", () => {
    fillForm("awa@equipe.demo.kemetlabs.dev");

    const field = screen.getByLabelText(fr.auth.emailLabel);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(fr.auth.demoEmailError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.auth.signupSubmit })).toBeEnabled();
  });

  it("accepte une adresse ordinaire", () => {
    fillForm("awa@exemple.sn");

    expect(screen.queryByText(fr.auth.demoEmailError)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.auth.signupSubmit })).toBeEnabled();
  });
});
