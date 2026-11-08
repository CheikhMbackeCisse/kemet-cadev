import { navigate } from "../lib/navigation/navigate.js";
import {
  BookOpen,
  Bookmark,
  ChevronRight,
  Flag as FlagIcon,
  LogOut,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PublicProfileResponse } from "@kemet/shared";
import { RailPage } from "../components/layout/RailPage.js";
import { DemoNoticeLine } from "../components/shell/DemoNotice.js";
import { MOI_ITEMS } from "../components/shell/mobileTabs.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { useToast } from "../components/ui/Toast.js";
import { LevelBadge } from "../components/ui/LevelBadge.js";
import { getUserProfile } from "../lib/chat/api.js";
import { formatCount } from "../lib/formatCount.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

interface MoiRow {
  label: string;
  href: string;
  icon: LucideIcon;
}

function rowsFor(handle: string, isAdmin: boolean): MoiRow[] {
  return [
    { label: fr.moi.myWorks, href: `/u/${handle}`, icon: BookOpen },
    { label: fr.moi.saved, href: "/enregistres", icon: Bookmark },
    { label: fr.messages.segmentMessages, href: "/messages", icon: MessagesSquare },
    ...MOI_ITEMS,
    ...(isAdmin ? [{ label: fr.moderation.navLink, href: "/moderation", icon: FlagIcon }] : []),
  ];
}

const ROW_CLASS =
  "flex min-h-control-mobile w-full items-center gap-3 px-4 py-3 text-base lg:hover:bg-surface-2";

/** Onglet "Moi" : le compte en haut, puis tout ce qui n'a pas de place dans la barre du bas. */
export function MoiPage() {
  const { status, profile, points, isPlatformAdmin, signOut } = useSession();
  const toast = useToast();
  const [publicProfile, setPublicProfile] = useState<PublicProfileResponse | null>(null);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    if (status === "incomplete") navigate("/completer-profil");
  }, [status]);

  const loadCounts = useCallback(() => {
    if (!profile) return;
    setProfileError(false);
    getUserProfile(profile.handle)
      .then(setPublicProfile)
      .catch(() => setProfileError(true));
  }, [profile]);

  useEffect(loadCounts, [loadCounts]);

  function handleSignOut() {
    signOut()
      .then(() => (window.location.href = "/fil"))
      .catch(() => toast.show(fr.auth.signOutError, "danger"));
  }

  if (status === "incomplete") return null;
  const rows = profile ? rowsFor(profile.handle, isPlatformAdmin) : MOI_ITEMS;

  return (
    <RailPage activeSection="moi" className="gap-6 px-0 pt-3 lg:px-4 lg:pt-6">
      {status === "loading" ? (
        <MoiHeaderSkeleton />
      ) : profile ? (
        <header className="flex flex-col gap-3 px-4 lg:px-0">
          <Avatar
            name={profile.displayName}
            src={profile.avatarUrl ?? undefined}
            size={40}
            countryCode={profile.country || undefined}
          />
          <div className="flex flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-lg font-bold text-text">{profile.displayName}</h1>
              <LevelBadge level={profile.level} link />
            </div>
            <p className="text-base text-text-2">@{profile.handle}</p>
          </div>
          {profileError ? (
            <p className="flex flex-wrap items-center gap-2 text-base text-text-2" role="alert">
              {fr.moi.loadError}
              <button
                type="button"
                onClick={loadCounts}
                className="font-medium text-link hover:underline"
              >
                {fr.chat.retry}
              </button>
            </p>
          ) : publicProfile ? (
            <p className="text-base text-text-2">
              {fr.moi.counts(
                formatCount(points),
                formatCount(publicProfile.followerCount),
                formatCount(publicProfile.followingCount),
              )}
            </p>
          ) : (
            <Skeleton className="h-4 w-48" />
          )}
          <a
            href="/parametres/profil"
            className="inline-flex h-control-mobile items-center justify-center rounded-control border border-border-strong px-4 text-base font-medium text-text hover:bg-surface-2 md:h-control md:w-fit"
          >
            {fr.moi.editProfile}
          </a>
        </header>
      ) : (
        <header className="flex flex-col gap-1 px-4 lg:px-0">
          <h1 className="text-lg font-bold text-text">{fr.moi.title}</h1>
          <p className="text-base text-text-2">{fr.moi.visitorText}</p>
        </header>
      )}

      <nav aria-label={fr.moi.title}>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <li key={row.href}>
              <a href={row.href} className={ROW_CLASS}>
                <row.icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
                <span className="flex-1 text-text">{row.label}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
              </a>
            </li>
          ))}
          {profile && (
            <li>
              <button
                type="button"
                onClick={handleSignOut}
                className={`${ROW_CLASS} font-medium text-danger`}
              >
                <LogOut className="size-5 shrink-0" aria-hidden="true" />
                {fr.auth.signOut}
              </button>
            </li>
          )}
        </ul>
      </nav>
      <DemoNoticeLine className="px-4 lg:hidden" />
    </RailPage>
  );
}

function MoiHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 lg:px-0" aria-hidden="true">
      <Skeleton className="size-10 rounded-full" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}
