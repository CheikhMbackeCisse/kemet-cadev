export type ServiceStatus = "verification" | "ok" | "indisponible";

export interface ServiceCheck {
  name: string;
  path: string;
}

/**
 * worker n'a pas de route accessible depuis le navigateur (voir
 * infra/Caddyfile) : son état n'est vérifié que par le healthcheck Docker.
 */
export const SERVICE_CHECKS: ServiceCheck[] = [
  { name: "api", path: "/api/health" },
  { name: "realtime", path: "/realtime/health" },
];

export async function checkService(path: string): Promise<ServiceStatus> {
  try {
    const response = await fetch(path);
    return response.ok ? "ok" : "indisponible";
  } catch {
    return "indisponible";
  }
}
