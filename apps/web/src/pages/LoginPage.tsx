import { usePreloadNext } from "../lib/navigation/usePreloadNext.js";
import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { SocialSignInButtons } from "../components/auth/SocialSignInButtons.js";
import { Input } from "../components/ui/Input.js";
import { signIn } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { landingPath } from "../lib/onboarding/steps.js";
import { FormField } from "../components/ui/FormField.js";
import { useFieldErrors } from "../lib/useFieldErrors.js";
import { requiredFieldErrors } from "../lib/forms.js";
import { fr } from "../i18n/fr.js";
import { ArrivalAction } from "../components/arrival/ArrivalAction.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";
import { PrivacyLine } from "../components/auth/PrivacyLine.js";

export function LoginPage() {
  usePreloadNext("/fil", "/completer-profil", "/bienvenue");
  const { status, onboarding, refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { formRef, errors: fieldErrors, report } = useFieldErrors<"email" | "password">();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "ready" || status === "incomplete")
      navigate(landingPath(status, onboarding), { replace: true });
  }, [status, onboarding]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!report(requiredFieldErrors({ email, password }))) return;
    setSubmitting(true);
    try {
      await signIn({ email, password });
      await refresh();
    } catch {
      setError(fr.auth.loginError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={fr.auth.loginTitle}>
      <div className="flex flex-col gap-3">
        <SocialSignInButtons callbackURL="/" />
        <form
          ref={formRef}
          noValidate
          className="relative flex flex-col gap-3"
          onSubmit={handleSubmit}
        >
          <FormField tone="inverse" label={fr.auth.emailLabel} error={fieldErrors.email}>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <FormField tone="inverse" label={fr.auth.passwordLabel} error={fieldErrors.password}>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <a
            href="/mot-de-passe-oublie"
            className="inline-flex min-h-control-mobile items-center self-end text-sm text-auth-text-muted underline underline-offset-2 hover:text-auth-text md:min-h-control"
          >
            {fr.auth.forgotPasswordLink}
          </a>
          <ArrivalAction>
            {error && (
              <p className="text-sm text-auth-danger" role="alert">
                {error}
              </p>
            )}
            <SubmitButton
              label={fr.auth.loginSubmit}
              variant="inverse"
              block
              loading={submitting}
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
