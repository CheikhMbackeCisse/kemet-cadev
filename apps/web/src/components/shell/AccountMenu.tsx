import { navigate } from "../../lib/navigation/navigate.js";
import { LogIn } from "lucide-react";
import { useSession } from "../../session/SessionProvider.js";
import { Avatar } from "../ui/Avatar.js";
import { Button } from "../ui/Button.js";
import { Menu } from "../ui/Menu.js";
import { Tooltip } from "../ui/Tooltip.js";
import { fr } from "../../i18n/fr.js";

/**
 * Compte de la personne, au pied de la barre d'activité sur bureau. Sous lg,
 * l'onglet "Moi" et la barre visiteur jouent ce rôle.
 */
export function AccountMenu() {
  const { status, profile, isPlatformAdmin, signOut } = useSession();

  if (status === "loading") return null;

  if (status !== "ready" || !profile) {
    return (
      <Tooltip label={fr.auth.signInCta} side="right">
        <a
          href="/connexion"
          aria-label={fr.auth.signInCta}
          className="inline-flex size-control items-center justify-center rounded-control text-link hover:bg-surface-2"
        >
          <LogIn className="size-5" aria-hidden="true" />
        </a>
      </Tooltip>
    );
  }

  return (
    <Menu
      side="right"
      trigger={
        <Button
          variant="ghost"
          aria-label={fr.auth.accountMenuLabel(profile.displayName)}
          className="size-control px-0"
        >
          <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={24} />
        </Button>
      }
      items={[
        { value: "profile", label: fr.moi.myProfile },
        { value: "saved", label: fr.moi.saved },
        ...(isPlatformAdmin ? [{ value: "moderation", label: fr.moderation.navLink }] : []),
        { value: "sign-out", label: fr.auth.signOut, danger: true },
      ]}
      onSelect={(value) => {
        if (value === "profile") navigate(`/u/${profile.handle}`);
        if (value === "saved") navigate("/enregistres");
        if (value === "moderation") navigate("/moderation");
        if (value === "sign-out") void signOut();
      }}
    />
  );
}
