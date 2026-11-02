import { useEffect, useState, type FormEvent } from "react";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Textarea } from "../components/ui/Textarea.js";
import { FormPage } from "../components/layout/FormPage.js";
import { createSkill } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { slugify } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";

export function NewSkillPage() {
  const { status } = useSession();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
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
      window.location.href = "/skills";
    } catch {
      setError(fr.skills.createError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.skills.createTitle}
      subtitle={fr.skills.createSubtitle}
      activeSection="skills"
      backHref="/skills"
      submitLabel={fr.skills.create}
      submitting={submitting}
      submitDisabledReason={missingFieldsReason([
        [name, fr.skills.nameLabel],
        [slug, fr.skills.slugLabel],
        [description, fr.skills.descriptionLabel],
        [content, fr.skills.contentLabel],
      ])}
      error={error}
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.skills.nameLabel}
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSlug(slugify(event.target.value));
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.skills.slugLabel}
        <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
        <span className="text-xs text-subtle">{fr.skills.slugHint}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.skills.descriptionLabel}
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.skills.contentLabel}
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
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
    </FormPage>
  );
}
