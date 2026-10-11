import { useEffect, useState } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { Button } from "../components/ui/Button.js";
import { CountrySelect } from "../components/ui/CountrySelect.js";
import { Input } from "../components/ui/Input.js";
import { ChatApiError, updateMyProfile } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

export function CompleteProfilePage() {
  const { status, refresh } = useSession();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
    if (status === "ready") window.location.href = "/fil";
  }, [status]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await updateMyProfile({ handle: handle.toLowerCase(), displayName, country });
      await refresh();
      window.location.href = "/fil";
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 409) setError(fr.auth.handleAlreadyTakenError);
      else setError(fr.auth.completeProfileError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={fr.auth.completeProfileTitle} subtitle={fr.auth.completeProfileSubtitle}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.displayNameLabel}
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.handleLabel}
          <Input value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase())} />
          <span className="text-xs text-subtle">{fr.auth.handleHint}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.countryLabel}
          <CountrySelect aria-label={fr.auth.countryLabel} value={country} onValueChange={setCountry} />
        </label>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button onClick={handleSubmit} loading={submitting} disabled={!handle.trim() || !displayName.trim() || !country}>
          {fr.auth.completeProfileSubmit}
        </Button>
      </div>
    </AuthLayout>
  );
}
