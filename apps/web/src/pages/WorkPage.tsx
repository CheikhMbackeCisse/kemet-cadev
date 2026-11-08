import { ArrowLeft, FileDown, Mail, MessagesSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { isDeletedAccountHandle, workMediaContentPath, type WorkDetail, type WorkLink, type WorkPerson } from "@kemet/shared";
import {
  ChatApiError,
  decideWorkInvitation,
  deleteWork,
  getWork,
  openTeamConversation,
  removeWorkCoauthor,
  workAttachmentUrl,
} from "../lib/chat/api.js";
import { RichText } from "../components/content/RichText.js";
import { WorkVideo } from "../components/works/WorkVideo.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { MoreActionsMenu } from "../components/ui/MoreActionsMenu.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Tabs } from "../components/ui/Tabs.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { ReportDialog } from "../components/moderation/ReportMenu.js";
import { WorkDiscussion } from "../components/works/WorkDiscussion.js";
import { WorkMatchPanel } from "../components/works/WorkMatchPanel.js";
import {
  formatFileSize,
  WORK_LINK_ICONS,
  WORK_LINK_TYPE_LABELS,
  WORK_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "../components/works/workLabels.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

function readSlug(pathname: string): string {
  return decodeURIComponent(pathname.replace(/^\/travaux\//, "").replace(/\/$/, ""));
}

function linkText(link: WorkLink): string {
  if (link.label) return link.label;
  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return WORK_LINK_TYPE_LABELS[link.type];
  }
}

const TABS = ["presentation", "discussion", "equipe"] as const;
type WorkTab = (typeof TABS)[number];

// L'onglet vit dans l'adresse : un lien peut ouvrir directement la discussion.
function readTab(): WorkTab {
  const value = new URLSearchParams(window.location.search).get("onglet");
  return TABS.includes(value as WorkTab) ? (value as WorkTab) : "presentation";
}

function writeTab(tab: WorkTab) {
  const url = new URL(window.location.href);
  if (tab === "presentation") url.searchParams.delete("onglet");
  else url.searchParams.set("onglet", tab);
  window.history.replaceState(null, "", url.pathname + url.search);
}

function PersonRow({ person }: { person: WorkPerson }) {
  return (
    <a
      href={`/u/${person.handle}`}
      className="flex min-w-0 items-center gap-2 rounded-control py-1 hover:underline max-md:min-h-control-mobile"
    >
      <Avatar
        name={person.displayName}
        src={person.avatarUrl ?? undefined}
        size={32}
        countryCode={person.country}
      />
      <UserName name={person.displayName} level={person.level} />
    </a>
  );
}

function AsideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-md font-semibold text-text">{title}</h2>
      {children}
    </div>
  );
}

const WORK_SKELETON = (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-8 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-40 w-full" />
  </div>
);

export function WorkPage() {
  const toast = useToast();
  const slug = readSlug(window.location.pathname);
  const { status, profile, isSuspended } = useSession();

  const [work, setWork] = useState<WorkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [teamBusy, setTeamBusy] = useState(false);
  const [tab, setTab] = useState<WorkTab>(readTab);
  const tabsRef = useRef<HTMLDivElement>(null);

  function changeTab(value: string) {
    const next = value as WorkTab;
    setTab(next);
    writeTab(next);
  }

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    getWork(slug)
      .then((result) => setWork(result.work))
      .catch((err) => {
        if (err instanceof ChatApiError && err.statusCode === 404) setNotFound(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // Le rôle du lecteur dépend de la session : on recharge quand elle est connue.
  useEffect(() => {
    if (status !== "loading") load();
  }, [load, status]);

  function joinDiscussion() {
    changeTab("discussion");
    // Sur mobile, les onglets sont au-dessus de cette colonne : on les ramène à l'écran.
    requestAnimationFrame(() => {
      const trigger = tabsRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      tabsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      trigger?.focus({ preventScroll: true });
    });
  }

  async function writeToTeam() {
    if (!work) return;
    setTeamBusy(true);
    try {
      const { conversation } = await openTeamConversation(work.slug);
      window.location.href = `/messages/${conversation.id}`;
    } catch (err) {
      toast.show(
        err instanceof ChatApiError && err.statusCode < 500 ? err.message : fr.works.writeToTeamError,
        "danger",
      );
      setTeamBusy(false);
    }
  }

  async function decide(accepted: boolean) {
    setBusy(true);
    try {
      const result = await decideWorkInvitation(slug, accepted);
      setWork(result.work);
      toast.show(accepted ? fr.works.accepted : fr.works.declined, "success");
    } catch {
      toast.show(fr.works.decisionError, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!profile) return;
    setWithdrawOpen(false);
    try {
      await removeWorkCoauthor(slug, profile.handle);
      toast.show(fr.works.withdrawn, "success");
      load();
    } catch {
      toast.show(fr.works.decisionError, "danger");
    }
  }

  async function remove() {
    setDeleteOpen(false);
    try {
      await deleteWork(slug);
      window.location.href = "/travaux";
    } catch {
      toast.show(fr.works.deleteError, "danger");
    }
  }

  const header = (
    <a
      href="/travaux"
      className="inline-flex w-fit items-center gap-1.5 text-sm text-link hover:underline max-md:min-h-control-mobile"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {fr.works.back}
    </a>
  );

  if (loading || notFound || error || !work) {
    return (
      <ReadingPage
        activeSection="travaux"
        header={header}
        loadingSkeleton={WORK_SKELETON}
        state={
          loading
            ? { kind: "loading" }
            : notFound
              ? {
                  kind: "notFound",
                  message: fr.works.notFound,
                  retry: {
                    label: fr.works.back,
                    onClick: () => (window.location.href = "/travaux"),
                  },
                }
              : {
                  kind: "error",
                  message: fr.works.loadingError,
                  retry: { label: fr.chat.retry, onClick: load },
                }
        }
      />
    );
  }

  const meta = [
    WORK_TYPE_LABELS[work.type],
    work.year ? String(work.year) : null,
    work.institution,
  ].filter((part): part is string => Boolean(part));
  const menuItems =
    work.viewerRole === "publisher"
      ? [
          { value: "edit", label: fr.works.edit },
          { value: "delete", label: fr.works.delete, danger: true },
        ]
      : work.viewerRole === "coauthor"
        ? [{ value: "withdraw", label: fr.works.withdraw, danger: true }]
        : status === "ready"
          ? [{ value: "report", label: fr.moderation.reportAction }]
          : [];

  // Un compte supprimé ne reçoit plus rien ; un auteur seul n'a personne à qui écrire.
  const canWriteToTeam =
    status === "ready" &&
    !isSuspended &&
    [work.publisher, ...work.coauthors].some(
      (person) => person.handle !== profile?.handle && !isDeletedAccountHandle(person.handle),
    );

  function onMenuSelect(value: string) {
    if (value === "edit") window.location.href = `/travaux/${work!.slug}/modifier`;
    if (value === "delete") setDeleteOpen(true);
    if (value === "withdraw") setWithdrawOpen(true);
    if (value === "report") setReportOpen(true);
  }

  const team = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <PersonRow person={work.publisher} />
        {work.coauthors.map((person) => (
          <PersonRow key={person.id} person={person} />
        ))}
      </div>
      {work.externalAuthors.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-subtle">{fr.works.teamExternal}</p>
          <ul className="flex flex-col gap-0.5 text-sm text-text-2">
            {work.externalAuthors.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const presentation = (
    <div className="flex flex-col gap-6">
      <RichText source={work.summary} className="text-base text-text" />

      {work.videos.length > 0 && (
        <AsideSection title={fr.works.videosTitle}>
          <div className="flex flex-col gap-4">
            {work.videos.map((video, index) => (
              <WorkVideo key={video.id} video={video} title={fr.works.videoTitle(work.title, index + 1)} />
            ))}
          </div>
        </AsideSection>
      )}

      {work.gallery.length > 0 && (
        <AsideSection title={fr.works.galleryTitle}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {work.gallery.map((image, index) => (
              <li key={image.id}>
                <a
                  href={workMediaContentPath(image.id)}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={fr.works.openImage(index + 1)}
                  className="block overflow-hidden rounded-control border border-border hover:border-border-strong"
                >
                  <img
                    src={workMediaContentPath(image.id)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3] w-full bg-surface-2 object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </AsideSection>
      )}

      {(work.links.length > 0 || work.attachment) && (
        <AsideSection title={fr.works.linksTitle}>
          <ul className="flex flex-col gap-1">
            {work.links.map((link) => {
              const Icon = WORK_LINK_ICONS[link.type];
              return (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-8 max-w-full items-center gap-2 text-sm text-link hover:underline max-md:min-h-control-mobile"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{linkText(link)}</span>
                    <span className="sr-only">
                      ({WORK_LINK_TYPE_LABELS[link.type]}, {fr.content.newTab})
                    </span>
                  </a>
                </li>
              );
            })}
            {work.attachment && (
              <li>
                <a
                  href={workAttachmentUrl(work.attachment.id)}
                  download={work.attachment.originalName}
                  className="inline-flex min-h-8 max-w-full items-center gap-2 text-sm text-link hover:underline max-md:min-h-control-mobile"
                >
                  <FileDown className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{fr.works.pdfDownload}</span>
                  <span className="shrink-0 text-xs text-subtle">
                    {fr.works.pdfSize(formatFileSize(work.attachment.byteSize))}
                  </span>
                </a>
              </li>
            )}
          </ul>
        </AsideSection>
      )}

      {work.tags.length > 0 && (
        <AsideSection title={fr.works.tagsTitle}>
          <div className="flex flex-wrap gap-1.5">
            {work.tags.map((tag) => (
              <a
                key={tag}
                href={`/travaux?tag=${encodeURIComponent(tag)}`}
                className="inline-flex items-center rounded-full max-md:min-h-control-mobile"
              >
                <Badge className="hover:bg-accent-soft">{tag}</Badge>
              </a>
            ))}
          </div>
        </AsideSection>
      )}

      {work.stack.length > 0 && (
        <AsideSection title={fr.works.stackTitle}>
          <div className="flex flex-wrap gap-1.5">
            {work.stack.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        </AsideSection>
      )}
    </div>
  );

  return (
    <ReadingPage activeSection="travaux" header={header}>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-10">
        <article className="flex min-w-0 flex-col gap-4">
          {work.coverMediaId && (
            <img
              src={workMediaContentPath(work.coverMediaId)}
              alt={fr.works.coverAlt(work.title)}
              className="aspect-[16/9] w-full rounded-card border border-border bg-surface-2 object-cover"
            />
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-text">{work.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-subtle">
                <Badge tone={work.status === "in_progress" ? "accent" : "neutral"}>
                  {WORK_STATUS_LABELS[work.status]}
                </Badge>
                {fr.works.yearAndInstitution(meta)}
              </p>
            </div>
            {menuItems.length > 0 && (
              <MoreActionsMenu
                label={fr.works.moreActions}
                items={menuItems}
                onSelect={onMenuSelect}
              />
            )}
          </div>

          {work.viewerRole === "invited" && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
              <p className="text-sm text-text">{fr.works.invitedBanner}</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => decide(false)} disabled={busy}>
                  {fr.works.decline}
                </Button>
                <Button onClick={() => decide(true)} disabled={busy}>
                  {fr.works.accept}
                </Button>
              </div>
            </div>
          )}

          <div ref={tabsRef} className="scroll-mt-4">
            <Tabs
              value={tab}
              onValueChange={changeTab}
              items={[
                { value: "presentation", label: fr.works.tabPresentation, content: presentation },
                {
                  value: "discussion",
                  label: fr.works.tabDiscussion,
                  content: (
                    <WorkDiscussion
                      work={work}
                      viewer={
                        status === "ready" && profile
                          ? { id: profile.id, displayName: profile.displayName }
                          : null
                      }
                    />
                  ),
                },
                { value: "equipe", label: fr.works.tabTeam, content: team },
              ]}
            />
          </div>
        </article>

        <aside className="flex flex-col gap-6 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex flex-col gap-2">
            <Button onClick={joinDiscussion} aria-describedby="work-discussion-participants">
              <MessagesSquare className="size-4" aria-hidden="true" />
              {fr.works.joinDiscussion}
            </Button>
            <p id="work-discussion-participants" className="text-xs text-subtle">
              {fr.works.participants(work.participantCount)}
            </p>
            {canWriteToTeam && (
              <Button variant="secondary" onClick={writeToTeam} loading={teamBusy}>
                <Mail className="size-4" aria-hidden="true" />
                {fr.works.writeToTeam}
              </Button>
            )}
          </div>

          <WorkMatchPanel
            subject={{ type: "work", slug: work.slug }}
            signedIn={status === "ready"}
            className="border-t border-border pt-6"
          />
        </aside>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={fr.works.delete}
        description={fr.works.deleteConfirm}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            {fr.common.cancel}
          </Button>
          <Button variant="danger" onClick={remove}>
            {fr.works.delete}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title={fr.works.withdraw}
        description={fr.works.withdrawConfirm}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setWithdrawOpen(false)}>
            {fr.common.cancel}
          </Button>
          <Button variant="danger" onClick={withdraw}>
            {fr.works.withdraw}
          </Button>
        </div>
      </Dialog>

      <ReportDialog
        contentType="work"
        contentId={work.id}
        authorId={work.publisher.id}
        authorHandle={work.publisher.handle}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </ReadingPage>
  );
}
