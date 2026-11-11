import type { Credential, CredentialType } from "@kemet/shared";
import { Badge } from "../ui/Badge.js";
import { fr } from "../../i18n/fr.js";

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  job: fr.profile.credentialTypeJob,
  education: fr.profile.credentialTypeEducation,
  internship: fr.profile.credentialTypeInternship,
};

function formatCredentialDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { year: "numeric", month: "short" });
}

function formatCredentialRange(startDate: string, endDate: string | null): string {
  const start = formatCredentialDate(startDate);
  return endDate ? `De ${start} à ${formatCredentialDate(endDate)}` : `Depuis ${start}`;
}

/** Onglet "Parcours" d'un profil : postes, formations et stages déclarés. */
export function CredentialsList({ credentials }: { credentials: Credential[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {credentials.map((credential) => (
        <li key={credential.id} className="py-3 first:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{CREDENTIAL_TYPE_LABELS[credential.type]}</Badge>
            <span className="text-sm font-medium text-text">{credential.title}</span>
            <Badge tone={credential.status === "verified" ? "success" : "neutral"}>
              {credential.status === "verified"
                ? fr.profile.credentialVerified
                : fr.profile.credentialDeclared}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-2">{credential.organization}</p>
          <p className="mt-0.5 text-xs text-subtle">
            {formatCredentialRange(credential.startDate, credential.endDate)}
          </p>
        </li>
      ))}
    </ul>
  );
}
