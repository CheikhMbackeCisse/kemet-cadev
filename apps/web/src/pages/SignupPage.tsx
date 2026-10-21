import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { SocialSignInButtons } from "../components/auth/SocialSignInButtons.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { ChatApiError, resendVerificationEmail, signIn, signUp } from "../lib/chat/api.js";
import { useToast } from "../components/ui/Toast.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

export function SignupPage() {
  const toast = useToast();
  const { status, refresh } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  useEffect(() => {
    if (status === "ready") window.location.href = "/fil";
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp({ name, email, password });
      setAwaitingVerification(true);
    } catch (err) {
      if (err instanceof ChatApiError && (err.statusCode === 409 || err.statusCode === 422)) setError(fr.auth.emailAlreadyUsedError);
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
        <SocialSignInButtons callbackURL="/fil" />
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.auth.nameLabel}
            <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.auth.emailLabel}
            <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.auth.passwordLabel}
            <Input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={submitting} disabled={!name.trim() || !email.trim() || password.length < 8}>
            {fr.auth.signupSubmit}
          </Button>
        </form>
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
