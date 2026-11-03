import { useState } from "react";
import { useToast } from "../components/ui/Toast.js";
import { fr } from "../i18n/fr.js";
import { ChatApiError, downloadAccountExport } from "./chat/api.js";

/** Télécharge l'export JSON du compte, depuis les Paramètres ou avant une suppression. */
export function useAccountExport(): { exporting: boolean; exportAccount: () => Promise<void> } {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  async function exportAccount() {
    setExporting(true);
    try {
      const { blob, fileName } = await downloadAccountExport();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      const rateLimited = caught instanceof ChatApiError && caught.statusCode === 429;
      toast.show(rateLimited ? fr.settings.exportRateLimited : fr.settings.exportError, "danger");
    } finally {
      setExporting(false);
    }
  }

  return { exporting, exportAccount };
}
