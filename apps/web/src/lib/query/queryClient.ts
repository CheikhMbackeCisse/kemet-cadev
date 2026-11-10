import { QueryClient } from "@tanstack/react-query";
import { ChatApiError } from "../chat/api.js";

// Une page revisitée dans la minute s'affiche depuis le cache sans aucune
// requête ; au-delà, elle s'affiche quand même depuis le cache et se met à
// jour en arrière-plan.
const FRESH_FOR_MS = 60_000;
const KEPT_FOR_MS = 15 * 60_000;
const MAX_RETRIES = 2;

/** Une erreur 4xx ne changera pas en réessayant : seules les pannes réseau et 5xx sont retentées. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ChatApiError && error.statusCode < 500) return false;
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FRESH_FOR_MS,
        gcTime: KEPT_FOR_MS,
        retry: shouldRetry,
        // Sur une connexion lente, revenir sur l'onglet ne doit pas relancer
        // toutes les lectures de la page affichée.
        refetchOnWindowFocus: false,
      },
    },
  });
}
