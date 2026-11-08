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
    fireEvent.click(screen.getByRole("radio", { name: fr.intro.whoDeveloper }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.continue }));

    expect(screen.getByRole("heading", { name: fr.intro.domainsTitle })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/decouvrir/domaines");
    expect(readIntroAnswers().role).toBe("developer");
  });

  it("demande à un recruteur ce qu'il cherche", () => {
    render(<IntroQuestionsPage />);
    fireEvent.click(screen.getByRole("radio", { name: fr.intro.whoHr }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.continue }));

    expect(screen.getByRole("heading", { name: fr.intro.seekingTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: fr.intro.intents.recruit }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.continue }));

    expect(readIntroAnswers().intents).toEqual(["recruit"]);
  });

  it("Passer n'enregistre pas le choix en cours", () => {
    render(<IntroQuestionsPage />);
    fireEvent.click(screen.getByRole("radio", { name: fr.intro.whoStudent }));
    fireEvent.click(screen.getByRole("button", { name: fr.onboarding.skip }));

    expect(screen.getByRole("heading", { name: fr.intro.domainsTitle })).toBeInTheDocument();
    expect(readIntroAnswers().role).toBeUndefined();
  });

  it("la dernière question mène à l'inscription et marque l'accueil comme vu", () => {
    window.history.replaceState(null, "", "/decouvrir/objectifs");
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, pathname: "/decouvrir/objectifs", set href(value: string) { assign(value); } });
    render(<IntroQuestionsPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: fr.intro.intents.showcase_work }));
    fireEvent.click(screen.getByRole("button", { name: fr.intro.finish }));

    expect(assign).toHaveBeenCalledWith("/inscription");
    expect(hasSeenIntro()).toBe(true);
    expect(readIntroAnswers().intents).toEqual(["showcase_work"]);
    vi.unstubAllGlobals();
  });
});
