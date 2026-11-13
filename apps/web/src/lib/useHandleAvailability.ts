import { isReservedHandle } from "@kemet/shared";
import { useEffect, useState } from "react";
import { checkHandleAvailability } from "./chat/api.js";
import { handleError } from "./forms.js";

export type HandleStatus = "idle" | "checking" | "available" | "taken" | "reserved";

const DEBOUNCE_MS = 350;

/**
 * Disponibilité d'un identifiant pendant la saisie, demandée au serveur une
 * fois la frappe arrêtée. Un identifiant mal formé n'est pas demandé : son
 * erreur s'affiche à l'envoi, comme pour tout champ.
 */
export function useHandleAvailability(handle: string): HandleStatus {
  const [status, setStatus] = useState<HandleStatus>("idle");

  useEffect(() => {
    if (isReservedHandle(handle)) {
      setStatus("reserved");
      return;
    }
    if (handleError(handle)) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      checkHandleAvailability(handle, controller.signal)
        .then((result) => {
          if (result.available) setStatus("available");
          else if (result.reason === "invalid") setStatus("idle");
          else setStatus(result.reason);
        })
        // Hors ligne ou requête annulée : rien d'affiché, l'envoi tranchera.
        .catch(() => {
          if (!controller.signal.aborted) setStatus("idle");
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [handle]);

  return status;
}
