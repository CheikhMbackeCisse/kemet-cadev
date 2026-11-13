import { usePreloadNext } from "../lib/navigation/usePreloadNext.js";
import { navigate } from "../lib/navigation/navigate.js";
import { Check, X } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { AuthLayout } from "../components/auth/AuthLayout.js";
import { HandleInput } from "../components/auth/HandleInput.js";
import { ProfilePreviewCard } from "../components/auth/ProfilePreviewCard.js";
import { Input } from "../components/ui/Input.js";
import { ChatApiError, updateMyProfile } from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { landingPath } from "../lib/onboarding/steps.js";
import { fr } from "../i18n/fr.js";
import { handleError, requiredFieldErrors } from "../lib/forms.js";
import { FormField } from "../components/ui/FormField.js";
import { useFieldErrors } from "../lib/useFieldErrors.js";
import { ArrivalAction } from "../components/arrival/ArrivalAction.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";
import { handleFromName } from "../lib/slugify.js";
import { useHandleAvailability, type HandleStatus } from "../lib/useHandleAvailability.js";
import { readIntroAnswers } from "../lib/intro/introStorage.js";
import { describeIdentity } from "../lib/profileIdentity.js";

/** Adresse du profil sous le champ, et ce que le serveur dit de l'identifiant. */
function HandlePreview({ id, handle, status }: { id: string; handle: string; status: HandleStatus }) {
  const label =
    status === "available"
      ? fr.auth.handleAvailable
      : status === "taken"
        ? fr.auth.handleTakenShort
        : status === "reserved"
          ? fr.auth.handleReservedShort
          : null;
  return (
    <p id={id} className="flex min-w-0 items-center gap-2 text-sm text-auth-text-muted">
      <span className="min-w-0 truncate font-mono text-xs">
        {window.location.host}/u/{handle || fr.auth.handleExample}
      </span>
      {label && (
        <span
          aria-live="polite"
          className={
            status === "available"
              ? "flex shrink-0 items-center gap-1 font-medium text-auth-success"
              : "flex shrink-0 items-center gap-1 font-medium text-auth-danger"
          }
        >
          {status === "available" ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <X className="size-4" aria-hidden="true" />
          )}
          {label}
        </span>
      )}
    </p>
  );
}

export function CompleteProfilePage() {
  usePreloadNext("/bienvenue", "/fil");
  const { status, onboarding, refresh, user } = useSession();
  const [displayName, setDisplayName] = useState(() => user?.name ?? "");
  const [handle, setHandle] = useState(() => handleFromName(user?.name ?? ""));
  // Tant que la personne n'a pas touché à son @, il suit son nom.
  const [handleEdited, setHandleEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { formRef, errors: fieldErrors, report } = useFieldErrors<"displayName" | "handle">();
  const availability = useHandleAvailability(handle);
  const previewId = useId();
  const [identity] = useState(() => {
    const { role } = readIntroAnswers();
    return role ? describeIdentity({ role, workMode: null, organization: null }) : null;
  });

  useEffect(() => {
    if (status === "visitor") navigate("/connexion", { replace: true });
    if (status === "ready") navigate(landingPath(status, onboarding), { replace: true });
  }, [status, onboarding]);

  // La session arrive parfois après le premier affichage : le nom donné à
  // l'inscription (ou par GitHub, Google, LinkedIn) remplit alors le champ.
  useEffect(() => {
    if (!user?.name) return;
    setDisplayName((current) => current || user.name);
    if (!handleEdited) setHandle((current) => current || handleFromName(user.name));
  }, [user?.name, handleEdited]);

  function changeName(value: string) {
    setDisplayName(value);
    if (!handleEdited) setHandle(handleFromName(value));
  }

  function changeHandle(value: string) {
    setHandleEdited(true);
    setHandle(value.toLowerCase().replace(/^@+/, ""));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const takenError = availability === "taken" ? fr.auth.handleAlreadyTakenError : undefined;
    if (
      !report({
        ...requiredFieldErrors({ displayName }),
        handle: handleError(handle) ?? takenError,
      })
    )
      return;
    setSubmitting(true);
    try {
      await updateMyProfile({ handle, displayName: displayName.trim() });
      // Sans rechargement : la session relue, l'effet du haut mène à
      // l'onboarding, sur le même fond.
      await refresh();
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 409)
        report({ handle: fr.auth.handleAlreadyTakenError });
      else setError(fr.auth.completeProfileError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={fr.auth.completeProfileTitle} decor="universe">
      <form
        ref={formRef}
        noValidate
        className="relative flex flex-col gap-3"
        onSubmit={handleSubmit}
      >
        <ProfilePreviewCard name={displayName} handle={handle} identity={identity} />
        <FormField tone="inverse" label={fr.auth.yourNameLabel} error={fieldErrors.displayName}>
          <Input
            value={displayName}
            placeholder={fr.auth.yourNamePlaceholder}
            autoComplete="name"
            onChange={(event) => changeName(event.target.value)}
            autoFocus
          />
        </FormField>
        <div className="flex flex-col gap-1">
          <FormField tone="inverse" label={fr.auth.yourHandleLabel} error={fieldErrors.handle}>
            <HandleInput
              value={handle}
              placeholder={fr.auth.handleExample}
              aria-describedby={previewId}
              onChange={(event) => changeHandle(event.target.value)}
            />
          </FormField>
          <HandlePreview id={previewId} handle={handle} status={availability} />
        </div>
        <ArrivalAction>
          {error && (
            <p className="text-sm text-auth-danger" role="alert">
              {error}
            </p>
          )}
          <SubmitButton
            variant="inverse"
            block
            label={fr.auth.completeProfileSubmit}
            loading={submitting}
          />
        </ArrivalAction>
      </form>
    </AuthLayout>
  );
}
