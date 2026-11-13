import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { openPdfDocument } from "../../lib/library/pdfDocument.js";
import { IconButton } from "../ui/IconButton.js";
import { Skeleton } from "../ui/Skeleton.js";
import { fr } from "../../i18n/fr.js";

export interface CvPreviewProps {
  url: string;
  ownerName: string;
}

/** Aperçu dessiné page par page dans un canvas, à la largeur de la colonne. */
export function CvPreview({ url, ownerName }: CvPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    setState("loading");
    setPageNumber(1);
    openPdfDocument(url)
      .then((proxy) => {
        opened = proxy;
        if (cancelled) return void proxy.loadingTask.destroy();
        setDocumentProxy(proxy);
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
      void opened?.loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!documentProxy || !canvas || !container) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    documentProxy
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const unscaled = page.getViewport({ scale: 1 });
        const ratio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({
          scale: (container.clientWidth / unscaled.width) * ratio,
        });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = page.render({ canvas, viewport });
        return task.promise;
      })
      .then(() => !cancelled && setState("ready"))
      .catch((error: unknown) => {
        if (!cancelled && (error as { name?: string }).name !== "RenderingCancelledException")
          setState("error");
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [documentProxy, pageNumber]);

  const pageCount = documentProxy?.numPages ?? 0;

  if (state === "error") {
    return <p className="text-sm text-text-2">{fr.library.cvPreviewError}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Blanc dans les deux thèmes : la couleur du papier du PDF, pas celle de l'interface. */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-card border border-border bg-white"
      >
        {state === "loading" && (
          <>
            <Skeleton className="aspect-[1/1.414] w-full rounded-none" />
            <span className="sr-only">{fr.library.cvPreviewLoading}</span>
          </>
        )}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={fr.library.cvPreviewLabel(ownerName)}
          className={state === "ready" ? "block h-auto w-full" : "hidden"}
        />
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <IconButton
            aria-label={fr.library.cvPreviousPage}
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => current - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </IconButton>
          <span className="text-sm text-text-2 tabular-nums" aria-live="polite">
            {fr.library.cvPage(pageNumber, pageCount)}
          </span>
          <IconButton
            aria-label={fr.library.cvNextPage}
            disabled={pageNumber >= pageCount}
            onClick={() => setPageNumber((current) => current + 1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
