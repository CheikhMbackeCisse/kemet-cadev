export type ServiceStatus = "verification" | "ok" | "indisponible";

export interface ServiceCheck {
  name: string;
  path: string;
}

// worker n'est pas joignable depuis le navigateur : seul le healthcheck Docker le vérifie.
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
