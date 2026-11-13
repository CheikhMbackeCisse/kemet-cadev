import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fr } from "../i18n/fr.js";
import { hasSeenIntro, readIntroAnswers } from "../lib/intro/introStorage.js";
import { IntroQuestionsPage } from "./IntroQuestionsPage.js";

describe("IntroQuestionsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    window.history.replaceState(null, "", "/decouvrir/qui");
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("demande ses domaines à un développeur", () => {
    render(<IntroQuestionsPage />);
    fireEvent.click(screen.getByRole("radio", { name: fr.auth.roleDeveloper }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.continue }));

    expect(screen.getByRole("heading", { name: fr.intro.domainsTitle })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/decouvrir/domaines");
    expect(readIntroAnswers().role).toBe("developer");
  });

  it("demande à un recruteur ce qu'il cherche", () => {
    render(<IntroQuestionsPage />);
    fireEvent.click(screen.getByRole("radio", { name: fr.auth.roleHr }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.continue }));

    expect(screen.getByRole("heading", { name: fr.intro.seekingTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: fr.intro.seeking.recruit }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.continue }));

    expect(readIntroAnswers().intents).toEqual(["recruit"]);
  });

  it("Passer n'enregistre pas le choix en cours", () => {
    render(<IntroQuestionsPage />);
    fireEvent.click(screen.getByRole("radio", { name: fr.auth.roleStudent }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.skip }));

    expect(screen.getByRole("heading", { name: fr.intro.domainsTitle })).toBeInTheDocument();
    expect(readIntroAnswers().role).toBeUndefined();
  });

  it("pose trois questions, la nationalité en dernier", () => {
    render(<IntroQuestionsPage />);
    expect(
      screen.getByRole("progressbar", { name: fr.onboarding.progress(1, 3) }),
    ).toBeInTheDocument();
  });

  it("la nationalité mène à l'inscription et marque l'accueil comme vu", () => {
    window.history.replaceState(null, "", "/decouvrir/pays");
    render(<IntroQuestionsPage />);

    fireEvent.click(screen.getByRole("radio", { name: /Sénégal/ }));
    fireEvent.click(screen.getByRole("button", { name: fr.intro.finish }));

    expect(window.location.pathname).toBe("/inscription");
    expect(hasSeenIntro()).toBe(true);
    expect(readIntroAnswers().country).toBe("SN");
  });

  it("ramène l'ancienne question sur les objectifs au début", () => {
    window.history.replaceState(null, "", "/decouvrir/objectifs");
    render(<IntroQuestionsPage />);
    expect(screen.getByRole("heading", { name: fr.intro.whoTitle })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/decouvrir/qui");
  });

  it("garde une intention d'une version précédente quand un recruteur choisit", () => {
    window.localStorage.setItem(
      "kemet.intro",
      JSON.stringify({
        seen: true,
        savedAt: Date.now(),
        answers: { role: "hr", intents: ["learn"] },
      }),
    );
    window.history.replaceState(null, "", "/decouvrir/domaines");
    render(<IntroQuestionsPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: fr.intro.seeking.find_partner }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.continue }));

    expect(readIntroAnswers().intents).toEqual(["learn", "find_partner"]);
  });
});
