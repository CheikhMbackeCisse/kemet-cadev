import { navigate } from "../lib/navigation/navigate.js";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ProjectSummary, Submission } from "@kemet/shared";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { FormPage } from "../components/layout/FormPage.js";
import {
  ChatApiError,
  createSubmission,
  getMe,
  listProjects,
  listSubmissions,
  updateSubmission,
} from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { hasFieldErrors, validateFields, type FieldErrors } from "../lib/forms.js";
import { FormField } from "../components/ui/FormField.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";

/**
 * Soumettre un projet a une competition, ou modifier une soumission existante
 * quand l'URL porte `?modifier=<id>`. Les deux cas partagent le meme
 * formulaire : seul le choix du projet disparait en modification, le projet
 * d'une soumission ne pouvant plus changer.
 */
export function SubmitProjectPage() {
  const { status } = useSession();
  // /competitions/:slug/soumettre
  // Lu une seule fois : pendant un retour, la page reste affichée alors que
  // l'adresse a déjà changé.
  const [slug] = useState(() => window.location.pathname.split("/")[2] ?? "");
  const editingId = new URLSearchParams(window.location.search).get("modifier");

  const [myProjects, setMyProjects] = useState<ProjectSummary[]>([]);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<"projectId" | "title" | "pitch" | "repoUrl">
  >({});

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  const load = useCallback(async () => {
    setLoading(true);
    if (editingId) {
      const result = await listSubmissions(slug);
      const found = result.items.find((item) => item.id === editingId) ?? null;
      if (found) {
        setEditing(found);
        setTitle(found.title);
        setPitch(found.pitch);
        setDescription(found.description ?? "");
        setRepoUrl(found.repoUrl ?? "");
        setDemoUrl(found.demoUrl ?? "");
      }
    } else {
      const me = await getMe();
      if (me.profile) {
        const page = await listProjects();
        setMyProjects(page.items.filter((project) => project.ownerId === me.profile!.id));
      }
    }
    setLoading(false);
  }, [slug, editingId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = validateFields({
      projectId: { value: editing ? "-" : projectId },
      title: { value: title, min: 2 },
      pitch: { value: pitch, min: 10 },
      repoUrl: { value: repoUrl },
    });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setSubmitting(true);
    try {
      if (editing) {
        await updateSubmission(editing.id, {
          title,
          pitch,
          description,
          repoUrl,
          demoUrl: demoUrl.trim() ? demoUrl.trim() : null,
        });
      } else {
        await createSubmission(slug, {
          projectId,
          title,
          pitch,
          description,
          repoUrl,
          demoUrl: demoUrl.trim() ? demoUrl.trim() : null,
        });
      }
      navigate(`/competitions/${slug}`);
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : fr.competitions.submitProjectError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={editingId ? fr.competitions.editSubmissionTitle : fr.competitions.submitProjectTitle}
      activeSection="competitions"
      backHref={`/competitions/${slug}`}
      submitLabel={
        editingId ? fr.competitions.editSubmissionSubmit : fr.competitions.submitProjectSubmit
      }
      submitting={submitting}
      submitDisabled={loading || (!editingId && myProjects.length === 0)}
      error={error}
      onSubmit={handleSubmit}
    >
      {!editingId &&
        (loading ? null : myProjects.length === 0 ? (
          <p className="text-sm text-subtle">{fr.competitions.noOwnProjects}</p>
        ) : (
          <FormField label={fr.competitions.projectLabel} error={fieldErrors.projectId}>
            <Select
              value={projectId}
              onValueChange={setProjectId}
              options={myProjects.map((project) => ({ value: project.id, label: project.name }))}
            />
          </FormField>
        ))}
      <FormField label={fr.competitions.titleLabel} error={fieldErrors.title}>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </FormField>
      <FormField label={fr.competitions.pitchLabel} error={fieldErrors.pitch}>
        <Input value={pitch} onChange={(event) => setPitch(event.target.value)} />
      </FormField>
      <CodeTextarea
        label={fr.competitions.descriptionLabel}
        value={description}
        onValueChange={setDescription}
      />
      <FormField label={fr.competitions.repoUrlLabel} error={fieldErrors.repoUrl}>
        <Input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
      </FormField>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.competitions.demoUrlLabel}
        <Input value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} />
      </label>
    </FormPage>
  );
}
