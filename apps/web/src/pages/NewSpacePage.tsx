import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { FormPage } from "../components/layout/FormPage.js";
import { createSpace } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { slugify } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";
import { hasFieldErrors, requiredFieldErrors, type FieldErrors } from "../lib/forms.js";
import { FormField } from "../components/ui/FormField.js";

export function NewSpacePage() {
  const { status } = useSession();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<"name">>({});

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = requiredFieldErrors({ name });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setSubmitting(true);
    try {
      const { space } = await createSpace({
        name: name.trim(),
        slug: slugify(name),
        visibility,
      });
      navigate(`/salons?space=${space.id}`);
    } catch {
      setError(fr.spaces.actionError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.spaces.createTitle}
      activeSection="salons"
      backHref="/salons"
      submitLabel={fr.spaces.create}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    >
      <FormField label={fr.spaces.nameLabel} error={fieldErrors.name}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.spaces.visibilityLabel}
        <Select
          aria-label={fr.spaces.visibilityLabel}
          value={visibility}
          onValueChange={(value) => setVisibility(value as "public" | "private")}
          options={[
            { value: "public", label: fr.spaces.visibilityPublic },
            { value: "private", label: fr.spaces.visibilityPrivate },
          ]}
        />
      </label>
    </FormPage>
  );
}
