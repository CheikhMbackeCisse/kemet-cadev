import { useEffect, useState } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { ChatApiError, getAuthConfig, signIn, signInWithGithub } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

export function LoginPage() {
  const { status, refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState(false);

  useEffect(() => {
    getAuthConfig()
      .then((config) => setGithubEnabled(config.githubEnabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "ready") window.location.href = "/fil";
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      await refresh();
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 403) setError(fr.auth.emailNotVerifiedError);
      else setError(fr.auth.loginError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={fr.auth.loginTitle} subtitle={fr.auth.loginSubtitle}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.emailLabel}
          <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.passwordLabel}
          <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <a href="/mot-de-passe-oublie" className="self-end text-xs text-link hover:underline">
          {fr.auth.forgotPasswordLink}
        </a>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button onClick={handleSubmit} loading={submitting} disabled={!email.trim() || !password}>
          {fr.auth.loginSubmit}
        </Button>
        {githubEnabled && (
          <>
            <div className="flex items-center gap-2 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" />
              {fr.auth.orSeparator}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="secondary" onClick={() => void signInWithGithub("/fil")}>
              {fr.auth.continueWithGithub}
            </Button>
          </>
        )}
        <p className="text-center text-sm text-subtle">
          {fr.auth.noAccountYet}{" "}
          <a href="/inscription" className="text-link hover:underline">
            {fr.auth.signupLink}
          </a>
        </p>
      </div>
    </AuthLayout>
  );
}
