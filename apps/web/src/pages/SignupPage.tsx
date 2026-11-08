import { useEffect, useState, type FormEvent } from "react";
import { DEMO_EMAIL_REJECTED_CODE, isDemoEmailAddress } from "@kemet/shared";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { SocialSignInButtons } from "../components/auth/SocialSignInButtons.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { ChatApiError, resendVerificationEmail, signIn, signUp } from "../lib/chat/api.js";
import { useToast } from "../components/ui/Toast.js";
import { useSession } from "../session/SessionProvider.js";
import { landingPath } from "../lib/onboarding/steps.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";

export function SignupPage() {
  const toast = useToast();
  const { status, onboarding, refresh } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const isDemoEmail = isDemoEmailAddress(email);

  useEffect(() => {
    if (status === "ready" || status === "incomplete") window.location.href = landingPath(status, onboarding);
  }, [status, onboarding]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp({ name, email, password });
      setAwaitingVerification(true);
    } catch (err) {
      if (err instanceof ChatApiError && (err.statusCode === 409 || err.statusCode === 422)) setError(fr.auth.emailAlreadyUsedError);
      else if (err instanceof ChatApiError && err.code === DEMO_EMAIL_REJECTED_CODE) setError(fr.auth.demoEmailError);
      else setError(fr.auth.signupError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetrySignIn() {
    setError(null);
    try {
      await signIn({ email, password });
      await refresh();
    } catch {
      setError(fr.auth.emailNotVerifiedError);
    }
  }

  async function handleResend() {
    try {
      await resendVerificationEmail(email);
      toast.show(fr.auth.verificationEmailResent, "success");
    } catch {
      toast.show(fr.auth.signupError, "danger");
    }
  }

  if (awaitingVerification) {
    return (
      <AuthLayout title={fr.auth.checkYourEmailTitle}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-2">{fr.auth.checkYourEmailBody(email)}</p>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="button" onClick={handleRetrySignIn}>
            {fr.auth.iVerifiedMyEmail}
          </Button>
          <Button type="button" variant="ghost" onClick={handleResend}>
            {fr.auth.resendVerificationEmail}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={fr.auth.signupTitle} subtitle={fr.auth.signupSubtitle}>
      <div className="flex flex-col gap-3">
        <SocialSignInButtons callbackURL="/" />
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.auth.nameLabel}
            <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 text-sm text-text-2">
              {fr.auth.emailLabel}
              <Input
                type="email"
                autoComplete="email"
                value={email}
                aria-invalid={isDemoEmail || undefined}
                aria-describedby={isDemoEmail ? "signup-email-error" : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {isDemoEmail && (
              <p id="signup-email-error" className="text-sm text-danger">
                {fr.auth.demoEmailError}
              </p>
            )}
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.auth.passwordLabel}
            <Input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <SubmitButton
            label={fr.auth.signupSubmit}
            loading={submitting}
            disabledReason={
              missingFieldsReason([
                [name, fr.auth.nameLabel],
                [email, fr.auth.emailLabel],
                [password, fr.auth.passwordLabel],
              ]) ??
              (isDemoEmail ? fr.auth.demoEmailReason : null) ??
              (password.length < 8 ? fr.auth.passwordTooShort : null)
            }
          />
        </form>
        <p className="text-center text-xs text-subtle">
          {fr.auth.signupPrivacyNotice}{" "}
          <a href="/confidentialite" className="text-link hover:underline">
            {fr.auth.signupPrivacyLink}
          </a>
        </p>
        <p className="text-center text-sm text-subtle">
          {fr.auth.alreadyHaveAccount}{" "}
          <a href="/connexion" className="text-link hover:underline">
            {fr.auth.loginLink}
          </a>
        </p>
      </div>
    </AuthLayout>
  );
}
