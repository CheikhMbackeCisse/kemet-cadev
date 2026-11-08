import { navigate } from "../lib/navigation/navigate.js";
import { Plus, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CompetitionDetail, CompetitionSummary } from "@kemet/shared";
import {
  getMe,
  listCompetitions,
  listPendingCompetitions,
  reviewCompetition,
} from "../lib/chat/api.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Textarea } from "../components/ui/Textarea.js";
import { useToast } from "../components/ui/Toast.js";
import { fr } from "../i18n/fr.js";
import { HeaderActionLink } from "../components/ui/HeaderActionLink.js";
import { RailPage } from "../components/layout/RailPage.js";
import { useSession } from "../session/SessionProvider.js";
import { goToSignUp, SIGN_UP_PATH } from "../session/signUpInvite.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";

const PHASE_LABELS = {
  registration: fr.competitions.phaseRegistration,
  submission: fr.competitions.phaseSubmission,
  voting: fr.competitions.phaseVoting,
  closed: fr.competitions.phaseClosed,
};

export function CompetitionsPage() {
  const { status } = useSession();
  const isVisitor = status === "visitor";
  const toast = useToast();
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState<CompetitionDetail[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<CompetitionDetail | null>(null);
  const [rejectNote, setRejectNote] = useState("");

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

  async function handleReview(competitionId: string, approve: boolean, note?: string) {
    try {
      await reviewCompetition(competitionId, note ? { approve, note } : { approve });
      setPending((current) => current.filter((item) => item.id !== competitionId));
      load();
    } catch {
      toast.show(fr.competitions.reviewError, "danger");
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return;
    await handleReview(rejectTarget.id, false, rejectNote.trim() || undefined);
    setRejectTarget(null);
    setRejectNote("");
  }

  return (
    <RailPage activeSection="competitions" className="gap-6 px-4 pt-3 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <h1 className="text-lg font-bold text-text">{fr.competitions.title}</h1>
        <div className="flex items-center gap-2">
          <HeaderActionLink href={isVisitor ? SIGN_UP_PATH : "/competitions/nouvelle"} icon={Plus}>
            {fr.competitions.requestTitle}
          </HeaderActionLink>
        </div>
      </div>

      {isVisitor && <VisitorBanner />}

      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <p className="text-sm font-medium text-text">{fr.competitions.pendingReviewTitle}</p>
          {pendingLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : pendingError ? (
            <ErrorState
              message={fr.competitions.loadingError}
              retry={{ label: fr.chat.retry, onClick: loadPending }}
            />
          ) : pending.length === 0 ? (
            <p className="text-sm text-subtle">{fr.competitions.noPendingRequests}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pending.map((competition) => (
                <li key={competition.id} className="py-3">
                  <p className="text-sm font-medium text-text">{competition.name}</p>
                  <p className="text-sm text-text-2">{competition.pitch}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {fr.competitions.createdBy(competition.createdByHandle)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() => handleReview(competition.id, true)}
                    >
                      {fr.competitions.approve}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs text-danger"
                      onClick={() => setRejectTarget(competition)}
                    >
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
        <ErrorState
          message={fr.competitions.loadingError}
          retry={{ label: fr.chat.retry, onClick: load }}
        />
      ) : competitions.length === 0 ? (
        <EmptyState
          icon={Trophy}
          message={fr.competitions.noCompetitions}
          action={{
            label: fr.competitions.requestTitle,
            onClick: isVisitor ? goToSignUp : () => navigate("/competitions/nouvelle"),
          }}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {competitions.map((competition) => (
            <li key={competition.id}>
              <a
                href={`/competitions/${competition.slug}`}
                className="block -mx-4 px-4 py-4 transition-colors duration-150 lg:-mx-3 lg:px-3 lg:hover:bg-surface-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-text">{competition.name}</span>
                  <Badge tone={competition.phase === "closed" ? "neutral" : "success"}>
                    {PHASE_LABELS[competition.phase]}
                  </Badge>
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

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectNote("");
          }
        }}
        title={fr.competitions.reject}
        description={rejectTarget?.name}
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.competitions.reviewNoteLabel}
            <Textarea
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              autoFocus
            />
          </label>
          <Button variant="danger" onClick={handleRejectConfirm}>
            {fr.competitions.reject}
          </Button>
        </div>
      </Dialog>
    </RailPage>
  );
}
