import { navigate } from "../lib/navigation/navigate.js";
import { FileUp } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "../components/ui/Button.js";
import { Tabs } from "../components/ui/Tabs.js";
import { RichText } from "../components/content/RichText.js";
import { readSkillFile } from "../lib/skills/skillFile.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Textarea } from "../components/ui/Textarea.js";
import { FormPage } from "../components/layout/FormPage.js";
import { createSkill } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { createWithSlugFromTitle } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";
import { hasFieldErrors, validateFields, type FieldErrors } from "../lib/forms.js";
import { FormField } from "../components/ui/FormField.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";
import { BeginnerCheckbox } from "../components/beginners/BeginnerCheckbox.js";

export function NewSkillPage() {
  const { status } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isBeginner, setIsBeginner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contentView, setContentView] = useState<"write" | "preview">("write");
  const [importedName, setImportedName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<"name" | "description" | "content">>(
    {},
  );

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await readSkillFile(file);
    if (typeof result === "string") {
      setImportError(fr.skills.importErrors[result]);
      return;
    }
    setImportError(null);
    setImportedName(file.name);
    if (result.name) setName(result.name);
    if (result.description) setDescription(result.description);
    setContent(result.content);
    // On relit ce qui vient d'un fichier avant de le publier.
    setContentView("preview");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = validateFields({
      name: { value: name, min: 3 },
      description: { value: description, min: 10 },
      content: { value: content },
    });
    setFieldErrors(errors);
    if (errors.content) setContentView("write");
    if (hasFieldErrors(errors)) return;
    setSubmitting(true);
    try {
      await createWithSlugFromTitle(name, "skill", (slug) =>
        createSkill({
          name,
          slug,
          description,
          content,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          visibility,
          isBeginner,
        }),
      );
      navigate("/skills");
    } catch {
      setError(fr.skills.createError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.skills.createTitle}
      activeSection="skills"
      backHref="/skills"
      submitLabel={fr.skills.create}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col items-start gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void handleFile(event)}
        />
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          <FileUp className="size-4" aria-hidden="true" />
          {fr.skills.importFile}
        </Button>
        {importError ? (
          <p role="alert" className="text-sm text-danger">
            {importError}
          </p>
        ) : (
          importedName && (
            <p role="status" className="text-sm text-muted">
              {fr.skills.importedFile(importedName)}
            </p>
          )
        )}
      </div>
      <FormField label={fr.skills.nameLabel} error={fieldErrors.name}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <FormField label={fr.skills.descriptionLabel} error={fieldErrors.description}>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      <Tabs
        value={contentView}
        onValueChange={(value) => setContentView(value as "write" | "preview")}
        items={[
          {
            value: "write",
            label: fr.skills.contentWrite,
            content: (
              <CodeTextarea
                label={fr.skills.contentLabel}
                value={content}
                onValueChange={setContent}
                error={fieldErrors.content}
              />
            ),
          },
          {
            value: "preview",
            label: fr.skills.contentPreview,
            content: content.trim() ? (
              <div className="max-h-[60vh] overflow-y-auto rounded-card border border-border p-4">
                <RichText source={content} className="text-base" />
              </div>
            ) : (
              <p className="text-sm text-muted">{fr.skills.previewEmpty}</p>
            ),
          },
        ]}
      />
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
      <BeginnerCheckbox
        checked={isBeginner}
        onCheckedChange={setIsBeginner}
        label={fr.beginners.skillCheckbox}
      />
    </FormPage>
  );
}
