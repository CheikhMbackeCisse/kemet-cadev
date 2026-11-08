import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { MeResponse } from "@kemet/shared";
import { SocialProviderIcon } from "../../components/auth/SocialProviderIcon.js";
import { SettingsSubPage } from "../../components/settings/SettingsSubPage.js";
import { Badge } from "../../components/ui/Badge.js";
import { Button } from "../../components/ui/Button.js";
import { ErrorState } from "../../components/ui/ErrorState.js";
import { Input } from "../../components/ui/Input.js";
import { Skeleton } from "../../components/ui/Skeleton.js";
import { SubmitButton } from "../../components/ui/SubmitButton.js";
import { useToast } from "../../components/ui/Toast.js";
import {
  changePassword,
  ChatApiError,
  getAuthConfig,
  getMe,
  linkSocialProvider,
  unlinkSocialProvider,
  type SocialProvider,
} from "../../lib/chat/api.js";
import { missingFieldsReason } from "../../lib/forms.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";

const PAGE_PATH = "/parametres/compte";
const MIN_PASSWORD_LENGTH = 8;

const PROVIDERS: { id: SocialProvider; label: string; configKey: "githubEnabled" | "googleEnabled" | "linkedinEnabled" }[] = [
  { id: "github", label: fr.auth.providerGithub, configKey: "githubEnabled" },
  { id: "google", label: fr.auth.providerGoogle, configKey: "googleEnabled" },
  { id: "linkedin", label: fr.auth.providerLinkedin, configKey: "linkedinEnabled" },
];

interface AccountState {
  me: MeResponse;
  enabled: SocialProvider[];
}

export function AccountSettingsPage() {
  const { status } = useSession();
  const toast = useToast();
  const [state, setState] = useState<AccountState | null>(null);
  const [error, setError] = useState(false);
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null);

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  const load = useCallback(() => {
    setError(false);
    Promise.all([getMe(), getAuthConfig()])
      .then(([me, config]) =>
        setState({ me, enabled: PROVIDERS.filter((provider) => config[provider.configKey]).map((provider) => provider.id) }),
      )
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  // Retour du fournisseur après une liaison refusée (adresse déjà liée à un autre compte, par exemple).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      toast.show(fr.settings.linkError, "danger");
      window.history.replaceState(null, "", PAGE_PATH);
    }
  }, [toast]);

  async function link(provider: SocialProvider) {
    setBusyProvider(provider);
    try {
      await linkSocialProvider(provider, PAGE_PATH);
    } catch {
      toast.show(fr.settings.linkError, "danger");
      setBusyProvider(null);
    }
  }

  async function unlink(provider: SocialProvider) {
    setBusyProvider(provider);
    try {
      await unlinkSocialProvider(provider);
      load();
    } catch {
      toast.show(fr.settings.unlinkError, "danger");
    } finally {
      setBusyProvider(null);
    }
  }

  if (status !== "ready") return null;

  return (
    <SettingsSubPage title={fr.settings.accountSection}>
      {error ? (
        <ErrorState message={fr.settings.blockedError} retry={{ label: fr.chat.retry, onClick: load }} />
      ) : !state ? (
        <div className="flex max-w-xl flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          <section className="flex max-w-xl flex-col gap-1">
            <h2 className="text-md font-semibold text-text">{fr.settings.emailLabel}</h2>
            <p className="flex flex-wrap items-center gap-2 text-base text-text">
              <span className="break-all">{state.me.user.email}</span>
              <Badge tone={state.me.user.emailVerified ? "success" : "neutral"}>
                {state.me.user.emailVerified ? fr.settings.emailVerified : fr.settings.emailNotVerified}
              </Badge>
            </p>
          </section>

          <section className="flex max-w-xl flex-col gap-3">
            <h2 className="text-md font-semibold text-text">{fr.settings.passwordSection}</h2>
            {state.me.hasPassword ? (
              <PasswordForm />
            ) : (
              <p className="text-sm text-text-2">{fr.settings.noPassword}</p>
            )}
          </section>

          {state.enabled.length > 0 && (
            <section className="flex max-w-xl flex-col gap-3">
              <h2 className="text-md font-semibold text-text">{fr.settings.linkedSection}</h2>
              <ul className="flex flex-col divide-y divide-border">
                {PROVIDERS.filter((provider) => state.enabled.includes(provider.id)).map((provider) => {
                  const linked = state.me.socialProviders.includes(provider.id);
                  // Le seul moyen de connexion ne se délie pas : le serveur le
                  // refuserait aussi, on l'explique avant.
                  const lastWay = linked && !state.me.hasPassword && state.me.socialProviders.length === 1;
                  return (
                    <li key={provider.id} className="flex flex-col gap-1 py-3">
                      <div className="flex items-center gap-3">
                        <SocialProviderIcon provider={provider.id} />
                        <span className="flex-1 text-base text-text">{provider.label}</span>
                        {linked && <Badge tone="success">{fr.settings.linked}</Badge>}
                        <Button
                          variant="secondary"
                          loading={busyProvider === provider.id}
                          disabled={lastWay}
                          aria-label={linked ? fr.settings.unlinkLabel(provider.label) : fr.settings.linkLabel(provider.label)}
                          onClick={() => void (linked ? unlink(provider.id) : link(provider.id))}
                        >
                          {linked ? fr.settings.unlink : fr.settings.link}
                        </Button>
                      </div>
                      {lastWay && <p className="text-xs text-subtle">{fr.settings.unlinkLastRefused}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </SettingsSubPage>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast.show(fr.settings.passwordSaved, "success");
    } catch (err) {
      setError(err instanceof ChatApiError && err.statusCode === 400 ? fr.settings.passwordWrong : fr.settings.passwordError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex max-w-sm flex-col gap-3" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.settings.currentPasswordLabel}
        <Input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.settings.newPasswordLabel}
        <Input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <span className="text-xs text-subtle">{fr.settings.newPasswordHint}</span>
      </label>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <SubmitButton
        label={fr.settings.passwordSave}
        loading={submitting}
        disabledReason={
          missingFieldsReason([[currentPassword, fr.settings.currentPasswordLabel]]) ??
          (newPassword.length < MIN_PASSWORD_LENGTH ? fr.settings.passwordTooShort : null)
        }
      />
    </form>
  );
}
