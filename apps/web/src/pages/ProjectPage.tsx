import { navigate } from "../lib/navigation/navigate.js";
import { ArrowLeft, Check, ExternalLink, Rocket, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  isDeletedAccountHandle,
  type Application,
  type HelpRequest,
  type HelpRequestKind,
  type ProjectDetail,
} from "@kemet/shared";
import {
  ChatApiError,
  closeHelpRequest,
  createApplication,
  decideApplication,
  deleteProject,
  getMe,
  getProject,
  listApplications,
  listHelpRequests,
} from "../lib/chat/api.js";
import { RichText } from "../components/content/RichText.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { MoreActionsMenu } from "../components/ui/MoreActionsMenu.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";
import { fr } from "../i18n/fr.js";
import { RailPage } from "../components/layout/RailPage.js";
import { useSession } from "../session/SessionProvider.js";
import { goToSignUp } from "../session/signUpInvite.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";
import { ProfileLink } from "../components/ui/ProfileLink.js";
import { WorkMatchPanel } from "../components/works/WorkMatchPanel.js";

const KIND_LABELS: Record<HelpRequestKind, string> = {
  help: fr.projects.kindHelp,
  collaboration: fr.projects.kindCollaboration,
};

const APPLICATION_STATUS_LABELS = {
  pending: fr.projects.applicationStatusPending,
  accepted: fr.projects.applicationStatusAccepted,
  declined: fr.projects.applicationStatusDeclined,
};

function readSlug(pathname: string): string {
  return pathname.replace(/^\/projets\//, "");
}

export function ProjectPage() {
  const { status } = useSession();
  const isVisitor = status === "visitor";
  const toast = useToast();
  const slug = readSlug(window.location.pathname);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [applyFor, setApplyFor] = useState<HelpRequest | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);

  const [applicationsFor, setApplicationsFor] = useState<HelpRequest | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);

  const loadProject = useCallback(() => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    getProject(slug)
      .then((result) => setProject(result.project))
      .catch((err) => {
        if (err instanceof ChatApiError && err.statusCode === 404) setNotFound(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const loadHelpRequests = useCallback(() => {
    listHelpRequests(slug)
      .then((result) => setHelpRequests(result.items))
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    loadProject();
    loadHelpRequests();
    getMe()
      .then((me) => setMyProfileId(me.profile?.id ?? null))
      .catch(() => {});
  }, [loadProject, loadHelpRequests]);

  const isOwner = myProfileId !== null && project !== null && myProfileId === project.ownerId;

  async function handleDeleteProject() {
    if (!project) return;
    setDeleteOpen(false);
    try {
      await deleteProject(project.slug);
      navigate("/projets");
    } catch {
      toast.show(fr.projects.loadingError, "danger");
    }
  }

  async function handleCloseHelpRequest(helpRequest: HelpRequest) {
    try {
      const { helpRequest: closed } = await closeHelpRequest(helpRequest.id);
      setHelpRequests((current) => current.map((item) => (item.id === closed.id ? closed : item)));
    } catch {
      toast.show(fr.projects.closeError, "danger");
    }
  }

  async function handleSubmitApplication() {
    if (!applyFor) return;
    setApplyError(null);
    try {
      await createApplication(applyFor.id, { message: applyMessage.trim() });
      setApplyFor(null);
      setApplyMessage("");
      toast.show(fr.projects.applySent, "success");
    } catch (err) {
      setApplyError(
        err instanceof ChatApiError && err.statusCode === 409
          ? fr.projects.applyAlready
          : fr.projects.applyError,
      );
    }
  }

  function openApplications(helpRequest: HelpRequest) {
    setApplicationsFor(helpRequest);
    setApplicationsLoading(true);
    listApplications(helpRequest.id)
      .then((result) => setApplications(result.items))
      .catch(() => toast.show(fr.projects.loadingError, "danger"))
      .finally(() => setApplicationsLoading(false));
  }

  async function handleDecision(application: Application, accepted: boolean) {
    try {
      const { application: decided } = await decideApplication(application.id, accepted);
      setApplications((current) =>
        current.map((item) => (item.id === decided.id ? decided : item)),
      );
      loadHelpRequests();
    } catch {
      toast.show(fr.projects.decisionError, "danger");
    }
  }

  if (loading) {
    return (
      <RailPage activeSection="projets" className="gap-4 px-4 pt-3 lg:pt-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </RailPage>
    );
  }

  if (notFound) {
    return (
      <RailPage activeSection="projets" className="gap-4 px-4 pt-3 lg:pt-6">
        <ErrorState
          message={fr.projects.projectNotFound}
          retry={{ label: fr.projects.back, onClick: () => navigate("/projets") }}
        />
      </RailPage>
    );
  }

  if (error || !project) {
    return (
      <RailPage activeSection="projets" className="gap-4 px-4 pt-3 lg:pt-6">
        <ErrorState
          message={fr.projects.loadingError}
          retry={{ label: fr.chat.retry, onClick: loadProject }}
        />
      </RailPage>
    );
  }

  return (
    <RailPage activeSection="projets" className="gap-6 px-4 pt-3 lg:pt-6">
      <div className="flex items-center justify-between">
        <a
          href="/projets"
          className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fr.projects.back}
        </a>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-text">{project.name}</h1>
            <p className="mt-1 text-sm text-text-2">{project.pitch}</p>
          </div>
          {isOwner && (
            <MoreActionsMenu
              label={fr.projects.moreActions}
              items={[{ value: "delete", label: fr.projects.delete, danger: true }]}
              onSelect={() => setDeleteOpen(true)}
            />
          )}
        </div>

        <ProfileLink handle={project.ownerHandle} className="flex w-fit items-center gap-2">
          <Avatar
            deleted={isDeletedAccountHandle(project.ownerHandle)}
            name={project.ownerDisplayName}
            src={project.ownerAvatarUrl ?? undefined}
            countryCode={project.ownerCountry}
          />
          <UserName name={project.ownerDisplayName} />
        </ProfileLink>

        {project.description && (
          <RichText source={project.description} className="text-sm text-text" />
        )}

        {project.stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.stack.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {fr.projects.repoUrlLabel}
          </a>
          {project.demoUrl && (
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              {fr.projects.demoUrlLinkText}
            </a>
          )}
          {project.datacloudDeployUrl && (
            <a
              href={project.datacloudDeployUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Rocket className="size-4" aria-hidden="true" />
              {fr.projects.deployOnDatacloud}
            </a>
          )}
        </div>
      </div>

      {isVisitor && <VisitorBanner />}

      <WorkMatchPanel
        subject={{ type: "project", slug: project.slug }}
        signedIn={myProfileId !== null}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text">{fr.projects.helpRequestsTitle}</p>
          {isOwner && (
            <a
              href={`/projets/${slug}/demandes/nouvelle`}
              className="inline-flex h-control max-md:h-control-mobile shrink-0 items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
            >
              {fr.projects.createHelpRequestTitle}
            </a>
          )}
        </div>

        {helpRequests.length === 0 ? (
          <p className="text-sm text-subtle">{fr.projects.noHelpRequests}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {helpRequests.map((helpRequest) => (
              <li key={helpRequest.id} className="py-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-text">{helpRequest.title}</span>
                  <Badge>{KIND_LABELS[helpRequest.kind]}</Badge>
                  <Badge tone={helpRequest.status === "open" ? "success" : "neutral"}>
                    {helpRequest.status === "open"
                      ? fr.projects.statusOpen
                      : fr.projects.statusClosed}
                  </Badge>
                </div>
                <RichText source={helpRequest.description} className="mt-1 text-sm text-text-2" />
                {helpRequest.stack.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {helpRequest.stack.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  {isOwner ? (
                    <>
                      <Button
                        variant="secondary"
                        className="text-xs"
                        onClick={() => openApplications(helpRequest)}
                      >
                        {fr.projects.viewApplications} ({helpRequest.applicationCount})
                      </Button>
                      {helpRequest.status === "open" && (
                        <Button
                          variant="ghost"
                          className="text-xs"
                          onClick={() => handleCloseHelpRequest(helpRequest)}
                        >
                          {fr.projects.close}
                        </Button>
                      )}
                    </>
                  ) : (
                    helpRequest.status === "open" && (
                      <Button
                        className="text-xs"
                        onClick={isVisitor ? goToSignUp : () => setApplyFor(helpRequest)}
                      >
                        {fr.projects.apply}
                      </Button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={applyFor !== null}
        onOpenChange={(open) => !open && setApplyFor(null)}
        title={fr.projects.applyTitle}
      >
        <div className="flex flex-col gap-3">
          <CodeTextarea
            label={fr.projects.applyMessageLabel}
            value={applyMessage}
            onValueChange={setApplyMessage}
            autoFocus
          />
          {applyError && (
            <p className="text-sm text-danger" role="alert">
              {applyError}
            </p>
          )}
          <Button onClick={handleSubmitApplication} disabled={!applyMessage.trim()}>
            {fr.projects.applySubmit}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={applicationsFor !== null}
        onOpenChange={(open) => !open && setApplicationsFor(null)}
        title={fr.projects.applicationsTitle}
      >
        <div className="flex flex-col gap-3">
          {applicationsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : applications.length === 0 ? (
            <p className="text-sm text-subtle">{fr.projects.noApplications}</p>
          ) : (
            applications.map((application) => (
              <div
                key={application.id}
                className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <UserName
                    name={application.applicantDisplayName}
                    level={application.applicantLevel}
                  />
                  <Badge
                    tone={
                      application.status === "accepted"
                        ? "success"
                        : application.status === "declined"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {APPLICATION_STATUS_LABELS[application.status]}
                  </Badge>
                </div>
                <RichText source={application.message} className="text-sm text-text-2" />
                {application.status === "pending" && (
                  <div className="mt-1 flex gap-2">
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() => handleDecision(application, true)}
                    >
                      <Check className="size-4" aria-hidden="true" />
                      {fr.projects.accept}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs text-danger"
                      onClick={() => handleDecision(application, false)}
                    >
                      <X className="size-4" aria-hidden="true" />
                      {fr.projects.decline}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={fr.projects.delete}
        description={fr.projects.deleteConfirm}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            {fr.projects.cancel}
          </Button>
          <Button variant="danger" onClick={handleDeleteProject}>
            {fr.projects.delete}
          </Button>
        </div>
      </Dialog>
    </RailPage>
  );
}
