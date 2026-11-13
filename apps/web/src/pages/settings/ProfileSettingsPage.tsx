import { navigate } from "../../lib/navigation/navigate.js";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  isValidProfileLink,
  type ProfileLinkKind,
  type ProfileRole,
  type ProfileWorkMode,
} from "@kemet/shared";
import { SettingsSubPage } from "../../components/settings/SettingsSubPage.js";
import { SuspendedBanner } from "../../components/shell/SuspendedBanner.js";
import { CountrySelect } from "../../components/ui/CountrySelect.js";
import { Input } from "../../components/ui/Input.js";
import { Select } from "../../components/ui/Select.js";
import { Switch } from "../../components/ui/Switch.js";
import { CvSettings } from "../../components/settings/CvSettings.js";
import { AvatarChangeButton } from "../../components/profile/AvatarChangeButton.js";
import { Avatar } from "../../components/ui/Avatar.js";
import { SubmitButton } from "../../components/ui/SubmitButton.js";
import { Textarea } from "../../components/ui/Textarea.js";
import { useToast } from "../../components/ui/Toast.js";
import { ChatApiError, updateMyProfile } from "../../lib/chat/api.js";
import {
  focusFirstInvalidField,
  handleError,
  hasFieldErrors,
  requiredFieldErrors,
  type FieldErrors,
} from "../../lib/forms.js";
import { FormField } from "../../components/ui/FormField.js";
import { PROFILE_ROLE_OPTIONS } from "../../lib/profileRoles.js";
import { RoleDetailFields } from "../../components/profile/RoleDetailFields.js";
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
  const [workMode, setWorkMode] = useState<ProfileWorkMode | null>(null);
  const [organization, setOrganization] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [gitlabUrl, setGitlabUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [helpsBeginners, setHelpsBeginners] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
    if (status === "incomplete") navigate("/completer-profil");
  }, [status]);

  useEffect(() => {
    if (!profile) return;
    setHandle(profile.handle);
    setDisplayName(profile.displayName);
    setCountry(profile.country);
    setRole(profile.role ?? "none");
    setWorkMode(profile.workMode);
    setOrganization(profile.organization ?? "");
    setSpecialty(profile.title ?? "");
    setBio(profile.bio ?? "");
    setGithubUrl(profile.githubUrl ?? "");
    setGitlabUrl(profile.gitlabUrl ?? "");
    setLinkedinUrl(profile.linkedinUrl ?? "");
    setPortfolioUrl(profile.portfolioUrl ?? "");
    setWebsiteUrl(profile.websiteUrl ?? "");
    setHelpsBeginners(profile.helpsBeginners);
  }, [profile]);

  if (status !== "ready" || !profile) return null;

  const selectedRole = role === "none" ? null : (role as ProfileRole);

  function changeRole(value: string) {
    setRole(value);
    setWorkMode(null);
    setOrganization("");
  }

  const linkFields: {
    kind: ProfileLinkKind;
    value: string;
    set: (value: string) => void;
    label: string;
    placeholder: string;
    invalid: string;
  }[] = [
    {
      kind: "github",
      value: githubUrl,
      set: setGithubUrl,
      label: fr.settings.githubLabel,
      placeholder: fr.settings.githubPlaceholder,
      invalid: fr.settings.githubInvalid,
    },
    {
      kind: "gitlab",
      value: gitlabUrl,
      set: setGitlabUrl,
      label: fr.settings.gitlabLabel,
      placeholder: fr.settings.gitlabPlaceholder,
      invalid: fr.settings.gitlabInvalid,
    },
    {
      kind: "linkedin",
      value: linkedinUrl,
      set: setLinkedinUrl,
      label: fr.settings.linkedinLabel,
      placeholder: fr.settings.linkedinPlaceholder,
      invalid: fr.settings.linkedinInvalid,
    },
    {
      kind: "portfolio",
      value: portfolioUrl,
      set: setPortfolioUrl,
      label: fr.settings.portfolioLabel,
      placeholder: fr.settings.portfolioPlaceholder,
      invalid: fr.settings.httpsInvalid(fr.settings.portfolioLabel),
    },
    {
      kind: "website",
      value: websiteUrl,
      set: setWebsiteUrl,
      label: fr.settings.websiteLabel,
      placeholder: fr.settings.websitePlaceholder,
      invalid: fr.settings.httpsInvalid(fr.settings.websiteLabel),
    },
  ];
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {
      ...requiredFieldErrors({ displayName }),
      handle: handleError(handle),
    };
    for (const field of linkFields) {
      const value = field.value.trim();
      if (value && !isValidProfileLink(field.kind, value)) errors[field.kind] = field.invalid;
    }
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInvalidField(formRef.current);
      return;
    }
    setSubmitting(true);
    try {
      await updateMyProfile({
        handle: handle.toLowerCase(),
        displayName,
        // Un pays jamais choisi (onboarding passé) reste vide sans bloquer le reste.
        ...(country && { country }),
        role: selectedRole,
        workMode,
        organization: organization.trim() || null,
        title: specialty.trim() || null,
        bio: bio.trim() || null,
        githubUrl: githubUrl.trim() || null,
        gitlabUrl: gitlabUrl.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
        portfolioUrl: portfolioUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        helpsBeginners,
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
    <SettingsSubPage title={fr.settings.profileSection}>
      {isSuspended && <SuspendedBanner />}
      <section aria-labelledby="photo-title" className="flex max-w-sm flex-col gap-3">
        <h2 id="photo-title" className="text-md font-semibold text-text">
          {fr.settings.photoTitle}
        </h2>
        <div className="flex items-center gap-4">
          <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={88} />
          <AvatarChangeButton
            variant="button"
            hasPhoto={Boolean(profile.avatarUrl)}
            disabled={isSuspended}
          />
        </div>
      </section>
      <form
        ref={formRef}
        noValidate
        className="flex max-w-sm flex-col gap-3"
        onSubmit={handleSubmit}
      >
        <FormField label={fr.auth.displayNameLabel} error={fieldErrors.displayName}>
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={isSuspended}
          />
        </FormField>
        <FormField label={fr.auth.handleLabel} error={fieldErrors.handle}>
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
            disabled={isSuspended}
          />
        </FormField>
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
            onValueChange={changeRole}
            options={ROLE_OPTIONS}
            disabled={isSuspended}
          />
        </label>
        <fieldset disabled={isSuspended} className="contents">
          <RoleDetailFields
            role={selectedRole}
            workMode={workMode}
            organization={organization}
            onWorkModeChange={setWorkMode}
            onOrganizationChange={setOrganization}
          />
        </fieldset>
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
        <div className="flex items-start justify-between gap-4">
          <label htmlFor="helps-beginners" className="text-sm text-text">
            {fr.settings.helpsBeginnersLabel}
          </label>
          <Switch
            id="helps-beginners"
            checked={helpsBeginners}
            onCheckedChange={setHelpsBeginners}
            disabled={isSuspended}
          />
        </div>
        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="mb-1 text-md font-semibold text-text">{fr.settings.linksTitle}</legend>
          {linkFields.map((field) => (
            <FormField key={field.kind} label={field.label} error={fieldErrors[field.kind]}>
              <Input
                type="url"
                inputMode="url"
                placeholder={field.placeholder}
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
                disabled={isSuspended}
              />
            </FormField>
          ))}
        </fieldset>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <SubmitButton label={fr.settings.save} loading={submitting} disabled={isSuspended} />
      </form>
      <div className="border-t border-border pt-6">
        <CvSettings handle={profile.handle} disabled={isSuspended} />
      </div>
    </SettingsSubPage>
  );
}
