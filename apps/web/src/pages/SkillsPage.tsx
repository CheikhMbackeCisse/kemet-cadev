import { Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SkillSummary } from "@kemet/shared";
import { createSkill, listSkills } from "../lib/chat/api.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
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

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    listSkills()
      .then((page) => setSkills(page.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function handleCreate() {
    setCreateError(false);
    try {
      await createSkill({
        name,
        slug,
        description,
        content,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        visibility,
      });
      setCreateOpen(false);
      setName("");
      setSlug("");
      setDescription("");
      setContent("");
      setTags("");
      load();
    } catch {
      setCreateError(true);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">{fr.skills.title}</h1>
          <p className="text-sm text-subtle">{fr.skills.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button onClick={() => setCreateOpen(true)}>{fr.skills.createTitle}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={fr.skills.loadingError} retry={{ label: fr.chat.retry, onClick: load }} />
      ) : skills.length === 0 ? (
        <EmptyState icon={Star} message={fr.skills.noSkills} />
      ) : (
        <ul className="flex flex-col gap-3">
          {skills.map((skill) => (
            <li key={skill.id}>
              <a
                href={`/skills/${skill.slug}`}
                className="block rounded-card border border-border p-4 hover:bg-surface-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-text">{skill.name}</span>
                  <span className="flex items-center gap-1 text-xs text-subtle">
                    <Star className="size-3.5" aria-hidden="true" />
                    {fr.skills.averageStars(skill.averageStars ?? 0, skill.ratingCount)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-2">{skill.description}</p>
                <p className="mt-2 text-xs text-subtle">{fr.skills.byAuthor(skill.authorDisplayName)}</p>
              </a>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title={fr.skills.createTitle}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.skills.nameLabel}
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
            {fr.skills.slugLabel}
            <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
            <span className="text-xs text-subtle">{fr.skills.slugHint}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.skills.descriptionLabel}
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-16" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.skills.contentLabel}
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-40" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.skills.tagsLabel}
            <Input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.skills.visibilityLabel}
            <Select
              aria-label={fr.skills.visibilityLabel}
              value={visibility}
              onValueChange={(value) => setVisibility(value as "public" | "private")}
              options={[
                { value: "public", label: fr.skills.visibilityPublic },
                { value: "private", label: fr.skills.visibilityPrivate },
              ]}
            />
          </label>
          {createError && (
            <p className="text-sm text-danger" role="alert">
              {fr.skills.createError}
            </p>
          )}
          <Button onClick={handleCreate} disabled={!name.trim() || !slug.trim() || !description.trim() || !content.trim()}>
            {fr.skills.create}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
