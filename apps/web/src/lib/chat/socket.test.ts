import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (...args: unknown[]) => void;

class FakeSocket {
  connected = false;
  listeners = new Map<string, Listener[]>();
  emit = vi.fn();
  connect = vi.fn(() => {
    this.connected = true;
    this.fire("connect");
  });
  disconnect = vi.fn(() => {
    this.connected = false;
  });

  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  off() {
    return this;
  }

  fire(event: string) {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

let fake: FakeSocket;

vi.mock("socket.io-client", () => ({ io: () => fake }));

async function loadModule() {
  vi.resetModules();
  return import("./socket.js");
}

function pageShow(persisted: boolean) {
  const event = new Event("pageshow") as PageTransitionEvent;
  Object.defineProperty(event, "persisted", { value: persisted });
  window.dispatchEvent(event);
}

describe("connexion temps réel", () => {
  beforeEach(() => {
    fake = new FakeSocket();
  });

  it("rejoint un salon demandé avant la connexion une seule fois, à la connexion", async () => {
    const { joinChannel } = await loadModule();
    joinChannel("salon-1");
    expect(fake.emit).not.toHaveBeenCalled();
    fake.connect();
    expect(fake.emit).toHaveBeenCalledTimes(1);
    expect(fake.emit).toHaveBeenCalledWith("channel:join", { channelId: "salon-1" });
  });

  it("redemande les salons ouverts après une reconnexion, pas ceux quittés", async () => {
    const { joinChannel, leaveChannel } = await loadModule();
    fake.connect();
    joinChannel("salon-1");
    joinChannel("salon-2");
    leaveChannel("salon-2");
    fake.emit.mockClear();
    fake.disconnect();
    fake.connect();
    expect(fake.emit.mock.calls).toEqual([["channel:join", { channelId: "salon-1" }]]);
  });

  it("se ferme quand la page est quittée et se rouvre au retour depuis le cache du navigateur", async () => {
    const { joinChannel } = await loadModule();
    joinChannel("salon-1");
    fake.connect();
    window.dispatchEvent(new Event("pagehide"));
    expect(fake.disconnect).toHaveBeenCalled();
    pageShow(false);
    expect(fake.connect).toHaveBeenCalledTimes(1);
    pageShow(true);
    expect(fake.connect).toHaveBeenCalledTimes(2);
    expect(fake.emit).toHaveBeenLastCalledWith("channel:join", { channelId: "salon-1" });
  });
});

describe("changement de compte", () => {
  beforeEach(() => {
    fake = new FakeSocket();
  });

  it("rouvre la connexion sans redemander les salons du compte précédent", async () => {
    const { joinChannel, resetRealtimeConnection } = await loadModule();
    joinChannel("salon-1");
    fake.connect();
    fake.emit.mockClear();
    resetRealtimeConnection();
    expect(fake.disconnect).toHaveBeenCalled();
    expect(fake.connect).toHaveBeenCalledTimes(2);
    expect(fake.emit).not.toHaveBeenCalled();
  });
});
