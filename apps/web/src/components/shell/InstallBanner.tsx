import { X } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { useInstallPrompt } from "../../pwa/installPrompt.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";

export function InstallBanner() {
  const { canInstall, install, dismiss } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <div className="flex flex-col items-start gap-2 rounded-card bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <p className="text-sm text-text-2">{fr.install.banner}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" className="text-link" onClick={() => void install()}>
          {fr.install.cta}
        </Button>
        <IconButton aria-label={fr.install.dismiss} onClick={dismiss}>
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}
