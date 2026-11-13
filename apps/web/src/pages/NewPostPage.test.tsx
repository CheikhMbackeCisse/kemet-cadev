import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Attachment } from "@kemet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fr } from "../i18n/fr.js";
import { NewPostPage } from "./NewPostPage.js";

vi.mock("../session/SessionProvider.js", () => ({
  useSession: () => ({ status: "ready", isSuspended: false }),
}));

vi.mock("../components/layout/FormPage.js", () => ({
  FormPage: ({ children }: { children: ReactNode }) => <form>{children}</form>,
}));

vi.mock("../components/content/CodeTextarea.js", () => ({
  CodeTextarea: ({ label }: { label: string }) => <textarea aria-label={label} />,
}));

vi.mock("../components/organizations/PublishAsField.js", () => ({
  PUBLISH_AS_ME: "me",
  PublishAsField: () => null,
}));

vi.mock("../components/ui/Toast.js", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

const progress: { report: ((fraction: number) => void) | null; finish: (() => void) | null } = {
  report: null,
  finish: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NewPostPage />
    </QueryClientProvider>,
  );
}

function attachment(kind: "image" | "video"): Attachment {
  return {
    id:
      kind === "image"
        ? "00000000-0000-4000-8000-000000000001"
        : "00000000-0000-4000-8000-000000000002",
    kind,
    mimeType: kind === "image" ? "image/png" : "video/mp4",
    originalName: kind === "image" ? "capture.png" : "demo.mp4",
    byteSize: 1000,
    durationMs: kind === "video" ? 12_000 : null,
    createdAt: new Date().toISOString(),
    removed: false,
  };
}

vi.mock("../lib/chat/api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/chat/api.js")>()),
  uploadPostAttachment: vi.fn(async () => attachment("image")),
  uploadPostVideo: vi.fn(
    (_file: File, _poster: Blob, onProgress: (fraction: number) => void) =>
      new Promise<Attachment>((resolve) => {
        progress.report = onProgress;
        progress.finish = () => resolve(attachment("video"));
      }),
  ),
}));

vi.mock("../lib/feed/videoPoster.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/feed/videoPoster.js")>()),
  prepareVideo: vi.fn(async () => ({ poster: new Blob(["x"], { type: "image/jpeg" }) })),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

function fileInputs(container: HTMLElement) {
  const [image, video] = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
  return { image: image!, video: video! };
}

describe("NewPostPage", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:poster");
    URL.revokeObjectURL = vi.fn();
  });

  it("garde le bouton vidéo visible et le désactive une fois une image choisie", async () => {
    const { container } = renderPage();
    fireEvent.change(fileInputs(container).image, {
      target: { files: [new File(["x"], "capture.png", { type: "image/png" })] },
    });
    await screen.findByAltText("capture.png");
    expect(screen.getByRole("button", { name: fr.feed.attachVideo })).toBeDisabled();
    expect(screen.getByRole("button", { name: fr.feed.attachImage })).toBeEnabled();
  });

  it("garde le bouton image visible et le désactive une fois une vidéo choisie", async () => {
    const { container } = renderPage();
    fireEvent.change(fileInputs(container).video, {
      target: { files: [new File(["x"], "demo.mp4", { type: "video/mp4" })] },
    });
    await waitFor(() => expect(progress.finish).not.toBeNull());
    await act(async () => progress.finish!());
    await screen.findByAltText("demo.mp4");
    expect(screen.getByRole("button", { name: fr.feed.attachImage })).toBeDisabled();
    expect(screen.getByRole("button", { name: fr.feed.attachVideo })).toBeDisabled();
  });

  it("n'annonce au lecteur d'écran que le début, 50 % et la fin de l'envoi", async () => {
    progress.finish = null;
    const { container } = renderPage();
    const status = screen.getByRole("status");
    const announced: string[] = [];
    const record = () => {
      const text = status.textContent ?? "";
      if (text && text !== announced.at(-1)) announced.push(text);
    };
    fireEvent.change(fileInputs(container).video, {
      target: { files: [new File(["x"], "demo.mp4", { type: "video/mp4" })] },
    });
    await waitFor(() => expect(progress.finish).not.toBeNull());
    record();
    for (const fraction of [0.1, 0.27, 0.49, 0.5, 0.73, 0.98, 1]) {
      act(() => progress.report!(fraction));
      record();
      expect(
        screen.getAllByText(fr.feed.videoUploading(Math.round(fraction * 100))).length,
      ).toBeGreaterThan(0);
    }
    await act(async () => progress.finish!());
    record();
    expect(announced).toEqual([
      fr.feed.videoPreparing,
      fr.feed.videoUploading(50),
      fr.feed.videoUploaded,
    ]);
  });
});
