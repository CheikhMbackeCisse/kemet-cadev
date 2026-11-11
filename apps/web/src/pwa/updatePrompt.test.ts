import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasWaitingWorkerForTests,
  recoverFromMissingCode,
  resetUpdatePromptForTests,
  trackWaitingWorker,
} from "./updatePrompt.js";

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = "installing";
  install() {
    this.state = "installed";
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  startInstall() {
    this.installing = new FakeWorker();
    this.dispatchEvent(new Event("updatefound"));
    return this.installing;
  }
}

function track(registration: FakeRegistration, hasController: boolean) {
  trackWaitingWorker(registration as unknown as ServiceWorkerRegistration, () => hasController);
}

describe("trackWaitingWorker", () => {
  afterEach(resetUpdatePromptForTests);

  it("propose la nouvelle version quand un service worker s'installe sous un autre", () => {
    const registration = new FakeRegistration();
    track(registration, true);
    const worker = registration.startInstall();
    expect(hasWaitingWorkerForTests()).toBe(false);
    worker.install();
    expect(hasWaitingWorkerForTests()).toBe(true);
  });

  it("propose une version déjà en attente à l'ouverture", () => {
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    track(registration, true);
    expect(hasWaitingWorkerForTests()).toBe(true);
  });

  it("ne propose rien au tout premier passage, sans service worker qui contrôle la page", () => {
    const registration = new FakeRegistration();
    track(registration, false);
    registration.startInstall().install();
    expect(hasWaitingWorkerForTests()).toBe(false);
  });
});

describe("trackWaitingWorker, installation déjà commencée", () => {
  afterEach(resetUpdatePromptForTests);

  it("suit une installation commencée avant l'appel", () => {
    const registration = new FakeRegistration();
    registration.installing = new FakeWorker();
    track(registration, true);
    expect(hasWaitingWorkerForTests()).toBe(false);
    registration.installing.install();
    expect(hasWaitingWorkerForTests()).toBe(true);
  });
});

describe("recoverFromMissingCode", () => {
  const error = new Error("Failed to fetch dynamically imported module");

  beforeEach(() => {
    vi.stubEnv("DEV", false);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("tente un seul rechargement, puis laisse passer l'erreur", async () => {
    const pending = recoverFromMissingCode(error);
    let settled = false;
    void pending.catch(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(window.sessionStorage.getItem("kemet.versionReload")).not.toBeNull();

    await expect(recoverFromMissingCode(error)).rejects.toBe(error);
  });

  it("retente après une minute", async () => {
    window.sessionStorage.setItem("kemet.versionReload", String(Date.now() - 61_000));
    const pending = recoverFromMissingCode(error);
    let settled = false;
    void pending.catch(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
  });
});
