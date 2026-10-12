import { fr } from "../../i18n/fr.js";

export function SuspendedBanner() {
  return (
    <div className="flex items-center gap-3 rounded-card border border-danger-soft bg-danger-soft p-4">
      <p className="text-sm text-danger">{fr.moderation.suspendedBanner}</p>
    </div>
  );
}
