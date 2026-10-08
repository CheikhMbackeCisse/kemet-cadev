import { useEffect, useState } from "react";
import { checkService, SERVICE_CHECKS, type ServiceStatus } from "./serviceStatus.js";

const STATUS_LABELS: Record<ServiceStatus, string> = {
  verification: "vérification…",
  ok: "en ligne",
  indisponible: "indisponible",
};

export function App() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>(
    () => Object.fromEntries(SERVICE_CHECKS.map((service) => [service.name, "verification"])),
  );

  useEffect(() => {
    for (const service of SERVICE_CHECKS) {
      checkService(service.path).then((status) => {
        setStatuses((current) => ({ ...current, [service.name]: status }));
      });
    }
  }, []);

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6">
      <p className="text-lg">Kemet arrive.</p>
      <ul className="flex flex-col gap-2 text-sm" aria-live="polite">
        {SERVICE_CHECKS.map((service) => (
          <li key={service.name} className="flex items-center gap-2">
            <span className="w-20 font-medium">{service.name}</span>
            <span>{STATUS_LABELS[statuses[service.name] ?? "verification"]}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-neutral-500">
          <span className="w-20 font-medium">worker</span>
          <span>vérifié par Docker uniquement</span>
        </li>
      </ul>
    </main>
  );
}
