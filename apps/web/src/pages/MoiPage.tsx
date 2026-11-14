import { navigate } from "../lib/navigation/navigate.js";
import { Menu, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RailPage } from "../components/layout/RailPage.js";
import { LevelProgressBar } from "../components/profile/LevelProgressBar.js";
import { MoiMenu } from "../components/profile/MoiMenu.js";
import { ProfileHeader } from "../components/profile/ProfileHeader.js";
import { AvatarChangeButton } from "../components/profile/AvatarChangeButton.js";
import { ProfileTabs } from "../components/profile/ProfileTabs.js";
import {
  PROFILE_ACTION_CLASS,
  PROFILE_ACTIONS_ROW_CLASS,
} from "../components/profile/profileActionClass.js";
import { Card } from "../components/ui/Card.js";
import { HeaderWordmark } from "../components/ui/HeaderWordmark.js";
import { IconButton } from "../components/ui/IconButton.js";
import { KemetSymbol } from "../components/ui/KemetSymbol.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { useToast } from "../components/ui/Toast.js";
import { WorkInvitations } from "../components/works/ProfileWorks.js";
import { getUserProfile } from "../lib/chat/api.js";
import { profileSubtitle } from "../lib/profileIdentity.js";
import { shareLink } from "../lib/shareLink.js";
import { useSession } from "../session/SessionProvider.js";
import { SIGN_UP_PATH } from "../session/signUpInvite.js";
import { fr } from "../i18n/fr.js";

/**
 * Onglet "Moi" : son propre profil, comme le voient les autres, avec ses
 * onglets. Tout ce qui n'a pas de place dans la barre du bas vit dans le
 * menu ouvert par l'icône en haut à droite.
 */
export function MoiPage() {
  const { status, profile, points, isSuspended } = useSession();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [worksReloadKey, setWorksReloadKey] = useState(0);
  const publicQuery = useQuery({
    queryKey: ["user", profile?.handle],
    queryFn: () => getUserProfile(profile?.handle ?? ""),
    enabled: profile !== null,
  });
  const publicProfile = publicQuery.data ?? null;
  const profileError = publicQuery.isError && !publicQuery.data;

  useEffect(() => {
    if (status === "incomplete") navigate("/completer-profil");
  }, [status]);

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

  return (
    <RailPage activeSection="moi" className="gap-4 pt-1 lg:pt-6" tabSwipe>
      <div className="-mb-2 flex items-start justify-between lg:mb-0 lg:justify-end">
        {/* Même place que le mot-symbole du Fil, dont l'en-tête commence 8 px
            plus bas (pt-3 contre pt-1) : il ne bouge pas d'une page à l'autre. */}
        <HeaderWordmark className="mt-2 lg:hidden" />
        <IconButton aria-label={fr.moi.menu} onClick={() => setMenuOpen(true)} className="-mr-2">
          <Menu className="size-6" aria-hidden="true" />
        </IconButton>
      </div>

      {status === "loading" ? (
        <MoiHeaderSkeleton />
      ) : profile ? (
        <>
          <ProfileHeader
            profile={profile}
            subtitle={profileSubtitle(profile)}
            // Après un échec, les deux chiffres lus sur le profil public
            // disparaissent au lieu de rester en squelette à côté de l'erreur.
            stats={[
              { label: fr.profile.statPoints, value: points, exact: true },
              ...(profileError
                ? []
                : [
                    {
                      label: fr.profile.statWorks(publicProfile?.workCount ?? null),
                      value: publicProfile?.workCount ?? null,
                      onClick: () => navigate("/moi/travaux"),
                    },
                    {
                      label: fr.profile.statFollowers(publicProfile?.followerCount ?? null),
                      value: publicProfile?.followerCount ?? null,
                    },
                  ]),
            ]}
            belowStats={<LevelProgressBar points={points} />}
            clampBio
            addNameHref="/parametres/profil"
            avatarAction={
              <AvatarChangeButton
                variant="badge"
                hasPhoto={Boolean(profile.avatarUrl)}
                disabled={isSuspended}
              />
            }
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
          <WorkInvitations onDecided={() => setWorksReloadKey((key) => key + 1)} />
          {profileError ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-text-2" role="alert">
              {fr.moi.loadError}
              <button
                type="button"
                onClick={() => void publicQuery.refetch()}
                className="inline-flex h-control items-center font-medium text-link hover:underline max-md:h-control-mobile"
              >
                {fr.chat.retry}
              </button>
            </p>
          ) : !publicProfile ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ProfileTabs
              profile={publicProfile.profile}
              workCount={publicProfile.workCount}
              credentials={publicProfile.credentials}
              isOwnProfile
              worksReloadKey={worksReloadKey}
            />
          )}
        </>
      ) : (
        <VisitorCard />
      )}

      <MoiMenu open={menuOpen} onOpenChange={setMenuOpen} />
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
          className="inline-flex h-control max-md:h-control-mobile items-center justify-center rounded-control bg-action-strong px-4 text-sm font-medium text-on-action-strong hover:bg-action-strong-hover"
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
