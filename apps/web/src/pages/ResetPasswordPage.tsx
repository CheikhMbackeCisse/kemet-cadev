import { useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { resetPassword } from "../lib/chat/api.js";
import { fr } from "../i18n/fr.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";

function readToken(): string | null {
  return new URLSearchParams(window.location.search).get("token");
}

export function ResetPasswordPage() {
  const token = readToken();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
          <Button type="button" variant="inverse" onClick={() => (window.location.href = "/connexion")}>
            {fr.auth.loginSubmit}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={fr.auth.resetPasswordTitle}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-auth-text">
          {fr.auth.newPasswordLabel}
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
        </label>
        {error && (
          <p className="text-sm text-auth-danger" role="alert">
            {error}
          </p>
        )}
        <SubmitButton
          variant="inverse"
          label={fr.auth.resetPasswordSubmit}
          loading={submitting}
          disabledReason={password.length < 8 ? fr.auth.passwordTooShort : null}
        />
      </form>
    </AuthLayout>
  );
}
