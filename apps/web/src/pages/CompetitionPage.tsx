import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CompetitionDetail, ProjectSummary, Submission, SubmissionResult, Team } from "@kemet/shared";
import {
  ChatApiError,
  createSubmission,
  createTeam,
  getCompetition,
  getCompetitionResults,
  getMe,
  getMyVote,
  joinTeam,
  listProjects,
  listSubmissions,
  listTeams,
  submitJuryScore,
  voteForSubmission,
} from "../lib/chat/api.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Tabs } from "../components/ui/Tabs.js";
import { Textarea } from "../components/ui/Textarea.js";
import { useToast } from "../components/ui/Toast.js";
import { ThemeToggle } from "../theme/ThemeToggle.js";
import { fr } from "../i18n/fr.js";

const PHASE_LABELS = {
  registration: fr.competitions.phaseRegistration,
  submission: fr.competitions.phaseSubmission,
  voting: fr.competitions.phaseVoting,
  closed: fr.competitions.phaseClosed,
};

function readSlug(pathname: string): string {
  return pathname.replace(/^\/competitions\//, "");
}

export function CompetitionPage() {
  const toast = useToast();
  const slug = readSlug(window.location.pathname);

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [myProjects, setMyProjects] = useState<ProjectSummary[]>([]);

  const [teams, setTeams] = useState<Team[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [results, setResults] = useState<SubmissionResult[] | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("teams");

  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [submissionTitle, setSubmissionTitle] = useState("");
  const [submissionPitch, setSubmissionPitch] = useState("");
  const [submissionDescription, setSubmissionDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});

  const loadCompetition = useCallback(() => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    getCompetition(slug)
      .then((result) => setCompetition(result.competition))
      .catch((err) => {
        if (err instanceof ChatApiError && err.statusCode === 404) setNotFound(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const loadTeams = useCallback(() => {
    listTeams(slug).then((result) => setTeams(result.items)).catch(() => {});
  }, [slug]);

  const loadSubmissions = useCallback(() => {
    listSubmissions(slug).then((result) => setSubmissions(result.items)).catch(() => {});
  }, [slug]);

  useEffect(() => {
    loadCompetition();
    loadTeams();
    loadSubmissions();
    getMe().then((me) => {
      setMyProfileId(me.profile?.id ?? null);
      if (me.profile) listProjects().then((page) => setMyProjects(page.items.filter((project) => project.ownerId === me.profile!.id)));
    });
  }, [loadCompetition, loadTeams, loadSubmissions]);

  useEffect(() => {
    if (!competition) return;
    if (competition.phase === "voting" || competition.phase === "closed") {
      getMyVote(slug).then((result) => setMyVote(result.submissionId)).catch(() => {});
    }
    if (competition.phase === "closed") {
      getCompetitionResults(slug).then((result) => setResults(result.items)).catch(() => {});
    }
  }, [competition, slug]);

  const myTeam = teams.find((team) => team.viewerIsMember) ?? null;

  async function handleCreateTeam() {
    setTeamError(null);
    try {
      await createTeam(slug, { name: teamName });
      setCreateTeamOpen(false);
      setTeamName("");
      loadTeams();
    } catch (err) {
      setTeamError(err instanceof ChatApiError ? err.message : fr.competitions.createTeamError);
    }
  }

  async function handleJoinTeam(teamId: string) {
    try {
      await joinTeam(teamId);
      loadTeams();
    } catch {
      toast.show(fr.competitions.joinTeamError, "danger");
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    try {
      await createSubmission(slug, {
        projectId,
        title: submissionTitle,
        pitch: submissionPitch,
        description: submissionDescription,
        repoUrl,
        demoUrl: demoUrl.trim() ? demoUrl.trim() : null,
      });
      setSubmitOpen(false);
      setProjectId("");
      setSubmissionTitle("");
      setSubmissionPitch("");
      setSubmissionDescription("");
      setRepoUrl("");
      setDemoUrl("");
      loadSubmissions();
      loadTeams();
    } catch (err) {
      setSubmitError(err instanceof ChatApiError ? err.message : fr.competitions.submitProjectError);
    }
  }

  async function handleVote(submissionId: string) {
    try {
      const result = await voteForSubmission(submissionId);
      setMyVote(result.submissionId);
    } catch {
      toast.show(fr.competitions.voteError, "danger");
    }
  }

  async function handleScore(submissionId: string) {
    const raw = scoreDrafts[submissionId];
    const score = Number(raw);
    if (!raw || Number.isNaN(score)) return;
    try {
      await submitJuryScore(submissionId, { score });
      toast.show(fr.competitions.jurorScoreSubmit, "success");
    } catch {
      toast.show(fr.competitions.jurorScoreError, "danger");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-4 px-4 py-8">
        <ErrorState message={fr.competitions.competitionNotFound} retry={{ label: fr.competitions.back, onClick: () => (window.location.href = "/competitions") }} />
      </main>
    );
  }

  if (error || !competition) {
    return (
      <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-4 px-4 py-8">
        <ErrorState message={fr.competitions.loadingError} retry={{ label: fr.chat.retry, onClick: loadCompetition }} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <a href="/competitions" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fr.competitions.back}
        </a>
        <ThemeToggle />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-text">{competition.name}</h1>
            <p className="mt-1 text-sm text-text-2">{competition.pitch}</p>
          </div>
          {competition.status === "published" ? (
            <Badge tone={competition.phase === "closed" ? "neutral" : "success"}>{PHASE_LABELS[competition.phase]}</Badge>
          ) : (
            <Badge tone={competition.status === "rejected" ? "danger" : "neutral"}>
              {competition.status === "rejected" ? fr.competitions.statusRejected : fr.competitions.statusPendingReview}
            </Badge>
          )}
        </div>
        {competition.description && <p className="whitespace-pre-wrap text-sm text-text">{competition.description}</p>}
        <p className="text-xs text-subtle">{fr.competitions.createdBy(competition.createdByHandle)}</p>
        {competition.reviewNote && <p className="text-xs text-subtle">{fr.competitions.reviewNote(competition.reviewNote)}</p>}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={[
          {
            value: "teams",
            label: fr.competitions.teamsTab,
            content: (
              <div className="flex flex-col gap-3">
                {myProfileId && !myTeam && competition.phase === "registration" && (
                  <Button onClick={() => setCreateTeamOpen(true)}>{fr.competitions.createTeamTitle}</Button>
                )}
                {teams.length === 0 ? (
                  <p className="text-sm text-subtle">{fr.competitions.noTeams}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {teams.map((team) => (
                      <li key={team.id} className="rounded-card border border-border p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-text">{team.name}</span>
                          {team.viewerIsMember && <Badge tone="success">{fr.competitions.yourTeam}</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-subtle">{fr.competitions.captain(team.captainHandle)}</p>
                        <p className="text-xs text-subtle">{fr.competitions.members(team.memberHandles)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          {team.hasSubmission && <Badge>{fr.competitions.hasSubmission}</Badge>}
                          {!team.viewerIsMember && !myTeam && competition.phase === "registration" && (
                            <Button variant="secondary" className="text-xs" onClick={() => handleJoinTeam(team.id)}>
                              {fr.competitions.joinTeam}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
          {
            value: "submissions",
            label: fr.competitions.submissionsTab,
            content: (
              <div className="flex flex-col gap-3">
                {myTeam && !myTeam.hasSubmission && competition.phase === "submission" && (
                  <Button onClick={() => setSubmitOpen(true)}>{fr.competitions.submitProjectTitle}</Button>
                )}
                {submissions.length === 0 ? (
                  <p className="text-sm text-subtle">{fr.competitions.noSubmissions}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {submissions.map((submission) => (
                      <li key={submission.id} className="rounded-card border border-border p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-text">{submission.title}</span>
                          <span className="text-xs text-subtle">{submission.teamName}</span>
                        </div>
                        <p className="mt-1 text-sm text-text-2">{submission.pitch}</p>
                        {submission.repoUrl ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <a href={submission.repoUrl} target="_blank" rel="noreferrer" className="text-xs text-link hover:underline">
                              {fr.competitions.repoUrlLabel}
                            </a>
                            {submission.demoUrl && (
                              <a href={submission.demoUrl} target="_blank" rel="noreferrer" className="text-xs text-link hover:underline">
                                {fr.competitions.demoUrlLabel}
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-subtle">{fr.competitions.detailsHiddenDuringSubmission}</p>
                        )}
                        {competition.phase === "voting" && !submission.viewerIsTeamMember && (
                          <div className="mt-2">
                            <Button
                              variant={myVote === submission.id ? "secondary" : "primary"}
                              className="text-xs"
                              onClick={() => handleVote(submission.id)}
                            >
                              {myVote === submission.id ? fr.competitions.votedFor : fr.competitions.voteButton}
                            </Button>
                          </div>
                        )}
                        {competition.phase === "voting" && competition.viewerIsJuror && !submission.viewerIsTeamMember && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-text-2">
                              {fr.competitions.jurorScoreLabel}
                              <Input
                                type="number"
                                min={0}
                                max={20}
                                className="w-16"
                                value={scoreDrafts[submission.id] ?? ""}
                                onChange={(event) => setScoreDrafts((current) => ({ ...current, [submission.id]: event.target.value }))}
                              />
                            </label>
                            <Button variant="secondary" className="text-xs" onClick={() => handleScore(submission.id)}>
                              {fr.competitions.jurorScoreSubmit}
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
          {
            value: "results",
            label: fr.competitions.resultsTab,
            content:
              competition.phase !== "closed" ? (
                <p className="text-sm text-subtle">{fr.competitions.resultsNotReady}</p>
              ) : results === null ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <ul className="flex flex-col gap-3">
                  {results.map((result) => (
                    <li key={result.submissionId} className="flex items-center justify-between rounded-card border border-border p-4">
                      <div>
                        <span className="text-sm font-medium text-text">
                          {fr.competitions.rank(result.rank)} {result.teamName}
                        </span>
                        <p className="text-xs text-subtle">
                          {result.juryAverage === null ? fr.competitions.noJuryScore : fr.competitions.juryAverage(result.juryAverage)} ·{" "}
                          {fr.competitions.voteCount(result.voteCount)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />

      <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen} title={fr.competitions.createTeamTitle}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.teamNameLabel}
            <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} autoFocus />
          </label>
          {teamError && (
            <p className="text-sm text-danger" role="alert">
              {teamError}
            </p>
          )}
          <Button onClick={handleCreateTeam} disabled={!teamName.trim()}>
            {fr.competitions.createTeamSubmit}
          </Button>
        </div>
      </Dialog>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen} title={fr.competitions.submitProjectTitle}>
        <div className="flex flex-col gap-3">
          {myProjects.length === 0 ? (
            <p className="text-sm text-subtle">{fr.competitions.noOwnProjects}</p>
          ) : (
            <label className="flex flex-col gap-1 text-sm text-text-2">
              {fr.competitions.projectLabel}
              <Select
                aria-label={fr.competitions.projectLabel}
                value={projectId}
                onValueChange={setProjectId}
                options={myProjects.map((project) => ({ value: project.id, label: project.name }))}
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.titleLabel}
            <Input value={submissionTitle} onChange={(event) => setSubmissionTitle(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.pitchLabel}
            <Input value={submissionPitch} onChange={(event) => setSubmissionPitch(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.descriptionLabel}
            <Textarea value={submissionDescription} onChange={(event) => setSubmissionDescription(event.target.value)} className="min-h-24" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.repoUrlLabel}
            <Input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.demoUrlLabel}
            <Input value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} />
          </label>
          {submitError && (
            <p className="text-sm text-danger" role="alert">
              {submitError}
            </p>
          )}
          <Button onClick={handleSubmit} disabled={!projectId || !submissionTitle.trim() || !submissionPitch.trim() || !repoUrl.trim()}>
            {fr.competitions.submitProjectSubmit}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
