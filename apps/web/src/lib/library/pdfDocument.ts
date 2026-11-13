import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Ouvre un PDF avec pdf.js, chargé seulement à la première ouverture d'un CV.
 * Version "legacy" : les téléphones Android anciens n'ont pas tout ce que la
 * version moderne suppose. Pas de formulaire XFA, et jamais le script embarqué du
 * fichier : pdf.js ne l'exécute que dans sa visionneuse complète, absente ici.
 */
export async function openPdfDocument(url: string): Promise<PDFDocumentProxy> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ url, enableXfa: false, withCredentials: true }).promise;
}
