import { useSession } from "../../session/SessionProvider.js";
import { Avatar } from "../ui/Avatar.js";
import { Button } from "../ui/Button.js";
import { Menu } from "../ui/Menu.js";
import { fr } from "../../i18n/fr.js";

export function AccountMenu() {
  const { status, profile, isPlatformAdmin, signOut } = useSession();

  if (status === "loading") return null;

  if (status !== "ready" || !profile) {
    return (
      <a
        href="/connexion"
        className="inline-flex h-control items-center justify-center gap-2 whitespace-nowrap rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2 max-lg:hidden"
      >
        {fr.auth.signInCta}
      </a>
    );
  }

  return (
    <Menu
      trigger={
        <Button variant="ghost" aria-label={fr.auth.accountMenuLabel(profile.displayName)} className="gap-2 px-2">
          <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={24} />
          <span title={profile.displayName} className="max-w-24 truncate text-sm font-medium text-text max-lg:hidden">
            {profile.displayName}
          </span>
        </Button>
      }
      items={[
        { value: "settings", label: fr.settings.navLink },
        ...(isPlatformAdmin ? [{ value: "moderation", label: fr.moderation.navLink }] : []),
        { value: "sign-out", label: fr.auth.signOut, danger: true },
      ]}
      onSelect={(value) => {
        if (value === "settings") window.location.href = "/parametres";
        if (value === "moderation") window.location.href = "/moderation";
        if (value === "sign-out") void signOut();
      }}
    />
  );
}
