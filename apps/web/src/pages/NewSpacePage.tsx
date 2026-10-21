import { useEffect, useState, type FormEvent } from "react";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { FormPage } from "../components/layout/FormPage.js";
import { createSpace } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { slugify } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";

export function NewSpacePage() {
  const { status } = useSession();
  const [name, setName] = useState("");
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
      const { space } = await createSpace({
        name: name.trim(),
        slug: slugify(name),
        visibility,
      });
      window.location.href = `/salons?space=${space.id}`;
    } catch {
      setError(fr.spaces.actionError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.spaces.createTitle}
      subtitle={fr.spaces.createSubtitle}
      activeSection="salons"
      backHref="/salons"
      submitLabel={fr.spaces.create}
      submitting={submitting}
      submitDisabled={!name.trim()}
      error={error}
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.spaces.nameLabel}
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
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
        <span className="text-xs text-subtle">{fr.spaces.visibilityHint}</span>
      </label>
    </FormPage>
  );
}
