import { LogIn } from "lucide-react";
import { useSession } from "../../session/SessionProvider.js";
import { Avatar } from "../ui/Avatar.js";
import { Button } from "../ui/Button.js";
import { Menu } from "../ui/Menu.js";
import { Tooltip } from "../ui/Tooltip.js";
import { fr } from "../../i18n/fr.js";

export interface AccountMenuProps {
  /**
   * "header" : dans l'en-tête d'une page, sous lg seulement (au-dessus, le
   * compte vit dans la barre d'activité). "activityBar" : au pied de la barre.
   */
  variant?: "header" | "activityBar";
}

export function AccountMenu({ variant = "header" }: AccountMenuProps) {
  const { status, profile, isPlatformAdmin, signOut } = useSession();
  const inActivityBar = variant === "activityBar";

  if (status === "loading") return null;

  if (status !== "ready" || !profile) {
    // Sous lg, la barre visiteur au-dessus des onglets invite déjà à se connecter.
    if (!inActivityBar) return null;
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
      side={inActivityBar ? "right" : "bottom"}
      trigger={
        <Button
          variant="ghost"
          aria-label={fr.auth.accountMenuLabel(profile.displayName)}
          className={inActivityBar ? "size-control px-0" : "px-2 lg:hidden"}
        >
          <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={24} />
        </Button>
      }
      items={[
        { value: "profile", label: fr.moi.myProfile },
        // Sur bureau, Paramètres a déjà son icône dans la barre d'activité.
        ...(inActivityBar ? [] : [{ value: "settings", label: fr.settings.navLink }]),
        ...(isPlatformAdmin ? [{ value: "moderation", label: fr.moderation.navLink }] : []),
        { value: "sign-out", label: fr.auth.signOut, danger: true },
      ]}
      onSelect={(value) => {
        if (value === "profile") window.location.href = `/u/${profile.handle}`;
        if (value === "settings") window.location.href = "/parametres";
        if (value === "moderation") window.location.href = "/moderation";
        if (value === "sign-out") void signOut();
      }}
    />
  );
}
