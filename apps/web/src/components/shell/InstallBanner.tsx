import { Download, X } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { useInstallPrompt } from "../../pwa/installPrompt.js";
import { IconButton } from "../ui/IconButton.js";

export function InstallBanner() {
  const { canInstall, install, dismiss } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border text-sm">
      <Download className="size-4 shrink-0 text-muted" aria-hidden="true" />
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex h-control min-w-0 flex-1 items-center truncate text-left text-link hover:underline max-md:h-control-mobile"
      >
        {fr.install.cta}
      </button>
      <IconButton aria-label={fr.install.dismiss} onClick={dismiss}>
        <X className="size-4" aria-hidden="true" />
      </IconButton>
    </div>
  );
}
