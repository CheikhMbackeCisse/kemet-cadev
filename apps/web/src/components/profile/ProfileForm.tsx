import { useEffect, useRef, useState, type FormEvent } from "react";
import { FormPair, FormSection } from "../layout/FormSection.js";
import {
  isValidProfileLink,
  type MeResponse,
  type ProfileLinkKind,
  type ProfileRole,
  type ProfileWorkMode,
} from "@kemet/shared";
import { CountrySelect } from "../ui/CountrySelect.js";
import { Input } from "../ui/Input.js";
import { Select } from "../ui/Select.js";
import { Switch } from "../ui/Switch.js";
import { CvSettings } from "../settings/CvSettings.js";
import { AvatarChangeButton } from "./AvatarChangeButton.js";
import { Avatar } from "../ui/Avatar.js";
import { SubmitButton } from "../ui/SubmitButton.js";
import { Textarea } from "../ui/Textarea.js";
import { useToast } from "../ui/Toast.js";
import { FormField } from "../ui/FormField.js";
import { LINK_ICONS } from "../library/ProfileLinks.js";
import { RoleDetailFields } from "./RoleDetailFields.js";
import { ChatApiError, updateMyProfile } from "../../lib/chat/api.js";
import {
  focusFirstInvalidField,
  handleError,
  hasFieldErrors,
  requiredFieldErrors,
  type FieldErrors,
} from "../../lib/forms.js";
import { LINK_PREFIXES, linkFromInput, linkInputValue } from "../../lib/profileLinkInput.js";
import { PROFILE_ROLE_OPTIONS } from "../../lib/profileRoles.js";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";

const ROLE_OPTIONS = [{ value: "none", label: fr.auth.roleNone }, ...PROFILE_ROLE_OPTIONS];

const LINK_KINDS: ProfileLinkKind[] = ["github", "gitlab", "linkedin", "portfolio", "website"];

const LINK_LABELS: Record<ProfileLinkKind, string> = {
  github: fr.settings.githubLabel,
  gitlab: fr.settings.gitlabLabel,
  linkedin: fr.settings.linkedinLabel,
  portfolio: fr.settings.portfolioLabel,
  website: fr.settings.websiteLabel,
};

const LINK_INVALID: Record<ProfileLinkKind, string> = {
  github: fr.settings.githubInvalid,
  gitlab: fr.settings.gitlabInvalid,
  linkedin: fr.settings.linkedinInvalid,
  portfolio: fr.settings.httpsInvalid(fr.settings.portfolioLabel),
  website: fr.settings.httpsInvalid(fr.settings.websiteLabel),
};

const LINK_PLACEHOLDERS: Record<ProfileLinkKind, string> = {
  github: fr.settings.handlePlaceholder,
  gitlab: fr.settings.handlePlaceholder,
  linkedin: fr.settings.handlePlaceholder,
  portfolio: fr.settings.portfolioPlaceholder,
  website: fr.settings.websitePlaceholder,
};

type Links = Record<ProfileLinkKind, string>;
type Profile = NonNullable<MeResponse["profile"]>;

interface ProfileFormValues {
  handle: string;
  displayName: string;
  country: string;
  role: string;
  workMode: ProfileWorkMode | null;
  organization: string;
  specialty: string;
  bio: string;
  links: Links;
  helpsBeginners: boolean;
}

function valuesFrom(profile: Profile): ProfileFormValues {
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    country: profile.country,
    role: profile.role ?? "none",
    workMode: profile.workMode,
    organization: profile.organization ?? "",
    specialty: profile.title ?? "",
    bio: profile.bio ?? "",
    links: {
      github: linkInputValue("github", profile.githubUrl ?? ""),
      gitlab: linkInputValue("gitlab", profile.gitlabUrl ?? ""),
      linkedin: linkInputValue("linkedin", profile.linkedinUrl ?? ""),
      portfolio: profile.portfolioUrl ?? "",
      website: profile.websiteUrl ?? "",
    },
    helpsBeginners: profile.helpsBeginners,
  };
}

function LinkRow({
  kind,
  value,
  error,
  disabled,
  onChange,
}: {
  kind: ProfileLinkKind;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const Icon = LINK_ICONS[kind];
  const prefix = LINK_PREFIXES[kind];
  const inputId = `profile-link-${kind}`;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm text-text-2">
        <Icon className="size-4 shrink-0 text-subtle" aria-hidden="true" />
        {LINK_LABELS[kind]}
      </label>
      <div
        className={cn(
          "flex h-control w-full items-center overflow-hidden rounded-control border border-border-strong bg-bg focus-within:border-primary max-md:h-control-mobile",
          error && "border-danger",
          disabled && "opacity-50",
        )}
      >
        {prefix && (
          <span
            aria-hidden="true"
            className="flex h-full shrink-0 items-center border-r border-border bg-surface-2 px-3 text-sm text-muted"
          >
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          data-field=""
          type={prefix ? "text" : "url"}
          inputMode={prefix ? "text" : "url"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label={prefix ? `${LINK_LABELS[kind]}, ${prefix}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={LINK_PLACEHOLDERS[kind]}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-text outline-none placeholder:text-subtle disabled:cursor-not-allowed max-md:text-md"
        />
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export interface ProfileFormProps {
  profile: Profile;
  disabled: boolean;
  onSaved: () => Promise<void>;
}

/**
 * Formulaire du profil, partagé par Paramètres > Profil et par les liens de
 * la carte "Complète ton profil" : sections en cartes, paires de champs
 * courts côte à côte sur ordinateur, barre d'enregistrement collée en bas qui
 * n'apparaît qu'après un changement. Le CV garde son propre envoi.
 */
export function ProfileForm({ profile, disabled, onSaved }: ProfileFormProps) {
  const toast = useToast();
  // Rempli une seule fois : une session relue (photo envoyée) ne doit pas
  // effacer ce qui est en cours de saisie.
  const [saved, setSaved] = useState(() => valuesFrom(profile));
  const [values, setValues] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  // Arrivée par un lien de la carte "Complète ton profil" (#cv, #liens) :
  // la section voulue, une fois la page affichée.
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, []);

  function update<Key extends keyof ProfileFormValues>(key: Key, value: ProfileFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateLink(kind: ProfileLinkKind, value: string) {
    setValues((current) => ({ ...current, links: { ...current.links, [kind]: value } }));
  }

  function changeRole(role: string) {
    setValues((current) => ({ ...current, role, workMode: null, organization: "" }));
  }

  const selectedRole = values.role === "none" ? null : (values.role as ProfileRole);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {
      ...requiredFieldErrors({ displayName: values.displayName }),
      handle: handleError(values.handle),
    };
    const urls = {} as Record<ProfileLinkKind, string | null>;
    for (const kind of LINK_KINDS) {
      const url = linkFromInput(kind, values.links[kind]);
      urls[kind] = url;
      if (url && !isValidProfileLink(kind, url)) errors[kind] = LINK_INVALID[kind];
    }
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInvalidField(formRef.current);
      return;
    }
    setSubmitting(true);
    try {
      await updateMyProfile({
        handle: values.handle.toLowerCase(),
        displayName: values.displayName,
        // Un pays jamais choisi (onboarding passé) reste vide sans bloquer le reste.
        ...(values.country && { country: values.country }),
        role: selectedRole,
        workMode: values.workMode,
        organization: values.organization.trim() || null,
        title: values.specialty.trim() || null,
        bio: values.bio.trim() || null,
        githubUrl: urls.github,
        gitlabUrl: urls.gitlab,
        linkedinUrl: urls.linkedin,
        portfolioUrl: urls.portfolio,
        websiteUrl: urls.website,
        helpsBeginners: values.helpsBeginners,
      });
      setSaved(values);
      await onSaved();
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
    <div className="flex flex-col gap-4">
      <form ref={formRef} noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <fieldset disabled={disabled} className="contents">
          <FormSection id="identite" title={fr.settings.identityTitle}>
            <div className="flex items-center gap-4">
              <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={88} />
              <AvatarChangeButton
                variant="button"
                hasPhoto={Boolean(profile.avatarUrl)}
                disabled={disabled}
              />
            </div>
            <FormPair>
              <FormField label={fr.auth.displayNameLabel} error={fieldErrors.displayName}>
                <Input
                  value={values.displayName}
                  autoComplete="name"
                  onChange={(event) => update("displayName", event.target.value)}
                />
              </FormField>
              <FormField label={fr.auth.handleLabel} error={fieldErrors.handle}>
                <Input
                  value={values.handle}
                  autoCapitalize="none"
                  onChange={(event) => update("handle", event.target.value.toLowerCase())}
                />
              </FormField>
            </FormPair>
          </FormSection>

          <FormSection id="activite" title={fr.settings.activityTitle}>
            <FormPair>
              <label className="flex flex-col gap-1 text-sm text-text-2">
                {fr.auth.countryLabel}
                <CountrySelect
                  aria-label={fr.auth.countryLabel}
                  value={values.country}
                  onValueChange={(country) => update("country", country)}
                  placeholder={fr.auth.countrySelectPlaceholder}
                  disabled={disabled}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-text-2">
                {fr.auth.roleLabel}
                <Select
                  aria-label={fr.auth.roleLabel}
                  value={values.role}
                  onValueChange={changeRole}
                  options={ROLE_OPTIONS}
                  disabled={disabled}
                />
              </label>
            </FormPair>
            <RoleDetailFields
              role={selectedRole}
              workMode={values.workMode}
              organization={values.organization}
              onWorkModeChange={(workMode) => update("workMode", workMode)}
              onOrganizationChange={(organization) => update("organization", organization)}
            />
            <label className="flex flex-col gap-1 text-sm text-text-2">
              {fr.auth.specialtyLabel}
              <Input
                placeholder={fr.auth.specialtyPlaceholder}
                value={values.specialty}
                onChange={(event) => update("specialty", event.target.value)}
              />
            </label>
          </FormSection>

          <FormSection id="bio" title={fr.settings.bioSectionTitle}>
            <label className="flex flex-col gap-1 text-sm text-text-2">
              {fr.settings.bioLabel}
              <Textarea
                variant="form"
                maxLength={500}
                placeholder={fr.settings.bioPlaceholder}
                value={values.bio}
                onChange={(event) => update("bio", event.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="helps-beginners" className="text-sm font-medium text-text">
                  {fr.settings.helpsBeginnersLabel}
                </label>
                <Switch
                  id="helps-beginners"
                  aria-describedby="helps-beginners-hint"
                  checked={values.helpsBeginners}
                  onCheckedChange={(checked) => update("helpsBeginners", checked)}
                  disabled={disabled}
                />
              </div>
              <p id="helps-beginners-hint" className="text-sm text-muted">
                {fr.settings.helpsBeginnersHint}
              </p>
            </div>
          </FormSection>

          <FormSection id="liens" title={fr.settings.linksTitle}>
            {LINK_KINDS.map((kind) => (
              <LinkRow
                key={kind}
                kind={kind}
                value={values.links[kind]}
                error={fieldErrors[kind]}
                disabled={disabled}
                onChange={(value) => updateLink(kind, value)}
              />
            ))}
          </FormSection>
        </fieldset>

        {(dirty || error) && (
          <div className="sticky bottom-[calc(45px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-bg px-4 py-2 lg:bottom-0">
            {error && (
              <p className="mr-auto text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <SubmitButton label={fr.settings.save} loading={submitting} disabled={disabled} />
          </div>
        )}
      </form>

      <div className="rounded-card border border-border p-3 lg:p-5">
        <CvSettings handle={profile.handle} disabled={disabled} />
      </div>
    </div>
  );
}
