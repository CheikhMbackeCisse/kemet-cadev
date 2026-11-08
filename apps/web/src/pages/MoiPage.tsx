import {
  BookOpen,
  Bookmark,
  ChevronRight,
  Flag as FlagIcon,
  FolderGit2,
  LogOut,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicProfileResponse } from "@kemet/shared";
import { RailPage } from "../components/layout/RailPage.js";
import { Avatar } from "../components/ui/Avatar.js";
import { UserName } from "../components/ui/UserName.js";
import { getUserProfile } from "../lib/chat/api.js";
import { formatCount } from "../lib/formatCount.js";
import { useSession } from "../session/SessionProvider.js";
import { SIGN_UP_PATH } from "../session/signUpInvite.js";
import { fr } from "../i18n/fr.js";

interface MoiRow {
  label: string;
  href: string;
  icon: LucideIcon;
}

function rowsFor(handle: string, isAdmin: boolean): MoiRow[] {
  return [
    { label: fr.moi.myWorks, href: `/u/${handle}`, icon: BookOpen },
    { label: fr.projects.title, href: "/projets", icon: FolderGit2 },
    { label: fr.competitions.title, href: "/competitions", icon: Trophy },
    { label: fr.moi.saved, href: "/enregistres", icon: Bookmark },
    { label: fr.messages.segmentMessages, href: "/messages", icon: MessagesSquare },
    ...(isAdmin ? [{ label: fr.moderation.navLink, href: "/moderation", icon: FlagIcon }] : []),
    { label: fr.settings.title, href: "/parametres", icon: Settings },
    { label: fr.privacy.navLink, href: "/confidentialite", icon: ShieldCheck },
  ];
}

const VISITOR_ROWS: MoiRow[] = [
  { label: fr.projects.title, href: "/projets", icon: FolderGit2 },
  { label: fr.competitions.title, href: "/competitions", icon: Trophy },
  { label: fr.settings.title, href: "/parametres", icon: Settings },
  { label: fr.privacy.navLink, href: "/confidentialite", icon: ShieldCheck },
];

/**
 * Onglet "Moi" : le compte en haut, puis tout ce qui n'a pas de place dans
 * la barre du bas. Sur téléphone, la page monte depuis le bas.
 */
export function MoiPage() {
  const { status, profile, points, isPlatformAdmin, signOut } = useSession();
  const [publicProfile, setPublicProfile] = useState<PublicProfileResponse | null>(null);

  useEffect(() => {
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  useEffect(() => {
    if (!profile) return;
    getUserProfile(profile.handle)
      .then(setPublicProfile)
      .catch(() => setPublicProfile(null));
  }, [profile]);

  if (status === "loading" || status === "incomplete") return null;

  const rows = profile ? rowsFor(profile.handle, isPlatformAdmin) : VISITOR_ROWS;

  return (
    <RailPage activeSection="moi" className="moi-sheet gap-6 px-0 pb-8 pt-0 lg:px-4 lg:pt-8">
      {profile ? (
        <header className="flex flex-col">
          <div aria-hidden="true" className="h-24 bg-accent-soft lg:rounded-card" />
          <div className="-mt-6 flex flex-col gap-3 px-4">
            <span className="w-fit rounded-full border-4 border-bg">
              <Avatar
                name={profile.displayName}
                src={profile.avatarUrl ?? undefined}
                size={40}
                countryCode={profile.country || undefined}
              />
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-bold text-text">
                <UserName name={profile.displayName} level={profile.level} />
              </h1>
              <p className="text-sm text-text-2">@{profile.handle}</p>
            </div>
            <dl className="flex gap-6">
              <Stat label={fr.moi.points} value={points} />
              {publicProfile && <Stat label={fr.moi.followers} value={publicProfile.followerCount} />}
              {publicProfile && <Stat label={fr.moi.following} value={publicProfile.followingCount} />}
            </dl>
            <a
              href="/parametres/profil"
              className="inline-flex h-control-mobile items-center justify-center rounded-control bg-surface-2 px-4 text-sm font-medium text-text hover:bg-border md:h-control md:w-fit"
            >
              {fr.moi.editProfile}
            </a>
          </div>
        </header>
      ) : (
        <header className="flex flex-col gap-3 px-4 pt-6">
          <h1 className="text-lg font-bold text-text">{fr.moi.visitorTitle}</h1>
          <p className="text-base text-text-2">{fr.moi.visitorText}</p>
          <a
            href={SIGN_UP_PATH}
            className="inline-flex h-control-mobile items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover md:h-control md:w-fit"
          >
            {fr.auth.visitorBarSignup}
          </a>
        </header>
      )}

      <nav aria-label={fr.moi.title} className="px-4 lg:px-0">
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card bg-surface">
          {rows.map((row) => (
            <li key={row.href}>
              <a href={row.href} className="flex min-h-control-mobile items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <row.icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
                <span className="flex-1 text-base text-text">{row.label}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {profile && (
        <div className="px-4 lg:px-0">
          <button
            type="button"
            onClick={() => void signOut().then(() => (window.location.href = "/fil"))}
            className="flex min-h-control-mobile w-full items-center gap-3 rounded-card bg-surface px-4 py-3 text-base font-medium text-danger hover:bg-surface-2"
          >
            <LogOut className="size-5" aria-hidden="true" />
            {fr.auth.signOut}
          </button>
        </div>
      )}
    </RailPage>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="text-md font-semibold text-text tabular-nums">{formatCount(value)}</dd>
    </div>
  );
}
