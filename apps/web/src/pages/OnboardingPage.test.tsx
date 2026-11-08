import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MeResponse, OnboardingState } from "@kemet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fr } from "../i18n/fr.js";
import { OnboardingPage } from "./OnboardingPage.js";
import { readIntroAnswers, saveIntroAnswers } from "../lib/intro/introStorage.js";

const updateOnboarding = vi.fn();
const updateMyProfile = vi.fn();
let session: { status: string; profile: MeResponse["profile"]; onboarding: OnboardingState | null };

vi.mock("../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/chat/api.js")>()),
  updateOnboarding: (input: unknown) => updateOnboarding(input),
  updateMyProfile: (input: unknown) => updateMyProfile(input),
  getOnboardingSpaces: () => new Promise(() => {}),
  getOnboardingPeople: () => new Promise(() => {}),
}));

vi.mock("../session/SessionProvider.js", () => ({
  useSession: () => session,
}));

const PROFILE: NonNullable<MeResponse["profile"]> = {
  id: "00000000-0000-0000-0000-0000000000aa",
  handle: "awa",
  displayName: "Awa",
  country: "",
  role: null,
  title: null,
  bio: null,
  stack: [],
  githubUrl: null,
  avatarUrl: null,
  openToOpportunities: false,
  isDemo: false,
  level: "apprenti",
  createdAt: "2026-11-07T00:00:00.000Z",
};

function start(path: string, onboarding: OnboardingState) {
  window.history.replaceState(null, "", path);
  session = { status: "ready", profile: PROFILE, onboarding };
  render(<OnboardingPage />);
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    updateOnboarding.mockReset().mockResolvedValue({});
    updateMyProfile.mockReset().mockResolvedValue({});
  });

  it("reprend à l'écran enregistré quand l'adresse n'en désigne aucun", async () => {
    start("/bienvenue", { step: "interests", completed: false, interests: ["web"], intents: [] });

    expect(await screen.findByRole("heading", { name: fr.onboarding.interestsTitle })).toBeInTheDocument();
    expect(screen.getByText(fr.onboarding.progress(4, 6))).toBeInTheDocument();
    expect(window.location.pathname).toBe("/bienvenue/interets");
    expect(screen.getByRole("checkbox", { name: fr.onboarding.interests.web })).toBeChecked();
  });

  it("Passer avance sans rien enregistrer d'autre que l'écran atteint", async () => {
    start("/bienvenue/role", { step: "role", completed: false, interests: [], intents: [] });

    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.skip }));

    expect(await screen.findByRole("heading", { name: fr.onboarding.specialtyTitle })).toBeInTheDocument();
    expect(updateOnboarding).toHaveBeenCalledWith({ step: "specialty" });
    expect(updateMyProfile).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/bienvenue/specialite");
  });

  it("enregistre le choix, puis l'écran suivant", async () => {
    start("/bienvenue/role", { step: "role", completed: false, interests: [], intents: [] });

    const submit = screen.getByRole("button", { name: fr.onboarding.continue });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: fr.auth.roleDesigner }));
    fireEvent.click(submit);

    await waitFor(() => expect(updateOnboarding).toHaveBeenCalledWith({ step: "specialty" }));
    expect(updateMyProfile).toHaveBeenCalledWith({ role: "designer" });
  });

  it("Retour revient à l'écran précédent ; le premier écran n'en a pas", async () => {
    start("/bienvenue/role", { step: "role", completed: false, interests: [], intents: [] });
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.back }));

    expect(await screen.findByRole("heading", { name: fr.onboarding.countryTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.onboarding.back })).not.toBeInTheDocument();
  });

  it("filtre les pays sans tenir compte des accents", () => {
    start("/bienvenue/pays", { step: "country", completed: false, interests: [], intents: [] });

    fireEvent.change(screen.getByLabelText(fr.onboarding.countrySearchLabel), { target: { value: "senegal" } });

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Sénégal" })).toBeInTheDocument();
  });

  it("garde l'erreur affichée et l'écran en place si l'enregistrement échoue", async () => {
    updateOnboarding.mockRejectedValueOnce(new Error("hors ligne"));
    start("/bienvenue/role", { step: "role", completed: false, interests: [], intents: [] });

    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.skip }));

    expect(await screen.findByRole("alert")).toHaveTextContent(fr.onboarding.saveError);
    expect(screen.getByRole("heading", { name: fr.onboarding.roleTitle })).toBeInTheDocument();
  });

  it("enregistre les réponses de l'accueil sur le profil et saute les écrans déjà répondus", async () => {
    saveIntroAnswers({ role: "developer", country: "SN", interests: ["payments"], intents: ["learn"] });
    start("/bienvenue/pays", { step: "country", completed: false, interests: [], intents: [] });

    expect(await screen.findByRole("heading", { name: fr.onboarding.specialtyTitle })).toBeInTheDocument();
    expect(updateMyProfile).toHaveBeenCalledWith({ country: "SN", role: "developer" });
    expect(updateOnboarding).toHaveBeenCalledWith({ interests: ["payments"], intents: ["learn"] });
    expect(window.location.pathname).toBe("/bienvenue/specialite");
    expect(screen.getByText(fr.onboarding.progress(1, 3))).toBeInTheDocument();
    expect(readIntroAnswers()).toEqual({ interests: undefined, intents: undefined });
    window.localStorage.clear();
  });
});
