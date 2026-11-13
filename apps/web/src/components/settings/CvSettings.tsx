import { FileText, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { MAX_CV_BYTES, type Cv, type CvVisibility } from "@kemet/shared";
import {
  ChatApiError,
  deleteCv,
  getUserLibrary,
  updateCvVisibility,
  uploadCv,
} from "../../lib/chat/api.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Select } from "../ui/Select.js";
import { Skeleton } from "../ui/Skeleton.js";
import { useToast } from "../ui/Toast.js";
import { fr } from "../../i18n/fr.js";

const VISIBILITY_OPTIONS: { value: CvVisibility; label: string }[] = [
  { value: "members", label: fr.settings.cvVisibilityMembers },
  { value: "public", label: fr.settings.cvVisibilityPublic },
];

function formatSize(bytes: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} Mo`;
}

/** Section CV de Paramètres > Profil : envoyer, remplacer, régler qui le voit, retirer. */
export function CvSettings({ handle, disabled }: { handle: string; disabled: boolean }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cv, setCv] = useState<Cv | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<"upload" | "visibility" | "remove" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(() => {
    setLoaded(false);
    setLoadError(false);
    getUserLibrary(handle)
      .then((library) => setCv(library.cv))
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true));
  }, [handle]);

  useEffect(load, [load]);

  useEffect(() => {
    if (loaded && window.location.hash === "#cv") {
      document.getElementById("cv")?.scrollIntoView({ block: "start" });
    }
  }, [loaded]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // Certains systèmes ne donnent aucun type : l'extension suffit alors, le serveur lit le contenu.
    const looksLikePdf =
      file.type === "application/pdf" ||
      (file.type === "" && file.name.toLowerCase().endsWith(".pdf"));
    if (!looksLikePdf) {
      toast.show(fr.settings.cvNotPdf, "danger");
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      toast.show(fr.settings.cvTooLarge, "danger");
      return;
    }
    setBusy("upload");
    try {
      setCv(await uploadCv(file));
      toast.show(fr.settings.cvUploaded, "success");
    } catch (err) {
      toast.show(
        err instanceof ChatApiError && err.statusCode === 400
          ? err.message
          : fr.settings.cvUploadError,
        "danger",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleVisibility(value: string) {
    setBusy("visibility");
    try {
      const result = await updateCvVisibility(value as CvVisibility);
      setCv(result.cv);
      toast.show(fr.settings.saved, "success");
    } catch {
      toast.show(fr.settings.cvVisibilityError, "danger");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setConfirmOpen(false);
    setBusy("remove");
    try {
      await deleteCv();
      setCv(null);
      toast.show(fr.settings.cvRemoved, "success");
    } catch {
      toast.show(fr.settings.cvRemoveError, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      id="cv"
      aria-labelledby="cv-title"
      className="flex max-w-sm scroll-mt-20 flex-col gap-3"
    >
      <h2 id="cv-title" className="text-md font-semibold text-text">
        {fr.settings.cvTitle}
      </h2>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => void handleFile(event)}
        aria-hidden="true"
        tabIndex={-1}
      />
      {!loaded ? (
        <Skeleton className="h-16 w-full" />
      ) : loadError ? (
        <ErrorState
          message={fr.settings.cvLoadError}
          retry={{ label: fr.chat.retry, onClick: load }}
          className="py-6"
        />
      ) : cv ? (
        <>
          <div className="flex items-center gap-2">
            <FileText className="size-5 shrink-0 text-text-2" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{cv.originalName}</p>
              <p className="text-xs text-subtle">{formatSize(cv.byteSize)}</p>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.settings.cvVisibilityLabel}
            <Select
              aria-label={fr.settings.cvVisibilityLabel}
              value={cv.visibility}
              onValueChange={(value) => void handleVisibility(value)}
              options={VISIBILITY_OPTIONS}
              disabled={disabled || busy !== null}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || (busy !== null && busy !== "upload")}
              loading={busy === "upload"}
            >
              <Upload className="size-4" aria-hidden="true" />
              {fr.settings.cvReplace}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(true)}
              disabled={disabled || busy !== null}
              loading={busy === "remove"}
            >
              {fr.settings.cvRemove}
            </Button>
          </div>
        </>
      ) : (
        <div>
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            loading={busy === "upload"}
          >
            <Upload className="size-4" aria-hidden="true" />
            {fr.settings.cvUpload}
          </Button>
        </div>
      )}
      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={fr.settings.cvRemove}
        description={fr.settings.cvRemoveConfirm}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            {fr.common.cancel}
          </Button>
          <Button variant="danger" onClick={() => void handleRemove()}>
            {fr.settings.cvRemove}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
