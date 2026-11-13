import { usePreloadNext } from "../lib/navigation/usePreloadNext.js";
import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Input } from "../components/ui/Input.js";
import { ChatApiError, updateMyProfile } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { landingPath } from "../lib/onboarding/steps.js";
import { fr } from "../i18n/fr.js";
import { handleError, requiredFieldErrors } from "../lib/forms.js";
import { FormField } from "../components/ui/FormField.js";
import { useFieldErrors } from "../lib/useFieldErrors.js";
import { ArrivalAction } from "../components/arrival/ArrivalAction.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";

export function CompleteProfilePage() {
  usePreloadNext("/bienvenue", "/fil");
  const { status, onboarding, refresh } = useSession();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { formRef, errors: fieldErrors, report } = useFieldErrors<"displayName" | "handle">();

  useEffect(() => {
    if (status === "visitor") navigate("/connexion", { replace: true });
    if (status === "ready") navigate(landingPath(status, onboarding), { replace: true });
  }, [status, onboarding]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!report({ ...requiredFieldErrors({ displayName }), handle: handleError(handle) })) return;
    setSubmitting(true);
    try {
      await updateMyProfile({ handle: handle.toLowerCase(), displayName });
      // Sans rechargement : la session relue, l'effet du haut mène à
      // l'onboarding, sur le même fond.
      await refresh();
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 409)
        setError(fr.auth.handleAlreadyTakenError);
      else setError(fr.auth.completeProfileError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={fr.auth.completeProfileTitle}>
      <form
        ref={formRef}
        noValidate
        className="relative flex flex-col gap-3"
        onSubmit={handleSubmit}
      >
        <FormField tone="inverse" label={fr.auth.displayNameLabel} error={fieldErrors.displayName}>
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField tone="inverse" label={fr.auth.handleLabel} error={fieldErrors.handle}>
          <Input
            placeholder={fr.auth.handlePlaceholder}
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
          />
        </FormField>
        <ArrivalAction>
          {error && (
            <p className="text-sm text-auth-danger" role="alert">
              {error}
            </p>
          )}
          <SubmitButton
            variant="inverse"
            label={fr.auth.completeProfileSubmit}
            loading={submitting}
          />
        </ArrivalAction>
      </form>
    </AuthLayout>
  );
}
