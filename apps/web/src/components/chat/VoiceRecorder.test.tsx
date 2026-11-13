import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../ui/Toast.js";
import { useVoiceMessage } from "./VoiceRecorder.js";

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported = (type: string) => type === "audio/webm;codecs=opus";
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm;codecs=opus";
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    const data = new Event("dataavailable") as Event & { data: Blob };
    data.data = new Blob(["voix"], { type: this.mimeType });
    this.dispatchEvent(data);
    this.dispatchEvent(new Event("stop"));
  }
}

const stopTrack = vi.fn();

function Composer({ onRecorded }: { onRecorded: (id: string) => void }) {
  const voice = useVoiceMessage({ channelId: "00000000-0000-4000-8000-0000000000bb", onRecorded });
  return (
    <div>
      <div className="relative">
        {voice.overlay}
        {voice.button}
      </div>
      {voice.notice}
    </div>
  );
}

function renderComposer(onRecorded = vi.fn()) {
  render(
    <ToastProvider>
      <Composer onRecorded={onRecorded} />
    </ToastProvider>,
  );
  return onRecorded;
}

describe("useVoiceMessage", () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ attachment: { id: "voice-1" } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    stopTrack.mockClear();
  });

  it("démarre au clic, envoie l'enregistrement avec sa durée et libère le micro", async () => {
    const onRecorded = renderComposer();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer un message vocal" }));
    });
    expect(screen.getByRole("group", { name: "Enregistrement en cours" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le message vocal" }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/channels/00000000-0000-4000-8000-0000000000bb/messages/voice");
    const body = (init as RequestInit).body as FormData;
    expect(Number(body.get("durationMs"))).toBeGreaterThanOrEqual(3000);
    expect((body.get("file") as File).name).toBe("message-vocal.webm");
    expect(onRecorded).toHaveBeenCalledWith("voice-1");
    expect(stopTrack).toHaveBeenCalled();
  });

  it("n'envoie rien quand on annule", async () => {
    const onRecorded = renderComposer();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer un message vocal" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Annuler l'enregistrement" }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onRecorded).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("group", { name: "Enregistrement en cours" }),
    ).not.toBeInTheDocument();
  });

  it("explique en une ligne un micro refusé", async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error("refusé"), { name: "NotAllowedError" }));
    renderComposer();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer un message vocal" }));
    });
    expect(screen.getByText(/Micro bloqué/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("s'arrête et envoie de lui-même à deux minutes", async () => {
    const onRecorded = renderComposer();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer un message vocal" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(120_400);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body as FormData;
    expect(Number(body.get("durationMs"))).toBe(120_000);
    expect(onRecorded).toHaveBeenCalledWith("voice-1");
  });
});
