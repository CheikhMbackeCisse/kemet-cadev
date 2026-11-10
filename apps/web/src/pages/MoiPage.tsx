import { navigate } from "../lib/navigation/navigate.js";
import {
  BookOpen,
  Bookmark,
  ChevronRight,
  Flag as FlagIcon,
  LogOut,
  MessagesSquare,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RailPage } from "../components/layout/RailPage.js";
import { LevelProgressBar } from "../components/profile/LevelProgressBar.js";
import { ProfileHeader } from "../components/profile/ProfileHeader.js";
import {
  PROFILE_ACTION_CLASS,
  PROFILE_ACTIONS_ROW_CLASS,
} from "../components/profile/profileActionClass.js";
import { DemoNoticeLine } from "../components/shell/DemoNotice.js";
import { MOI_ITEMS } from "../components/shell/mobileTabs.js";
import { Card } from "../components/ui/Card.js";
import { KemetSymbol } from "../components/ui/KemetSymbol.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { useToast } from "../components/ui/Toast.js";
import { getUserProfile } from "../lib/chat/api.js";
import { shareLink } from "../lib/shareLink.js";
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
  const countsQuery = useQuery({
    queryKey: ["user", profile?.handle],
    queryFn: () => getUserProfile(profile?.handle ?? ""),
    enabled: profile !== null,
  });
  const publicProfile = countsQuery.data ?? null;
  const profileError = countsQuery.isError && !countsQuery.data;

  useEffect(() => {
    if (status === "incomplete") navigate("/completer-profil");
  }, [status]);

  function handleSignOut() {
    signOut()
      .then(() => (window.location.href = "/fil"))
      .catch(() => toast.show(fr.auth.signOutError, "danger"));
  }

  async function handleShare() {
    if (!profile) return;
    const outcome = await shareLink(
      `${window.location.origin}/u/${profile.handle}`,
      fr.profile.shareTitle(profile.displayName),
    );
    if (outcome === "copied") toast.show(fr.profile.linkCopied, "success");
    if (outcome === "failed") toast.show(fr.profile.shareFailed, "danger");
  }

  if (status === "incomplete") return null;
  const rows = profile ? rowsFor(profile.handle, isPlatformAdmin) : MOI_ITEMS;

  return (
    <RailPage activeSection="moi" className="gap-6 px-0 pt-3 lg:px-4 lg:pt-6">
      <div className="px-4 lg:px-0">
        {status === "loading" ? (
          <MoiHeaderSkeleton />
        ) : profile ? (
          <ProfileHeader
            profile={profile}
            stats={[
              { label: fr.profile.statPoints, value: points, exact: true },
              { label: fr.profile.statWorks, value: publicProfile?.workCount ?? null },
              { label: fr.profile.statFollowers, value: publicProfile?.followerCount ?? null },
            ]}
            belowStats={
              <>
                <LevelProgressBar points={points} />
                {profileError && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-text-2" role="alert">
                    {fr.moi.loadError}
                    <button
                      type="button"
                      onClick={() => void countsQuery.refetch()}
                      className="font-medium text-link hover:underline"
                    >
                      {fr.chat.retry}
                    </button>
                  </p>
                )}
              </>
            }
            clampBio
            actions={
              <div className={PROFILE_ACTIONS_ROW_CLASS}>
                <a href="/parametres/profil" className={PROFILE_ACTION_CLASS}>
                  {fr.profile.editProfile}
                </a>
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className={PROFILE_ACTION_CLASS}
                >
                  <Share2 className="size-4 shrink-0" aria-hidden="true" />
                  {fr.profile.share}
                </button>
              </div>
            }
          />
        ) : (
          <VisitorCard />
        )}
      </div>

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

function VisitorCard() {
  return (
    <Card variant="plain" className="flex flex-col items-center gap-4 py-6">
      <h1 className="sr-only">{fr.moi.title}</h1>
      <KemetSymbol className="size-12" />
      <div className="grid w-full max-w-sm grid-cols-2 gap-2">
        <a
          href={SIGN_UP_PATH}
          className="inline-flex h-control max-md:h-control-mobile items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {fr.auth.visitorBarSignup}
        </a>
        <a href="/connexion" className={PROFILE_ACTION_CLASS}>
          {fr.auth.loginLink}
        </a>
      </div>
    </Card>
  );
}

function MoiHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-24 w-full rounded-card" />
      <div className="-mt-11 flex items-end gap-3 pl-3">
        <Skeleton className="size-[96px] rounded-full ring-4 ring-bg" />
      </div>
      <Skeleton className="h-1 w-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-control" />
        <Skeleton className="h-control" />
      </div>
    </div>
  );
}
