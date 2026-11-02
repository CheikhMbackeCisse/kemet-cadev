import { useEffect, useState, type FormEvent } from "react";
import type { ProfileRole } from "@kemet/shared";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { updateMyProfile } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";

const ROLE_OPTIONS: { value: ProfileRole; label: string }[] = [
  { value: "developer", label: fr.auth.roleDeveloper },
  { value: "designer", label: fr.auth.roleDesigner },
  { value: "hr", label: fr.auth.roleHr },
  { value: "student", label: fr.auth.roleStudent },
  { value: "project_manager", label: fr.auth.roleProjectManager },
  { value: "other", label: fr.auth.roleOther },
];

export function RolePage() {
  const { status } = useSession();
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  if (status !== "ready") return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await updateMyProfile({ role: role as ProfileRole, title: specialty.trim() || null });
      window.location.href = "/fil";
    } catch {
      setError(fr.auth.roleStepError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={fr.auth.roleStepTitle}
      subtitle={fr.auth.roleStepSubtitle}
      footer={
        <p className="text-center text-sm">
          <a href="/fil" className="text-link hover:underline">
            {fr.auth.roleStepSkip}
          </a>
        </p>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.roleLabel}
          <Select
            aria-label={fr.auth.roleLabel}
            value={role}
            onValueChange={setRole}
            options={ROLE_OPTIONS}
            placeholder={fr.auth.roleSelectPlaceholder}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.specialtyLabel}
          <Input
            placeholder={fr.auth.specialtyPlaceholder}
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
          />
        </label>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <SubmitButton
          label={fr.auth.roleStepContinue}
          loading={submitting}
          disabledReason={role ? null : fr.auth.roleStepRequired}
        />
      </form>
    </AuthLayout>
  );
}
