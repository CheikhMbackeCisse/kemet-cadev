import { navigate } from "../lib/navigation/navigate.js";
import { ArrowLeft, HeartHandshake, Settings, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  isLevelAtLeast,
  OPEN_TO_OPPORTUNITIES_MIN_LEVEL,
  type Credential,
  type CredentialType,
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
import { ProfileBanner } from "../components/ui/ProfileBanner.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { LevelBadge } from "../components/ui/LevelBadge.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { Tabs } from "../components/ui/Tabs.js";
import { WorkInvitations } from "../components/works/ProfileWorks.js";
import { ProfileLibrary } from "../components/library/ProfileLibrary.js";
import { MoreActionsMenu } from "../components/ui/MoreActionsMenu.js";
import { useSession } from "../session/SessionProvider.js";
import { formatCount } from "../lib/formatCount.js";
import { fr } from "../i18n/fr.js";

const ROLE_LABELS: Record<string, string> = {
  developer: fr.auth.roleDeveloper,
  designer: fr.auth.roleDesigner,
  hr: fr.auth.roleHr,
  student: fr.auth.roleStudent,
  project_manager: fr.auth.roleProjectManager,
  entrepreneur: fr.auth.roleEntrepreneur,
  other: fr.auth.roleOther,
};

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  job: fr.profile.credentialTypeJob,
  education: fr.profile.credentialTypeEducation,
  internship: fr.profile.credentialTypeInternship,
};

function readHandle(pathname: string): string {
  return pathname.replace(/^\/u\//, "");
}

function formatCredentialDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { year: "numeric", month: "short" });
}

function formatCredentialRange(startDate: string, endDate: string | null): string {
  const start = formatCredentialDate(startDate);
  return endDate ? `De ${start} à ${formatCredentialDate(endDate)}` : `Depuis ${start}`;
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
  const handle = readHandle(window.location.pathname);
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
  // L'onglet vit dans l'adresse : "Parcours" se partage par un lien.
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get("onglet") === "parcours"
      ? "parcours"
      : "bibliotheque",
  );

  function selectTab(value: string) {
    setTab(value);
    const url =
      value === "parcours"
        ? `${window.location.pathname}?onglet=parcours`
        : window.location.pathname;
    window.history.replaceState(null, "", url);
  }

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

  const { profile, credentials, followerCount, followingCount, isFollowedByViewer } = data;
  const isOwnProfile = viewerProfile?.handle === profile.handle;

  const credentialsContent = (
    <div className="flex flex-col gap-3">
      {credentials.length === 0 ? (
        <p className="text-sm text-subtle">{fr.profile.noCredentials}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {credentials.map((credential: Credential) => (
            <li key={credential.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{CREDENTIAL_TYPE_LABELS[credential.type]}</Badge>
                <span className="text-sm font-medium text-text">{credential.title}</span>
                <Badge tone={credential.status === "verified" ? "success" : "neutral"}>
                  {credential.status === "verified"
                    ? fr.profile.credentialVerified
                    : fr.profile.credentialDeclared}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-text-2">{credential.organization}</p>
              <p className="mt-0.5 text-xs text-subtle">
                {formatCredentialRange(credential.startDate, credential.endDate)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <ReadingPage header={header} activeMobileTab="moi">
      <div className="flex flex-col gap-3">
        <ProfileBanner src={profile.bannerUrl} />
        <div className="flex flex-wrap items-start gap-3">
          <Avatar
            name={profile.displayName}
            src={profile.avatarUrl ?? undefined}
            size={40}
            countryCode={profile.country}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-text">{profile.displayName}</h1>
              <LevelBadge level={profile.level} showLabel link />
            </div>
            <p className="text-sm text-subtle">
              {[profile.role ? ROLE_LABELS[profile.role] : null, profile.title]
                .filter(Boolean)
                .join(" · ") || `@${profile.handle}`}
            </p>
          </div>
          {isOwnProfile ? (
            <a
              href="/parametres"
              className="inline-flex h-control max-md:h-control-mobile shrink-0 items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
            >
              <Settings className="size-4" aria-hidden="true" />
              {fr.profile.settingsLink}
            </a>
          ) : (
            viewerProfile && (
              // Sur téléphone, trois boutons à côté du nom le coupaient sur deux lignes.
              <div className="flex shrink-0 items-center gap-2 max-sm:w-full">
                <Button
                  variant={isFollowedByViewer ? "secondary" : "primary"}
                  onClick={handleToggleFollow}
                  disabled={followBusy}
                >
                  {isFollowedByViewer ? fr.profile.unfollow : fr.profile.follow}
                </Button>
                {blocked === false && !isSuspended && (
                  <Button variant="secondary" onClick={handleWrite} loading={messageBusy}>
                    {fr.messages.write}
                  </Button>
                )}
                <MoreActionsMenu
                  label={fr.messages.profileActions(profile.displayName)}
                  items={[
                    blocked
                      ? { value: "unblock", label: fr.messages.unblock(profile.handle) }
                      : { value: "block", label: fr.messages.block(profile.handle), danger: true },
                  ]}
                  onSelect={(value) =>
                    value === "unblock" ? void handleToggleBlock() : setBlockConfirmOpen(true)
                  }
                />
              </div>
            )
          )}
        </div>

        {blocked && (
          <p className="text-sm text-text-2">{fr.messages.blockedNote(profile.handle)}</p>
        )}

        {/* Kemet Pro ne vit que sur son propre profil, nulle part ailleurs. */}
        {isOwnProfile && (
          <Card variant="plain" className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-md font-semibold text-text">{fr.profile.proTitle}</p>
                <p className="text-sm text-text-2">{fr.profile.proPitch}</p>
              </div>
            </div>
            <a
              href="/pro"
              className="inline-flex h-control max-md:h-control-mobile items-center justify-center rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
            >
              {fr.profile.proCta}
            </a>
          </Card>
        )}

        {profile.bio && <p className="whitespace-pre-wrap text-sm text-text">{profile.bio}</p>}

        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => openFollowList("followers")}
            className="rounded-control py-2 hover:underline max-md:min-h-control-mobile"
          >
            {fr.profile.followersCount(formatCount(followerCount))}
          </button>
          <button
            type="button"
            onClick={() => openFollowList("following")}
            className="rounded-control py-2 hover:underline max-md:min-h-control-mobile"
          >
            {fr.profile.followingCount(formatCount(followingCount))}
          </button>
        </div>

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
          isLevelAtLeast(profile.level, OPEN_TO_OPPORTUNITIES_MIN_LEVEL)) ||
          profile.helpsBeginners) && (
          <div className="flex flex-wrap items-center gap-2">
            {profile.openToOpportunities &&
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

      <Tabs
        value={tab}
        onValueChange={selectTab}
        items={[
          {
            value: "bibliotheque",
            label: fr.library.tab,
            content: (
              <ProfileLibrary
                profile={profile}
                isOwnProfile={isOwnProfile}
                worksReloadKey={worksReloadKey}
              />
            ),
          },
          { value: "parcours", label: fr.works.profileCredentialsTab, content: credentialsContent },
        ]}
      />

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
                />
                <UserName name={item.displayName} />
              </a>
            ))
          )}
          {followListLoading && <Skeleton className="h-10 w-full" />}
          {!followListCursor && !followListLoading && followListHidden > 0 && (
            <p className="px-1 text-sm text-text-2">
              {fr.profile.hiddenFollows(
                new Intl.NumberFormat("fr-FR").format(followListHidden),
                followListItems.length > 0,
              )}
            </p>
          )}
          {followListCursor && !followListLoading && (
            <Button
              variant="secondary"
              className="self-center text-xs"
              onClick={loadMoreFollowList}
            >
              {fr.profile.loadMore}
            </Button>
          )}
        </div>
      </Dialog>
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
