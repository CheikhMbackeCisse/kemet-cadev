import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState, type FormEvent } from "react";
import type { MeResponse } from "@kemet/shared";
import { FormPage } from "../components/layout/FormPage.js";
import { Button } from "../components/ui/Button.js";
import { Checkbox } from "../components/ui/Checkbox.js";
import { Input } from "../components/ui/Input.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { SocialProviderIcon } from "../components/auth/SocialProviderIcon.js";
import {
  ChatApiError,
  deleteMyAccount,
  getMe,
  signInWithSocialProvider,
  type SocialProvider,
} from "../lib/chat/api.js";
import { clearChannelDrafts } from "../lib/chat/useChannelDraft.js";
import { useAccountExport } from "../lib/useAccountExport.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

const PAGE_PATH = "/parametres/supprimer-mon-compte";
const REAUTHENTICATED_PARAM = "reconnecte";

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  github: fr.auth.providerGithub,
  google: fr.auth.providerGoogle,
  linkedin: fr.auth.providerLinkedin,
};

function isSocialProvider(value: string): value is SocialProvider {
  return value in PROVIDER_LABELS;
}

function errorMessage(caught: unknown): string {
  if (!(caught instanceof ChatApiError)) return fr.accountDeletion.error;
  if (caught.code === "wrong_password") return fr.accountDeletion.wrongPassword;
  if (caught.code === "reauthentication_required")
    return fr.accountDeletion.reauthenticationRequired;
  if (caught.statusCode === 429) return fr.accountDeletion.rateLimited;
  return fr.accountDeletion.error;
}

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-text-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Confirmation de la suppression du compte, sur sa propre page (ADR 0023). */
export function DeleteAccountPage() {
  const { status } = useSession();
  const { exporting, exportAccount } = useAccountExport();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reauthenticated, setReauthenticated] = useState(
    () => new URLSearchParams(window.location.search).get(REAUTHENTICATED_PARAM) === "1",
  );

  function loadMe() {
    setLoadFailed(false);
    getMe()
      .then(setMe)
      .catch(() => setLoadFailed(true));
  }

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
    if (status !== "ready" && status !== "incomplete") return;
    loadMe();
  }, [status]);

  const providers = (me?.socialProviders ?? []).filter(isSocialProvider);
  const needsPassword = me?.hasPassword ?? false;
  const disabledReason = loadFailed
    ? fr.accountDeletion.loadError
    : !me
      ? fr.accountDeletion.loading
      : !confirmed
        ? fr.accountDeletion.missingConfirmation
        : needsPassword && !password
          ? fr.accountDeletion.missingPassword
          : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await deleteMyAccount(needsPassword ? password : undefined);
      clearChannelDrafts();
      window.location.href = "/";
    } catch (caught) {
      if (caught instanceof ChatApiError && caught.code === "reauthentication_required") {
        setReauthenticated(false);
      }
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.accountDeletion.title}
      subtitle={fr.accountDeletion.subtitle}
      activeSection="parametres"
      backHref="/parametres"
      submitLabel={fr.accountDeletion.submit}
      submitVariant="danger"
      submitting={submitting}
      submitDisabled={!me}
      submitDisabledReason={disabledReason}
      error={error}
      onSubmit={handleSubmit}
    >
      <section className="flex flex-col gap-2">
        <h2 className="text-md font-semibold text-text">{fr.accountDeletion.whatGoes}</h2>
        <List items={fr.accountDeletion.goes} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-md font-semibold text-text">{fr.accountDeletion.whatStays}</h2>
        <List items={fr.accountDeletion.stays} />
      </section>

      <div className="flex flex-col items-start gap-1">
        <span className="text-sm text-text-2">{fr.accountDeletion.exportFirst}</span>
        <Button
          type="button"
          variant="secondary"
          loading={exporting}
          onClick={() => void exportAccount()}
        >
          {fr.settings.exportLink}
        </Button>
      </div>

      {!me && !loadFailed && (
        <div className="flex flex-col gap-1" role="status" aria-label={fr.accountDeletion.loading}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-control max-md:h-control-mobile" />
        </div>
      )}

      {loadFailed && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-danger">{fr.accountDeletion.loadError}</p>
          <Button type="button" variant="secondary" onClick={loadMe}>
            {fr.accountDeletion.retry}
          </Button>
        </div>
      )}

      {me && needsPassword && (
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.accountDeletion.passwordLabel}
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      )}

      {me && !needsPassword && reauthenticated && (
        <p className="text-sm text-text-2" role="status">
          {fr.accountDeletion.reauthenticated}
        </p>
      )}

      {me && !needsPassword && !reauthenticated && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-2">{fr.accountDeletion.reauthenticate}</p>
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant="secondary"
                onClick={() =>
                  void signInWithSocialProvider(provider, `${PAGE_PATH}?${REAUTHENTICATED_PARAM}=1`)
                }
              >
                <SocialProviderIcon provider={provider} />
                {fr.accountDeletion.reauthenticateWith(PROVIDER_LABELS[provider])}
              </Button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-text">
        <Checkbox checked={confirmed} onCheckedChange={setConfirmed} className="mt-0.5" />
        {fr.accountDeletion.confirmLabel}
      </label>
    </FormPage>
  );
}
