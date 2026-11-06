import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PendingWorkInvitation, ProfileWork } from "@kemet/shared";
import { decideWorkInvitation, listMyWorkInvitations, listUserWorks } from "../../lib/chat/api.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { useToast } from "../ui/Toast.js";
import { fr } from "../../i18n/fr.js";
import { WorkListItem } from "./WorkListItem.js";
import { WORK_TYPE_LABELS } from "./workLabels.js";

/**
 * Demandes de coauteur reçues, sur son propre profil : les notifications
 * n'existent pas encore, c'est le seul endroit où elles apparaissent.
 */
export function WorkInvitations({ onDecided }: { onDecided: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<PendingWorkInvitation[]>([]);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    listMyWorkInvitations()
      .then((result) => setItems(result.items))
      .catch(() => setError(true));
  }, []);

  useEffect(() => load(), [load]);

  async function decide(slug: string, accepted: boolean) {
    setBusySlug(slug);
    try {
      await decideWorkInvitation(slug, accepted);
      setItems((current) => current.filter((item) => item.work.slug !== slug));
      toast.show(accepted ? fr.works.accepted : fr.works.declined, "success");
      if (accepted) onDecided();
    } catch {
      toast.show(fr.works.decisionError, "danger");
    } finally {
      setBusySlug(null);
    }
  }

  if (error) {
    return (
      <ErrorState
        message={fr.works.invitationsLoadError}
        retry={{ label: fr.chat.retry, onClick: load }}
        className="border-b border-border py-6"
      />
    );
  }
  if (items.length === 0) return null;
  return (
    <section
      className="flex flex-col gap-2 border-b border-border pb-4"
      aria-labelledby="work-invitations-title"
    >
      <h2 id="work-invitations-title" className="text-md font-semibold text-text">
        {fr.works.invitationsTitle}
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {items.map(({ work }) => (
          <li key={work.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <a
                href={`/travaux/${work.slug}`}
                className="text-sm font-medium text-text hover:underline"
              >
                {work.title}
              </a>
              <p className="text-xs text-muted">
                {WORK_TYPE_LABELS[work.type]} ·{" "}
                {fr.works.invitationFrom(work.publisher.displayName)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={busySlug === work.slug}
                onClick={() => decide(work.slug, false)}
              >
                {fr.works.decline}
              </Button>
              <Button disabled={busySlug === work.slug} onClick={() => decide(work.slug, true)}>
                {fr.works.accept}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface ProfileWorksProps {
  handle: string;
  isOwnProfile: boolean;
  /** Change pour forcer un rechargement, après une invitation acceptée. */
  reloadKey: number;
}

/** Travaux publiés et co-signés (acceptés) d'un profil. */
export function ProfileWorks({ handle, isOwnProfile, reloadKey }: ProfileWorksProps) {
  const toast = useToast();
  const [works, setWorks] = useState<ProfileWork[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    listUserWorks(handle)
      .then((page) => {
        setWorks(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [handle]);

  useEffect(() => load(), [load, reloadKey]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await listUserWorks(handle, nextCursor);
      setWorks((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      toast.show(fr.works.loadMoreError, "danger");
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (error)
    return (
      <ErrorState message={fr.works.loadingError} retry={{ label: fr.chat.retry, onClick: load }} />
    );
  if (works.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        message={isOwnProfile ? fr.works.profileEmptyOwn : fr.works.profileEmptyOther}
        action={
          isOwnProfile
            ? {
                label: fr.works.createTitle,
                onClick: () => (window.location.href = "/travaux/nouveau"),
              }
            : undefined
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {works.map((work) => (
          <WorkListItem
            key={work.id}
            work={work}
            relationLabel={
              work.relation === "published" ? fr.works.profilePublished : fr.works.profileCoauthored
            }
          />
        ))}
      </ul>
      {nextCursor && (
        <Button
          variant="secondary"
          className="self-center"
          onClick={loadMore}
          loading={loadingMore}
        >
          {fr.works.loadMore}
        </Button>
      )}
    </div>
  );
}
