import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<"name" | "description" | "content">>(
    {},
  );

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = validateFields({
      name: { value: name, min: 3 },
      description: { value: description, min: 10 },
      content: { value: content },
    });
    setFieldErrors(errors);
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
      <FormField label={fr.skills.nameLabel} error={fieldErrors.name}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <FormField label={fr.skills.descriptionLabel} error={fieldErrors.description}>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      <CodeTextarea
        label={fr.skills.contentLabel}
        value={content}
        onValueChange={setContent}
        error={fieldErrors.content}
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
