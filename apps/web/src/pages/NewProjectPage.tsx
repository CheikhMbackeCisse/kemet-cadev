import { useEffect, useState, type FormEvent } from "react";
import { Input } from "../components/ui/Input.js";
import { Textarea } from "../components/ui/Textarea.js";
import { FormPage } from "../components/layout/FormPage.js";
import { createProject } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { slugify } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";

function parseStack(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function NewProjectPage() {
  const { status } = useSession();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [stack, setStack] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
  }, [status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
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
      window.location.href = `/projets/${slug}`;
    } catch {
      setError(fr.projects.createError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.projects.createTitle}
      subtitle={fr.projects.createSubtitle}
      activeSection="projets"
      backHref="/projets"
      submitLabel={fr.projects.create}
      submitting={submitting}
      submitDisabledReason={missingFieldsReason([
        [name, fr.projects.nameLabel],
        [slug, fr.projects.slugLabel],
        [pitch, fr.projects.pitchLabel],
        [repoUrl, fr.projects.repoUrlLabel],
      ])}
      error={error}
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.projects.nameLabel}
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSlug(slugify(event.target.value));
          }}
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
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
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
    </FormPage>
  );
}
