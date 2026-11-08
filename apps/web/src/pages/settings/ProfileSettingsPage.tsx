import { useEffect, useState, type FormEvent } from "react";
import type { ProfileRole } from "@kemet/shared";
import { SettingsSubPage } from "../../components/settings/SettingsSubPage.js";
import { SuspendedBanner } from "../../components/shell/SuspendedBanner.js";
import { CountrySelect } from "../../components/ui/CountrySelect.js";
import { Input } from "../../components/ui/Input.js";
import { Select } from "../../components/ui/Select.js";
import { SubmitButton } from "../../components/ui/SubmitButton.js";
import { Textarea } from "../../components/ui/Textarea.js";
import { useToast } from "../../components/ui/Toast.js";
import { ChatApiError, updateMyProfile } from "../../lib/chat/api.js";
import { missingFieldsReason } from "../../lib/forms.js";
import { PROFILE_ROLE_OPTIONS } from "../../lib/profileRoles.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";

const ROLE_OPTIONS = [{ value: "none", label: fr.auth.roleNone }, ...PROFILE_ROLE_OPTIONS];

export function ProfileSettingsPage() {
  const { status, profile, isSuspended, refresh } = useSession();
  const toast = useToast();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("none");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  useEffect(() => {
    if (!profile) return;
    setHandle(profile.handle);
    setDisplayName(profile.displayName);
    setCountry(profile.country);
    setRole(profile.role ?? "none");
    setSpecialty(profile.title ?? "");
    setBio(profile.bio ?? "");
    setGithubUrl(profile.githubUrl ?? "");
  }, [profile]);

  if (status !== "ready" || !profile) return null;

  const githubInvalid = githubUrl.trim() !== "" && !/^https:\/\/\S+$/.test(githubUrl.trim());

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await updateMyProfile({
        handle: handle.toLowerCase(),
        displayName,
        // Un pays jamais choisi (onboarding passé) reste vide sans bloquer le reste.
        ...(country && { country }),
        role: role === "none" ? null : (role as ProfileRole),
        title: specialty.trim() || null,
        bio: bio.trim() || null,
        githubUrl: githubUrl.trim() || null,
      });
      await refresh();
      toast.show(fr.settings.saved, "success");
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 409) setError(fr.auth.handleAlreadyTakenError);
      else setError(fr.settings.saveError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSubPage title={fr.settings.profileSection}>
      {isSuspended && <SuspendedBanner />}
      <form className="flex max-w-sm flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.displayNameLabel}
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={isSuspended} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.handleLabel}
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
            disabled={isSuspended}
          />
          <span className="text-xs text-subtle">{fr.auth.handleHint}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.countryLabel}
          <CountrySelect
            aria-label={fr.auth.countryLabel}
            value={country}
            onValueChange={setCountry}
            placeholder={fr.auth.countrySelectPlaceholder}
            disabled={isSuspended}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.roleLabel}
          <Select
            aria-label={fr.auth.roleLabel}
            value={role}
            onValueChange={setRole}
            options={ROLE_OPTIONS}
            disabled={isSuspended}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.auth.specialtyLabel}
          <Input
            placeholder={fr.auth.specialtyPlaceholder}
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
            disabled={isSuspended}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.settings.bioLabel}
          <Textarea
            variant="form"
            maxLength={500}
            placeholder={fr.settings.bioPlaceholder}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            disabled={isSuspended}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.settings.githubLabel}
          <Input
            type="url"
            inputMode="url"
            placeholder={fr.settings.githubPlaceholder}
            value={githubUrl}
            onChange={(event) => setGithubUrl(event.target.value)}
            disabled={isSuspended}
          />
        </label>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <SubmitButton
          label={fr.settings.save}
          loading={submitting}
          disabledReason={
            isSuspended
              ? fr.common.suspendedCannotSubmit
              : githubInvalid
                ? fr.settings.githubInvalid
                : missingFieldsReason([
                    [handle, fr.auth.handleLabel],
                    [displayName, fr.auth.displayNameLabel],
                  ])
          }
        />
      </form>
    </SettingsSubPage>
  );
}
