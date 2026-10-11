import { FolderGit2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ProjectSummary } from "@kemet/shared";
import { createProject, listProjects } from "../lib/chat/api.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Input } from "../components/ui/Input.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Textarea } from "../components/ui/Textarea.js";
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

function parseStack(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [stack, setStack] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    listProjects()
      .then((page) => setProjects(page.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function handleCreate() {
    setCreateError(null);
    try {
      await createProject({
        slug,
        name,
        pitch,
        description,
        repoUrl,
        demoUrl: demoUrl.trim() ? demoUrl.trim() : null,
        stack: parseStack(stack),
      });
      setCreateOpen(false);
      setName("");
      setSlug("");
      setPitch("");
      setDescription("");
      setRepoUrl("");
      setDemoUrl("");
      setStack("");
      load();
    } catch {
      setCreateError(fr.projects.createError);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div>
          <h1 className="text-lg font-semibold text-text">{fr.projects.title}</h1>
          <p className="text-sm text-subtle">{fr.projects.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="/salons"
            className="inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
          >
            {fr.projects.salonsLink}
          </a>
          <Button onClick={() => setCreateOpen(true)}>{fr.projects.createTitle}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={fr.projects.loadingError} retry={{ label: fr.chat.retry, onClick: load }} />
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderGit2} message={fr.projects.noProjects} action={{ label: fr.projects.createTitle, onClick: () => setCreateOpen(true) }} />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <a href={`/projets/${project.slug}`} className="block rounded-card border border-border p-4 hover:bg-surface-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-text">{project.name}</span>
                  <span className="text-xs text-subtle">{fr.projects.openHelpRequests(project.openHelpRequestCount)}</span>
                </div>
                <p className="mt-1 text-sm text-text-2">{project.pitch}</p>
                {project.stack.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {project.stack.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-subtle">{fr.projects.byOwner(project.ownerDisplayName)}</p>
              </a>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title={fr.projects.createTitle}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.projects.nameLabel}
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
            {fr.projects.slugLabel}
            <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
            <span className="text-xs text-subtle">{fr.projects.slugHint}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.projects.pitchLabel}
            <Input value={pitch} onChange={(event) => setPitch(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.projects.descriptionLabel}
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.projects.repoUrlLabel}
            <Input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.projects.demoUrlLabel}
            <Input value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.projects.stackLabel}
            <Input value={stack} onChange={(event) => setStack(event.target.value)} />
          </label>
          {createError && (
            <p className="text-sm text-danger" role="alert">
              {createError}
            </p>
          )}
          <Button onClick={handleCreate} disabled={!name.trim() || !slug.trim() || !pitch.trim() || !repoUrl.trim()}>
            {fr.projects.create}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
