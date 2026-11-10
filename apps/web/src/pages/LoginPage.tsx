import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { SocialSignInButtons } from "../components/auth/SocialSignInButtons.js";
import { Input } from "../components/ui/Input.js";
import { ChatApiError, signIn } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { landingPath } from "../lib/onboarding/steps.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";
import { ArrivalAction } from "../components/arrival/ArrivalAction.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";
import { PrivacyLine } from "../components/auth/PrivacyLine.js";

export function LoginPage() {
  const { status, onboarding, refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "ready" || status === "incomplete")
      navigate(landingPath(status, onboarding), { replace: true });
  }, [status, onboarding]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      await refresh();
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 403)
        setError(fr.auth.emailNotVerifiedError);
      else setError(fr.auth.loginError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={fr.auth.loginTitle}>
      <div className="flex flex-col gap-3">
        <SocialSignInButtons callbackURL="/" />
        <form className="relative flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm">
            {fr.auth.emailLabel}
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {fr.auth.passwordLabel}
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <a
            href="/mot-de-passe-oublie"
            className="inline-flex min-h-control-mobile items-center self-end text-sm text-auth-text-muted underline underline-offset-2 hover:text-auth-text md:min-h-control"
          >
            {fr.auth.forgotPasswordLink}
          </a>
          {error && (
            <p className="text-sm text-auth-danger" role="alert">
              {error}
            </p>
          )}
          <ArrivalAction>
            <SubmitButton
              label={fr.auth.loginSubmit}
              variant="inverse"
              block
              loading={submitting}
              disabledReason={missingFieldsReason([
                [email, fr.auth.emailLabel],
                [password, fr.auth.passwordLabel],
              ])}
            />
          </ArrivalAction>
        </form>
        <p className="text-center text-sm text-auth-text-muted">
          {fr.auth.noAccountYet}{" "}
          <a
            href="/inscription"
            className="font-medium text-auth-text underline underline-offset-2"
          >
            {fr.auth.signupLink}
          </a>
        </p>
        <PrivacyLine />
      </div>
    </AuthLayout>
  );
}
