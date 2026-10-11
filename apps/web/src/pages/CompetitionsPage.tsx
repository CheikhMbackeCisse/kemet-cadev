import { Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CompetitionDetail, CompetitionSummary } from "@kemet/shared";
import { ChatApiError, getMe, listCompetitions, listPendingCompetitions, requestCompetition, reviewCompetition } from "../lib/chat/api.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Input } from "../components/ui/Input.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Textarea } from "../components/ui/Textarea.js";
import { useToast } from "../components/ui/Toast.js";
import { ThemeToggle } from "../theme/ThemeToggle.js";
import { fr } from "../i18n/fr.js";

const DIACRITICS_PATTERN = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PHASE_LABELS = {
  registration: fr.competitions.phaseRegistration,
  submission: fr.competitions.phaseSubmission,
  voting: fr.competitions.phaseVoting,
  closed: fr.competitions.phaseClosed,
};

export function CompetitionsPage() {
  const toast = useToast();
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState<CompetitionDetail[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");
  const [submissionClosesAt, setSubmissionClosesAt] = useState("");
  const [votingClosesAt, setVotingClosesAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    listCompetitions()
      .then((page) => setCompetitions(page.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const loadPending = useCallback(() => {
    setPendingLoading(true);
    setPendingError(false);
    listPendingCompetitions()
      .then((result) => setPending(result.items))
      .catch(() => setPendingError(true))
      .finally(() => setPendingLoading(false));
  }, []);

  useEffect(() => {
    load();
    getMe()
      .then((me) => {
        setIsAdmin(me.isPlatformAdmin);
        if (me.isPlatformAdmin) loadPending();
      })
      .catch(() => {});
  }, [load, loadPending]);

  async function handleCreate() {
    setCreateError(null);
    try {
      await requestCompetition({
        slug,
        name,
        pitch,
        description,
        registrationClosesAt: new Date(registrationClosesAt).toISOString(),
        submissionClosesAt: new Date(submissionClosesAt).toISOString(),
        votingClosesAt: new Date(votingClosesAt).toISOString(),
      });
      setCreateOpen(false);
      setName("");
      setSlug("");
      setPitch("");
      setDescription("");
      setRegistrationClosesAt("");
      setSubmissionClosesAt("");
      setVotingClosesAt("");
      toast.show(fr.competitions.requestSent, "success");
    } catch (err) {
      setCreateError(err instanceof ChatApiError ? err.message : fr.competitions.requestError);
    }
  }

  async function handleReview(competitionId: string, approve: boolean) {
    try {
      await reviewCompetition(competitionId, { approve });
      setPending((current) => current.filter((item) => item.id !== competitionId));
      load();
    } catch {
      toast.show(fr.competitions.reviewError, "danger");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div>
          <h1 className="text-lg font-semibold text-text">{fr.competitions.title}</h1>
          <p className="text-sm text-subtle">{fr.competitions.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="/salons"
            className="inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
          >
            {fr.competitions.salonsLink}
          </a>
          <Button onClick={() => setCreateOpen(true)}>{fr.competitions.requestTitle}</Button>
        </div>
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-card border border-border-strong p-4">
          <p className="text-sm font-medium text-text">{fr.competitions.pendingReviewTitle}</p>
          {pendingLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : pendingError ? (
            <ErrorState message={fr.competitions.loadingError} retry={{ label: fr.chat.retry, onClick: loadPending }} />
          ) : pending.length === 0 ? (
            <p className="text-sm text-subtle">{fr.competitions.noPendingRequests}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {pending.map((competition) => (
                <li key={competition.id} className="rounded-card border border-border p-3">
                  <p className="text-sm font-medium text-text">{competition.name}</p>
                  <p className="text-sm text-text-2">{competition.pitch}</p>
                  <p className="mt-1 text-xs text-subtle">{fr.competitions.createdBy(competition.createdByHandle)}</p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" className="text-xs" onClick={() => handleReview(competition.id, true)}>
                      {fr.competitions.approve}
                    </Button>
                    <Button variant="ghost" className="text-xs text-danger" onClick={() => handleReview(competition.id, false)}>
                      {fr.competitions.reject}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={fr.competitions.loadingError} retry={{ label: fr.chat.retry, onClick: load }} />
      ) : competitions.length === 0 ? (
        <EmptyState icon={Trophy} message={fr.competitions.noCompetitions} action={{ label: fr.competitions.requestTitle, onClick: () => setCreateOpen(true) }} />
      ) : (
        <ul className="flex flex-col gap-3">
          {competitions.map((competition) => (
            <li key={competition.id}>
              <a href={`/competitions/${competition.slug}`} className="block rounded-card border border-border p-4 hover:bg-surface-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-text">{competition.name}</span>
                  <Badge tone={competition.phase === "closed" ? "neutral" : "success"}>{PHASE_LABELS[competition.phase]}</Badge>
                </div>
                <p className="mt-1 text-sm text-text-2">{competition.pitch}</p>
                <p className="mt-2 text-xs text-subtle">
                  {competition.teamCount} équipes · {competition.submissionCount} soumissions
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title={fr.competitions.requestTitle}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.nameLabel}
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSlug(slugify(event.target.value));
              }}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.slugLabel}
            <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
            <span className="text-xs text-subtle">{fr.competitions.slugHint}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.pitchLabel}
            <Input value={pitch} onChange={(event) => setPitch(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.descriptionLabel}
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.registrationClosesAtLabel}
            <Input type="datetime-local" value={registrationClosesAt} onChange={(event) => setRegistrationClosesAt(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.submissionClosesAtLabel}
            <Input type="datetime-local" value={submissionClosesAt} onChange={(event) => setSubmissionClosesAt(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.votingClosesAtLabel}
            <Input type="datetime-local" value={votingClosesAt} onChange={(event) => setVotingClosesAt(event.target.value)} />
          </label>
          {createError && (
            <p className="text-sm text-danger" role="alert">
              {createError}
            </p>
          )}
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || !slug.trim() || !pitch.trim() || !registrationClosesAt || !submissionClosesAt || !votingClosesAt}
          >
            {fr.competitions.requestSubmit}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
