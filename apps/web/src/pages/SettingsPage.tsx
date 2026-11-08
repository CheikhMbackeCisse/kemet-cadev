import { useEffect, useState, type FormEvent } from "react";
import type { ProfileRole } from "@kemet/shared";
import { Button } from "../components/ui/Button.js";
import { CountrySelect } from "../components/ui/CountrySelect.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { SuspendedBanner } from "../components/shell/SuspendedBanner.js";
import { useTheme, type ThemeChoice } from "../theme/theme-context.js";
import { ChatApiError, updateMyProfile } from "../lib/chat/api.js";
import { useAccountExport } from "../lib/useAccountExport.js";
import { useToast } from "../components/ui/Toast.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";
import { SubmitButton } from "../components/ui/SubmitButton.js";
import { RailPage } from "../components/layout/RailPage.js";

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: fr.settings.themeSystem },
  { value: "light", label: fr.settings.themeLight },
  { value: "dark", label: fr.settings.themeDark },
];

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: fr.auth.roleNone },
  { value: "developer", label: fr.auth.roleDeveloper },
  { value: "designer", label: fr.auth.roleDesigner },
  { value: "hr", label: fr.auth.roleHr },
  { value: "student", label: fr.auth.roleStudent },
  { value: "project_manager", label: fr.auth.roleProjectManager },
  { value: "other", label: fr.auth.roleOther },
];

export function SettingsPage() {
  const { status, profile, isSuspended, refresh } = useSession();
  const { choice: themeChoice, setChoice: setThemeChoice } = useTheme();
  const toast = useToast();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("none");
  const [specialty, setSpecialty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { exporting, exportAccount } = useAccountExport();
  const [submitting, setSubmitting] = useState(false);

  // Un visiteur garde l'acces a cette page pour le choix du theme ; seul le
  // formulaire de profil lui est masque.
  useEffect(() => {
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  useEffect(() => {
    if (!profile) return;
    setHandle(profile.handle);
    setDisplayName(profile.displayName);
    setCountry(profile.country);
    setRole(profile.role ?? "none");
    setSpecialty(profile.title ?? "");
  }, [profile]);

  if (status === "loading" || status === "incomplete") return null;
  const signedIn = status === "ready" && profile !== null;

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
      });
      await refresh();
      toast.show(fr.settings.saved, "success");
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 409)
        setError(fr.auth.handleAlreadyTakenError);
      else setError(fr.settings.saveError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RailPage activeSection="parametres" className="gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div>
          <h1 className="text-lg font-bold text-text">{fr.settings.title}</h1>
          <p className="text-sm text-subtle">{fr.settings.subtitle}</p>
        </div>
      </div>

      {isSuspended && <SuspendedBanner />}

      {signedIn && (
        <section className="flex flex-col gap-3">
          <h2 className="text-md font-semibold text-text">{fr.settings.profileSection}</h2>
          <form className="flex max-w-sm flex-col gap-3" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1 text-sm text-text-2">
              {fr.auth.displayNameLabel}
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={isSuspended}
              />
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
                  : missingFieldsReason([
                      [handle, fr.auth.handleLabel],
                      [displayName, fr.auth.displayNameLabel],
                    ])
              }
            />
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-md font-semibold text-text">{fr.settings.preferencesSection}</h2>
        <label className="flex max-w-sm flex-col gap-1 text-sm text-text-2">
          {fr.settings.themeLabel}
          <Select
            aria-label={fr.settings.themeLabel}
            value={themeChoice}
            onValueChange={(value) => setThemeChoice(value as ThemeChoice)}
            options={THEME_OPTIONS}
          />
          <span className="text-xs text-subtle">{fr.settings.themeHint}</span>
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-md font-semibold text-text">{fr.settings.dataSection}</h2>
        {signedIn && (
          <div className="flex max-w-sm flex-col items-start gap-1">
            <Button variant="secondary" loading={exporting} onClick={() => void exportAccount()}>
              {fr.settings.exportLink}
            </Button>
            <span className="text-xs text-subtle">{fr.settings.exportHint}</span>
          </div>
        )}
        <a href="/confidentialite" className="text-sm text-link hover:underline">
          {fr.settings.privacyLink}
        </a>
      </section>

      {signedIn && (
        <section className="flex flex-col gap-3" aria-labelledby="delete-account-title">
          <h2 id="delete-account-title" className="text-md font-semibold text-text">
            {fr.settings.deleteSection}
          </h2>
          <div className="flex max-w-sm flex-col items-start gap-1">
            <a
              href="/parametres/supprimer-mon-compte"
              className="inline-flex h-control items-center rounded-control -mx-2 px-2 text-sm font-medium text-danger hover:underline max-md:h-control-mobile"
            >
              {fr.settings.deleteLink}
            </a>
            <span className="text-xs text-subtle">{fr.settings.deleteHint}</span>
          </div>
        </section>
      )}
    </RailPage>
  );
}
