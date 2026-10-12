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
        className="inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
      >
        {fr.auth.signInCta}
      </a>
    );
  }

  return (
    <Menu
      trigger={
        <Button variant="ghost" className="gap-2 px-2">
          <Avatar name={profile.displayName} size={24} />
          <span title={profile.displayName} className="max-w-24 truncate text-sm font-medium text-text">
            {profile.displayName}
          </span>
        </Button>
      }
      items={[
        ...(isPlatformAdmin ? [{ value: "moderation", label: fr.moderation.navLink }] : []),
        { value: "sign-out", label: fr.auth.signOut, danger: true },
      ]}
      onSelect={(value) => {
        if (value === "moderation") window.location.href = "/moderation";
        if (value === "sign-out") void signOut();
      }}
    />
  );
}
