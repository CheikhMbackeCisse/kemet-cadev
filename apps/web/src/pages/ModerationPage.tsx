import { ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ModerationActionEntry, Report } from "@kemet/shared";
import { listModerationLog, listPendingReports, resolveReport } from "../lib/chat/api.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Input } from "../components/ui/Input.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { useToast } from "../components/ui/Toast.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { RailPage } from "../components/layout/RailPage.js";

const TARGET_LABELS = {
  message: fr.moderation.targetMessage,
  post: fr.moderation.targetPost,
  profile: fr.moderation.targetProfile,
  work: fr.moderation.targetWork,
  conversation: fr.moderation.targetConversation,
};

const ACTION_LABELS: Record<ModerationActionEntry["action"], string> = {
  content_hidden: fr.moderation.actionContentHidden,
  account_suspended: fr.moderation.actionAccountSuspended,
  account_reinstated: fr.moderation.actionAccountReinstated,
  report_dismissed: fr.moderation.actionReportDismissed,
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReportRow({
  report,
  onResolve,
}: {
  report: Report;
  onResolve: (reportId: string, action: "hide" | "dismiss" | "suspend", reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const isContent = report.targetType !== "profile";

  return (
    <li className="py-3">
      <div className="flex items-baseline gap-2">
        <Badge>{TARGET_LABELS[report.targetType]}</Badge>
        <span className="text-xs text-subtle">
          {fr.moderation.reportedBy(report.reporterHandle)}
        </span>
        <span className="text-xs text-subtle">{formatTime(report.createdAt)}</span>
      </div>
      {/* Une conversation signalée arrive sur plusieurs lignes : participants, puis messages. */}
      <p className="mt-1 whitespace-pre-line text-sm text-text">{report.targetSummary}</p>
      <p className="mt-1 text-sm text-text-2">{report.reason}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          placeholder={fr.moderation.resolveReasonPlaceholder}
          aria-label={fr.moderation.resolveReasonPlaceholder}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="w-auto flex-1"
        />
        {isContent && (
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => onResolve(report.id, "hide", reason)}
          >
            {fr.moderation.hide}
          </Button>
        )}
        {(report.targetType === "profile" || report.targetType === "conversation") && (
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => onResolve(report.id, "suspend", reason)}
          >
            {fr.moderation.suspend}
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-xs text-danger"
          onClick={() => onResolve(report.id, "dismiss", reason)}
        >
          {fr.moderation.dismiss}
        </Button>
      </div>
    </li>
  );
}

export function ModerationPage() {
  const toast = useToast();
  const { status, isPlatformAdmin } = useSession();

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsCursor, setReportsCursor] = useState<string | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState(false);

  const [log, setLog] = useState<ModerationActionEntry[]>([]);
  const [logCursor, setLogCursor] = useState<string | null>(null);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState(false);

  const loadReports = useCallback(() => {
    setReportsLoading(true);
    setReportsError(false);
    listPendingReports()
      .then((page) => {
        setReports(page.items);
        setReportsCursor(page.nextCursor);
      })
      .catch(() => setReportsError(true))
      .finally(() => setReportsLoading(false));
  }, []);

  const loadLog = useCallback(() => {
    setLogLoading(true);
    setLogError(false);
    listModerationLog()
      .then((page) => {
        setLog(page.items);
        setLogCursor(page.nextCursor);
      })
      .catch(() => setLogError(true))
      .finally(() => setLogLoading(false));
  }, []);

  useEffect(() => {
    if (isPlatformAdmin) {
      loadReports();
      loadLog();
    }
  }, [isPlatformAdmin, loadReports, loadLog]);

  async function loadMoreReports() {
    if (!reportsCursor) return;
    const page = await listPendingReports(reportsCursor);
    setReports((current) => [...current, ...page.items]);
    setReportsCursor(page.nextCursor);
  }

  async function loadMoreLog() {
    if (!logCursor) return;
    const page = await listModerationLog(logCursor);
    setLog((current) => [...current, ...page.items]);
    setLogCursor(page.nextCursor);
  }

  async function handleResolve(
    reportId: string,
    action: "hide" | "dismiss" | "suspend",
    reason: string,
  ) {
    try {
      await resolveReport(reportId, { action, reason: reason.trim() || undefined });
      setReports((current) => current.filter((report) => report.id !== reportId));
      loadLog();
    } catch {
      toast.show(fr.moderation.resolveError, "danger");
    }
  }

  if (status === "loading") return null;

  if (!isPlatformAdmin) {
    return (
      <RailPage className="items-center justify-center gap-4 px-4 py-8">
        <EmptyState icon={ShieldAlert} message={fr.moderation.forbidden} />
      </RailPage>
    );
  }

  return (
    <RailPage className="gap-6 px-4 pt-3 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <h1 className="text-lg font-bold text-text">{fr.moderation.title}</h1>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text">{fr.moderation.queueTitle}</p>
        {reportsLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : reportsError ? (
          <ErrorState
            message={fr.moderation.loadingError}
            retry={{ label: fr.chat.retry, onClick: loadReports }}
          />
        ) : reports.length === 0 ? (
          <p className="text-sm text-subtle">{fr.moderation.queueEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {reports.map((report) => (
              <ReportRow key={report.id} report={report} onResolve={handleResolve} />
            ))}
          </ul>
        )}
        {reportsCursor && (
          <Button variant="secondary" onClick={loadMoreReports} className="self-center">
            {fr.moderation.loadMore}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text">{fr.moderation.logTitle}</p>
        {logLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : logError ? (
          <ErrorState
            message={fr.moderation.loadingError}
            retry={{ label: fr.chat.retry, onClick: loadLog }}
          />
        ) : log.length === 0 ? (
          <p className="text-sm text-subtle">{fr.moderation.logEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {log.map((entry) => (
              <li key={entry.id} className="py-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <Badge>{TARGET_LABELS[entry.targetType]}</Badge>
                  <span className="font-medium text-text">{ACTION_LABELS[entry.action]}</span>
                  <span className="text-xs text-subtle">
                    {fr.moderation.actionBy(entry.actorHandle)}
                  </span>
                  <span className="text-xs text-subtle">{formatTime(entry.createdAt)}</span>
                </div>
                <p className="mt-1 text-text-2">{entry.targetSummary}</p>
                {entry.reason && <p className="mt-0.5 text-xs text-subtle">{entry.reason}</p>}
              </li>
            ))}
          </ul>
        )}
        {logCursor && (
          <Button variant="secondary" onClick={loadMoreLog} className="self-center">
            {fr.moderation.loadMore}
          </Button>
        )}
      </div>
    </RailPage>
  );
}
