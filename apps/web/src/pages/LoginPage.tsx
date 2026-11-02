import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { SocialSignInButtons } from "../components/auth/SocialSignInButtons.js";
import { Input } from "../components/ui/Input.js";
import { ChatApiError, signIn } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";

export function LoginPage() {
  const { status, refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "ready") window.location.href = "/fil";
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

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
    <AuthLayout
      title={fr.auth.loginTitle}
      subtitle={fr.auth.loginSubtitle}
      intro={
        <>
          <p className="text-xl font-bold text-auth-text">{fr.auth.landingHeadline}</p>
          <p className="text-sm text-auth-text-muted">{fr.auth.landingPitch}</p>
        </>
      }
      footer={
        <p className="text-center text-sm text-auth-text-muted">
          {fr.auth.landingVisitorIntro}{" "}
          <a href="/salons" className="font-medium text-auth-text underline underline-offset-2">
            {fr.auth.landingBrowseSpaces}
          </a>{" "}
          ·{" "}
          <a href="/fil" className="font-medium text-auth-text underline underline-offset-2">
            {fr.auth.landingBrowseFeed}
          </a>
        </p>
      }
    >
      <div className="flex flex-col gap-2">
        <SocialSignInButtons callbackURL="/fil" />
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.auth.emailLabel}
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.auth.passwordLabel}
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <a href="/mot-de-passe-oublie" className="self-end text-sm text-link hover:underline">
            {fr.auth.forgotPasswordLink}
          </a>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <SubmitButton
            label={fr.auth.loginSubmit}
            loading={submitting}
            disabledReason={missingFieldsReason([
              [email, fr.auth.emailLabel],
              [password, fr.auth.passwordLabel],
            ])}
          />
        </form>
        <p className="text-center text-sm text-subtle">
          {fr.auth.noAccountYet}{" "}
          <a href="/inscription" className="text-link hover:underline">
            {fr.auth.signupLink}
          </a>
        </p>
        <p className="text-center text-sm text-subtle">
          <a href="/confidentialite" className="text-link hover:underline">
            {fr.privacy.title}
          </a>
        </p>
      </div>
    </AuthLayout>
  );
}
