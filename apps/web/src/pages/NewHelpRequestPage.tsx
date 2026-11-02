import { useEffect, useState, type FormEvent } from "react";
import type { HelpRequestKind } from "@kemet/shared";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Textarea } from "../components/ui/Textarea.js";
import { FormPage } from "../components/layout/FormPage.js";
import { createHelpRequest } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";

function parseStack(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function NewHelpRequestPage() {
  const { status } = useSession();
  // /projets/:slug/demandes/nouvelle
  const slug = window.location.pathname.split("/")[2] ?? "";
  const [kind, setKind] = useState<HelpRequestKind>("help");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
      await createHelpRequest(slug, {
        kind,
        title,
        description,
        stack: parseStack(stack),
      });
      window.location.href = `/projets/${slug}`;
    } catch {
      setError(fr.projects.helpRequestCreateError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.projects.createHelpRequestTitle}
      subtitle={fr.projects.createHelpRequestSubtitle}
      activeSection="projets"
      backHref={`/projets/${slug}`}
      submitLabel={fr.projects.create}
      submitting={submitting}
      submitDisabledReason={missingFieldsReason([
        [title, fr.projects.titleLabel],
        [description, fr.projects.descriptionLabel],
      ])}
      error={error}
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.projects.kindLabel}
        <Select
          aria-label={fr.projects.kindLabel}
          value={kind}
          onValueChange={(value) => setKind(value as HelpRequestKind)}
          options={[
            { value: "help", label: fr.projects.kindHelp },
            { value: "collaboration", label: fr.projects.kindCollaboration },
          ]}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.projects.titleLabel}
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.projects.descriptionLabel}
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.projects.stackLabel}
        <Input value={stack} onChange={(event) => setStack(event.target.value)} />
      </label>
    </FormPage>
  );
}
