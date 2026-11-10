import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
import { Input } from "../components/ui/Input.js";
import { FormPage } from "../components/layout/FormPage.js";
import { createProject } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { createWithSlugFromTitle } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";
import { hasFieldErrors, validateFields, type FieldErrors } from "../lib/forms.js";
import { FormField } from "../components/ui/FormField.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";

function parseStack(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function NewProjectPage() {
  const { status } = useSession();
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [stack, setStack] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<"name" | "pitch" | "repoUrl">>({});

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = validateFields({
      name: { value: name, min: 2 },
      pitch: { value: pitch, min: 10 },
      repoUrl: { value: repoUrl },
    });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setSubmitting(true);
    try {
      const { project } = await createWithSlugFromTitle(name, "projet", (slug) =>
        createProject({
          slug,
          name,
          pitch,
          description,
          repoUrl,
          demoUrl: demoUrl.trim() ? demoUrl.trim() : null,
          stack: parseStack(stack),
        }),
      );
      navigate(`/projets/${project.slug}`);
    } catch {
      setError(fr.projects.createError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.projects.createTitle}
      activeSection="projets"
      backHref="/projets"
      submitLabel={fr.projects.create}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    >
      <FormField label={fr.projects.nameLabel} error={fieldErrors.name}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <FormField label={fr.projects.pitchLabel} error={fieldErrors.pitch}>
        <Input value={pitch} onChange={(event) => setPitch(event.target.value)} />
      </FormField>
      <CodeTextarea
        label={fr.projects.descriptionLabel}
        value={description}
        onValueChange={setDescription}
      />
      <FormField label={fr.projects.repoUrlLabel} error={fieldErrors.repoUrl}>
        <Input
          type="url"
          placeholder="https://github.com/..."
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
        />
      </FormField>
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
