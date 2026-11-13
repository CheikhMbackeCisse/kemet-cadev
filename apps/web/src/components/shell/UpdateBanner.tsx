import { fr } from "../../i18n/fr.js";
import { applyUpdate, useUpdateAvailable } from "../../pwa/updatePrompt.js";

export function UpdateBanner() {
  const available = useUpdateAvailable();
  if (!available) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-center gap-3 border-b border-border bg-surface px-4 text-sm text-text"
      style={{ paddingTop: "env(safe-area-inset-top)", boxSizing: "content-box" }}
    >
      <span>{fr.update.available}</span>
      <button
        type="button"
        onClick={applyUpdate}
        className="inline-flex h-8 items-center rounded-control px-2 font-medium text-link hover:underline"
      >
        {fr.update.apply}
      </button>
    </div>
  );
}
