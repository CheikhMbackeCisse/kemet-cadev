import { ArrowLeft, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SkillDetail } from "@kemet/shared";
import { ChatApiError, deleteSkill, getSkill, rateSkill } from "../lib/chat/api.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { cn } from "../lib/cn.js";
import { fr } from "../i18n/fr.js";
import { RailPage } from "../components/layout/RailPage.js";

function readSlug(pathname: string): string {
  return pathname.replace(/^\/skills\//, "");
}

function starLabel(stars: number): string {
  return stars === 1 ? "1 étoile" : `${stars} étoiles`;
}

export function SkillPage() {
  const slug = readSlug(window.location.pathname);
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getSkill(slug)
      .then((result) => setSkill(result.skill))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => load(), [load]);

  async function handleRate(stars: number) {
    setActionError(null);
    try {
      const { ratings } = await rateSkill(slug, stars);
      setSkill((current) =>
        current
          ? { ...current, averageStars: ratings.average, ratingCount: ratings.count }
          : current,
      );
      setMyRating(stars);
    } catch (err) {
      setActionError(
        err instanceof ChatApiError && err.statusCode === 403
          ? fr.skills.rateRequiresUsage
          : fr.skills.rateError,
      );
    }
  }

  async function handleDelete() {
    setDeleteOpen(false);
    try {
      await deleteSkill(slug);
      window.location.href = "/skills";
    } catch {
      setActionError(fr.spaces.actionError);
    }
  }

  if (loading) {
    return (
      <RailPage activeSection="skills" className="gap-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </RailPage>
    );
  }

  if (error || !skill) {
    return (
      <RailPage activeSection="skills" className="gap-4 px-4 py-8">
        <ErrorState
          message={fr.skills.loadingError}
          retry={{ label: fr.chat.retry, onClick: load }}
        />
      </RailPage>
    );
  }

  return (
    <RailPage activeSection="skills" className="gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <a
          href="/skills"
          className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fr.skills.back}
        </a>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-text">{skill.name}</h1>
        <p className="mt-1 text-sm text-subtle">{fr.skills.byAuthor(skill.authorDisplayName)}</p>
        <p className="mt-3 text-sm text-text-2">{skill.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skill.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-subtle"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <pre className="whitespace-pre-wrap rounded-card border border-border bg-surface-2 p-4 text-sm text-text">
        {skill.content}
      </pre>

      <div className="flex items-center gap-3">
        <span className="text-sm text-text-2">
          {fr.skills.averageStars(skill.averageStars ?? 0, skill.ratingCount)}
        </span>
        <div className="flex items-center gap-1" role="group" aria-label={fr.skills.rate}>
          {[1, 2, 3, 4, 5].map((stars) => (
            <IconButton
              key={stars}
              aria-label={starLabel(stars)}
              aria-pressed={myRating === stars}
              onClick={() => void handleRate(stars)}
              className={cn(myRating !== null && stars <= myRating && "text-primary")}
            >
              <Star
                className="size-4"
                aria-hidden="true"
                fill={myRating !== null && stars <= myRating ? "currentColor" : "none"}
              />
            </IconButton>
          ))}
        </div>
      </div>
      {actionError && (
        <p className="text-sm text-danger" role="alert">
          {actionError}
        </p>
      )}

      <Button variant="danger" onClick={() => setDeleteOpen(true)} className="self-start">
        <Trash2 className="size-4" aria-hidden="true" />
        {fr.skills.delete}
      </Button>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={fr.skills.delete}
        description={fr.skills.deleteConfirm}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            {fr.skills.cancel}
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()}>
            {fr.skills.delete}
          </Button>
        </div>
      </Dialog>
    </RailPage>
  );
}
