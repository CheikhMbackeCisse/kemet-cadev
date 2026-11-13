import { Avatar } from "../ui/Avatar.js";
import { fr } from "../../i18n/fr.js";

/**
 * La carte de profil qui se construit pendant qu'on tape son nom : initiales,
 * nom, ligne de profil choisie aux questions, identifiant. Rien tant que le
 * nom est vide.
 */
export function ProfilePreviewCard({
  name,
  handle,
  identity,
}: {
  name: string;
  handle: string;
  identity: string | null;
}) {
  const shownName = name.trim();
  if (!shownName) return null;
  return (
    <figure
      aria-label={fr.auth.profilePreviewLabel}
      className="profile-preview-card flex items-center gap-3 rounded-card border border-auth-glass-border bg-white/10 p-3"
    >
      <Avatar name={shownName} size={40} />
      <figcaption className="flex min-w-0 flex-col">
        <span className="truncate text-base font-semibold text-auth-text">{shownName}</span>
        {identity && <span className="truncate text-sm text-auth-text-muted">{identity}</span>}
        {handle && <span className="truncate text-xs text-auth-text-muted">@{handle}</span>}
      </figcaption>
    </figure>
  );
}
