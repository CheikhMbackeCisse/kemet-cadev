import { navigate } from "../lib/navigation/navigate.js";
import { ArrowLeft, HeartHandshake, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  isLevelAtLeast,
  OPEN_TO_OPPORTUNITIES_MIN_LEVEL,
  type ProfileSummary,
  type PublicProfileResponse,
} from "@kemet/shared";
import {
  blockUser,
  ChatApiError,
  followUser,
  getBlockStatus,
  getUserProfile,
  openConversation,
  unblockUser,
  listUserFollowers,
  listUserFollowing,
  unfollowUser,
} from "../lib/chat/api.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { WorkInvitations } from "../components/works/ProfileWorks.js";
import { ProfileTabs } from "../components/profile/ProfileTabs.js";
import { MoreActionsMenu } from "../components/ui/MoreActionsMenu.js";
import { profileSubtitle } from "../lib/profileIdentity.js";
import { useSession } from "../session/SessionProvider.js";
import { shareLink } from "../lib/shareLink.js";
import { ProfileHeader } from "../components/profile/ProfileHeader.js";
import { AvatarChangeButton } from "../components/profile/AvatarChangeButton.js";
import { OrganizationHeader } from "../components/organizations/OrganizationHeader.js";
import { OrganizationTabs } from "../components/organizations/OrganizationTabs.js";
import { SIGN_UP_PATH } from "../session/signUpInvite.js";
import {
  PROFILE_ACTION_CLASS,
  PROFILE_ACTIONS_ROW_CLASS,
} from "../components/profile/profileActionClass.js";
import { fr } from "../i18n/fr.js";
import { LOCALE } from "../i18n/language.js";

// "Autre" ne dit rien sur un profil : la spécialité suffit.

function readHandle(pathname: string): string {
  return pathname.replace(/^\/u\//, "");
}

type FollowListKind = "followers" | "following";

const PROFILE_SKELETON = (
  <div className="flex items-start gap-3">
    <Skeleton className="size-10 shrink-0 rounded-full" />
    <div className="flex flex-1 flex-col gap-2 pt-1">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-56" />
    </div>
  </div>
);

export function UserPage() {
  const toast = useToast();
  // Lu une seule fois : pendant un retour, la page reste affichée alors que
  // l'adresse a déjà changé.
  const [handle] = useState(() => readHandle(window.location.pathname));
  const { profile: viewerProfile, isSuspended } = useSession();
  // `null` tant que le statut n'est pas connu : "Écrire" attend de le savoir.
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);

  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [worksReloadKey, setWorksReloadKey] = useState(0);

  const [followList, setFollowList] = useState<FollowListKind | null>(null);
  const [followListItems, setFollowListItems] = useState<ProfileSummary[]>([]);
  const [followListCursor, setFollowListCursor] = useState<string | null>(null);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListHidden, setFollowListHidden] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    getUserProfile(handle)
      .then(setData)
      .catch((err) => {
        if (err instanceof ChatApiError && err.statusCode === 404) setNotFound(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, [handle]);

  useEffect(() => load(), [load]);

  const canMessage = viewerProfile !== null && viewerProfile.handle !== handle;
  useEffect(() => {
    if (!canMessage) return;
    getBlockStatus(handle)
      .then((status) => setBlocked(status.blocked))
      .catch(() => {});
  }, [canMessage, handle]);

  async function handleWrite() {
    setMessageBusy(true);
    try {
      const { conversation } = await openConversation([handle]);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      toast.show(
        err instanceof ChatApiError && err.statusCode === 403
          ? err.message
          : fr.messages.writeError,
        "danger",
      );
      setMessageBusy(false);
    }
  }

  async function handleShare() {
    const outcome = await shareLink(
      `${window.location.origin}/u/${handle}`,
      fr.profile.shareTitle(data?.profile.displayName ?? handle),
    );
    if (outcome === "copied") toast.show(fr.profile.linkCopied, "success");
    if (outcome === "failed") toast.show(fr.profile.shareFailed, "danger");
  }

  async function handleToggleBlock() {
    setBlockBusy(true);
    try {
      if (blocked) {
        await unblockUser(handle);
        setBlocked(false);
        toast.show(fr.messages.unblocked(handle), "success");
      } else {
        await blockUser(handle);
        setBlocked(true);
        toast.show(fr.messages.blocked(handle), "success");
      }
    } catch {
      toast.show(blocked ? fr.messages.unblockError : fr.messages.blockError, "danger");
    } finally {
      setBlockBusy(false);
      setBlockConfirmOpen(false);
    }
  }

  async function handleToggleFollow() {
    if (!data) return;
    setFollowBusy(true);
    try {
      if (data.isFollowedByViewer) {
        await unfollowUser(handle);
        setData({ ...data, isFollowedByViewer: false, followerCount: data.followerCount - 1 });
      } else {
        await followUser(handle);
        setData({ ...data, isFollowedByViewer: true, followerCount: data.followerCount + 1 });
      }
    } catch {
      toast.show(fr.profile.loadingError, "danger");
    } finally {
      setFollowBusy(false);
    }
  }

  function openFollowList(kind: FollowListKind) {
    setFollowList(kind);
    setFollowListItems([]);
    setFollowListCursor(null);
    setFollowListHidden(0);
    setFollowListLoading(true);
    const loader = kind === "followers" ? listUserFollowers : listUserFollowing;
    loader(handle)
      .then((page) => {
        setFollowListItems(page.items);
        setFollowListCursor(page.nextCursor);
        setFollowListHidden(page.hiddenCount);
      })
      .catch(() => toast.show(fr.profile.loadingError, "danger"))
      .finally(() => setFollowListLoading(false));
  }

  async function loadMoreFollowList() {
    if (!followList || !followListCursor) return;
    setFollowListLoading(true);
    const loader = followList === "followers" ? listUserFollowers : listUserFollowing;
    try {
      const page = await loader(handle, followListCursor);
      setFollowListItems((current) => [...current, ...page.items]);
      setFollowListCursor(page.nextCursor);
    } finally {
      setFollowListLoading(false);
    }
  }

  const header = (
    <div className="flex items-center justify-between">
      <a href="/fil" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {fr.profile.back}
      </a>
    </div>
  );

  if (loading || notFound || error || !data) {
    return (
      <ReadingPage
        activeMobileTab="moi"
        header={header}
        state={
          loading
            ? { kind: "loading" }
            : notFound
              ? {
                  kind: "notFound",
                  message: fr.profile.notFound,
                  retry: { label: fr.profile.back, onClick: () => navigate("/fil") },
                }
              : {
                  kind: "error",
                  message: fr.profile.loadingError,
                  retry: { label: fr.chat.retry, onClick: load },
                }
        }
        loadingSkeleton={PROFILE_SKELETON}
      />
    );
  }

  const {
    profile,
    credentials,
    followerCount,
    followingCount,
    isFollowedByViewer,
    acceptsMessages,
  } = data;
  const isOwnProfile = viewerProfile?.handle === profile.handle;

  const followDialog = (
    <Dialog
      open={followList !== null}
      onOpenChange={(open) => !open && setFollowList(null)}
      title={followList === "followers" ? fr.profile.followersTitle : fr.profile.followingTitle}
    >
      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
        {followListItems.length === 0 && followListHidden === 0 && !followListLoading ? (
          <p className="text-sm text-subtle">
            {followList === "followers" ? fr.profile.emptyFollowers : fr.profile.emptyFollowing}
          </p>
        ) : (
          followListItems.map((item) => (
            <a
              key={item.id}
              href={`/u/${item.handle}`}
              className="flex items-center gap-2 rounded-control p-1 hover:bg-surface-2"
            >
              <Avatar
                name={item.displayName}
                src={item.avatarUrl ?? undefined}
                size={32}
                countryCode={item.country}
                square={item.kind === "organization"}
              />
              <UserName name={item.displayName} organization={item.kind === "organization"} />
            </a>
          ))
        )}
        {followListLoading && <Skeleton className="h-10 w-full" />}
        {!followListCursor && !followListLoading && followListHidden > 0 && (
          <p className="px-1 text-sm text-text-2">
            {fr.profile.hiddenFollows(
              new Intl.NumberFormat(LOCALE).format(followListHidden),
              followListItems.length > 0,
            )}
          </p>
        )}
        {followListCursor && !followListLoading && (
          <Button variant="secondary" className="self-center text-xs" onClick={loadMoreFollowList}>
            {fr.profile.loadMore}
          </Button>
        )}
      </div>
    </Dialog>
  );

  if (profile.kind === "organization") {
    return (
      <ReadingPage header={header} activeMobileTab="">
        <OrganizationHeader
          profile={profile}
          stats={[
            {
              label: fr.profile.statFollowers(followerCount),
              value: followerCount,
              onClick: () => openFollowList("followers"),
            },
            {
              label: fr.organizations.statOpportunities(data.opportunityCount),
              value: data.opportunityCount,
            },
          ]}
          actions={
            <div className={PROFILE_ACTIONS_ROW_CLASS}>
              {viewerProfile ? (
                <Button
                  variant={isFollowedByViewer ? "secondary" : "primary"}
                  onClick={handleToggleFollow}
                  disabled={followBusy}
                >
                  {isFollowedByViewer ? fr.organizations.unfollow : fr.organizations.follow}
                </Button>
              ) : (
                <a
                  href={SIGN_UP_PATH}
                  className="inline-flex h-control items-center justify-center rounded-control bg-action-strong px-4 text-sm font-medium text-on-action-strong hover:bg-action-strong-hover max-md:h-control-mobile"
                >
                  {fr.organizations.follow}
                </a>
              )}
              <button
                type="button"
                onClick={() => void handleShare()}
                className={PROFILE_ACTION_CLASS}
              >
                <Share2 className="size-4 shrink-0" aria-hidden="true" />
                {fr.organizations.share}
              </button>
            </div>
          }
        />
        <OrganizationTabs handle={profile.handle} />
        {followDialog}
      </ReadingPage>
    );
  }

  return (
    <ReadingPage
      header={header}
      activeSection={isOwnProfile ? "moi" : undefined}
      activeMobileTab={isOwnProfile ? "moi" : ""}
    >
      <div className="flex flex-col gap-3">
        <ProfileHeader
          profile={profile}
          subtitle={profileSubtitle(profile)}
          addNameHref={isOwnProfile ? "/parametres/profil" : undefined}
          avatarAction={
            isOwnProfile ? (
              <AvatarChangeButton
                variant="badge"
                hasPhoto={Boolean(profile.avatarUrl)}
                disabled={isSuspended}
                onChanged={(avatarUrl) =>
                  setData((current) =>
                    current ? { ...current, profile: { ...current.profile, avatarUrl } } : current,
                  )
                }
              />
            ) : undefined
          }
          stats={[
            { label: fr.profile.statWorks(data.workCount), value: data.workCount },
            {
              label: fr.profile.statFollowers(followerCount),
              value: followerCount,
              onClick: () => openFollowList("followers"),
            },
            {
              label: fr.profile.statFollowing(followingCount),
              value: followingCount,
              onClick: () => openFollowList("following"),
            },
          ]}
          actions={
            isOwnProfile ? (
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
            ) : (
              viewerProfile && (
                <div className="flex items-center gap-2 md:w-[26rem]">
                  <Button
                    variant={isFollowedByViewer ? "secondary" : "primary"}
                    onClick={handleToggleFollow}
                    disabled={followBusy}
                    className="flex-1"
                  >
                    {isFollowedByViewer ? fr.profile.unfollow : fr.profile.follow}
                  </Button>
                  {blocked === false && !isSuspended && acceptsMessages && (
                    <Button
                      variant="secondary"
                      onClick={handleWrite}
                      loading={messageBusy}
                      className="flex-1"
                    >
                      {fr.messages.write}
                    </Button>
                  )}
                  <MoreActionsMenu
                    label={fr.messages.profileActions(profile.displayName)}
                    items={[
                      blocked
                        ? { value: "unblock", label: fr.messages.unblock(profile.handle) }
                        : {
                            value: "block",
                            label: fr.messages.block(profile.handle),
                            danger: true,
                          },
                    ]}
                    onSelect={(value) =>
                      value === "unblock" ? void handleToggleBlock() : setBlockConfirmOpen(true)
                    }
                  />
                </div>
              )
            )
          }
        />

        {blocked && (
          <p className="text-sm text-text-2">{fr.messages.blockedNote(profile.handle)}</p>
        )}

        {profile.stack.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-md font-semibold text-text">{fr.profile.stackTitle}</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.stack.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          </div>
        )}

        {((profile.openToOpportunities &&
          profile.level &&
          isLevelAtLeast(profile.level, OPEN_TO_OPPORTUNITIES_MIN_LEVEL)) ||
          profile.helpsBeginners) && (
          <div className="flex flex-wrap items-center gap-2">
            {profile.openToOpportunities &&
              profile.level &&
              isLevelAtLeast(profile.level, OPEN_TO_OPPORTUNITIES_MIN_LEVEL) && (
                <Badge tone="success">{fr.profile.openToOpportunities}</Badge>
              )}
            {profile.helpsBeginners && (
              <Badge tone="accent">
                <HeartHandshake className="size-3.5" aria-hidden="true" />
                {fr.profile.helpsBeginners}
              </Badge>
            )}
          </div>
        )}
      </div>

      {isOwnProfile && <WorkInvitations onDecided={() => setWorksReloadKey((key) => key + 1)} />}

      <ProfileTabs
        profile={profile}
        workCount={data.workCount}
        credentials={credentials}
        isOwnProfile={isOwnProfile}
        worksReloadKey={worksReloadKey}
      />

      {followDialog}
      <Dialog
        open={blockConfirmOpen}
        onOpenChange={setBlockConfirmOpen}
        title={fr.messages.blockTitle(profile.handle)}
        description={fr.messages.blockDescription}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBlockConfirmOpen(false)}>
            {fr.common.cancel}
          </Button>
          <Button variant="danger" loading={blockBusy} onClick={() => void handleToggleBlock()}>
            {fr.messages.blockConfirm}
          </Button>
        </div>
      </Dialog>
    </ReadingPage>
  );
}
