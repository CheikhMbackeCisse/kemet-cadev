import { navigate } from "../lib/navigation/navigate.js";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { resetPassword } from "../lib/chat/api.js";
import { FormField } from "../components/ui/FormField.js";
import { useFieldErrors } from "../lib/useFieldErrors.js";
import { fr } from "../i18n/fr.js";
import { ArrivalAction } from "../components/arrival/ArrivalAction.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";

function readToken(): string | null {
  return new URLSearchParams(window.location.search).get("token");
}

export function ResetPasswordPage() {
  const token = readToken();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { formRef, errors: fieldErrors, report } = useFieldErrors<"password">();
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <AuthLayout title={fr.auth.resetPasswordTitle}>
        <p className="text-sm text-auth-danger" role="alert">
          {fr.auth.resetPasswordInvalidLink}
        </p>
      </AuthLayout>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!report(password.length < 8 ? { password: fr.auth.passwordTooShort } : {})) return;
    setSubmitting(true);
    try {
      await resetPassword(password, token!);
      setDone(true);
    } catch {
      setError(fr.auth.resetPasswordError);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title={fr.auth.resetPasswordTitle}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-auth-text">{fr.auth.resetPasswordSuccess}</p>
          <Button type="button" variant="inverse" onClick={() => navigate("/connexion")}>
            {fr.auth.loginSubmit}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={fr.auth.resetPasswordTitle}>
      <form
        ref={formRef}
        noValidate
        className="relative flex flex-col gap-3"
        onSubmit={handleSubmit}
      >
        <FormField tone="inverse" label={fr.auth.newPasswordLabel} error={fieldErrors.password}>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
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
            label={fr.auth.resetPasswordSubmit}
            loading={submitting}
          />
        </ArrivalAction>
      </form>
    </AuthLayout>
  );
}
