import { navigate } from "../lib/navigation/navigate.js";
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
import { FormField } from "../components/ui/FormField.js";
import { useFieldErrors } from "../lib/useFieldErrors.js";
import { requiredFieldErrors } from "../lib/forms.js";
import { fr } from "../i18n/fr.js";
import { ArrivalAction } from "../components/arrival/ArrivalAction.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";
import { PrivacyLine } from "../components/auth/PrivacyLine.js";

export function SignupPage() {
  const toast = useToast();
  const { status, onboarding, refresh } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { formRef, errors: fieldErrors, report } = useFieldErrors<"name" | "email" | "password">();
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const isDemoEmail = isDemoEmailAddress(email);

  useEffect(() => {
    if (status === "ready" || status === "incomplete")
      navigate(landingPath(status, onboarding), { replace: true });
  }, [status, onboarding]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = {
      ...requiredFieldErrors({ name, email }),
      ...(isDemoEmail ? { email: fr.auth.demoEmailError } : {}),
      ...(password.length < 8 ? { password: fr.auth.passwordTooShort } : {}),
    };
    if (!report(errors)) return;
    setSubmitting(true);
    try {
      await signUp({ name, email, password });
      setAwaitingVerification(true);
    } catch (err) {
      if (err instanceof ChatApiError && (err.statusCode === 409 || err.statusCode === 422))
        setError(fr.auth.emailAlreadyUsedError);
      else if (err instanceof ChatApiError && err.code === DEMO_EMAIL_REJECTED_CODE)
        setError(fr.auth.demoEmailError);
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
          <p className="text-sm">{fr.auth.checkYourEmailBody(email)}</p>
          {error && (
            <p className="text-sm text-auth-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="button" variant="inverse" onClick={handleRetrySignIn}>
            {fr.auth.iVerifiedMyEmail}
          </Button>
          <Button type="button" variant="inverse-ghost" onClick={handleResend}>
            {fr.auth.resendVerificationEmail}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={fr.auth.signupTitle}>
      <div className="flex flex-col gap-3">
        <SocialSignInButtons callbackURL="/" />
        <form
          ref={formRef}
          noValidate
          className="relative flex flex-col gap-3"
          onSubmit={handleSubmit}
        >
          <FormField tone="inverse" label={fr.auth.nameLabel} error={fieldErrors.name}>
            <Input
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField
            tone="inverse"
            label={fr.auth.emailLabel}
            error={fieldErrors.email ?? (isDemoEmail ? fr.auth.demoEmailError : null)}
          >
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
              autoComplete="new-password"
              placeholder={fr.auth.passwordPlaceholder}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <ArrivalAction>
            {error && (
              <p className="text-sm text-auth-danger" role="alert">
                {error}
              </p>
            )}
            <SubmitButton
              label={fr.auth.signupSubmit}
              variant="inverse"
              block
              loading={submitting}
            />
          </ArrivalAction>
        </form>
        <p className="text-center text-sm text-auth-text-muted">
          {fr.auth.alreadyHaveAccount}{" "}
          <a href="/connexion" className="font-medium text-auth-text underline underline-offset-2">
            {fr.auth.loginLink}
          </a>
        </p>
        <PrivacyLine />
      </div>
    </AuthLayout>
  );
}
