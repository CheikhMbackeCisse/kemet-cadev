import { afterEach, describe, expect, it } from "vitest";
import { hasWaitingWorkerForTests, resetUpdatePromptForTests, trackWaitingWorker } from "./updatePrompt.js";

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
