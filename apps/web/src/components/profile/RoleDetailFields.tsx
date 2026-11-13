import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { ORGANIZATION_MAX_LENGTH, type ProfileRole, type ProfileWorkMode } from "@kemet/shared";
import { listOrganizationSuggestions } from "../../lib/chat/api.js";
import { cn } from "../../lib/cn.js";
import { useDebounced } from "../../lib/useDebounced.js";
import { fr } from "../../i18n/fr.js";
import { RadioList } from "../onboarding/RadioList.js";
import type { ChoiceTone } from "../onboarding/choiceTone.js";
import { Input } from "../ui/Input.js";

/** Saisie libre, avec en suggestion les noms déjà saisis par d'autres. */
function OrganizationInput({
  kind,
  label,
  placeholder,
  value,
  onChange,
  tone,
}: {
  kind: "school" | "company";
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  tone: ChoiceTone;
}) {
  const listId = useId();
  const query = useDebounced(value.trim());
  const suggestions = useQuery({
    queryKey: ["organizations", kind, query],
    queryFn: () => listOrganizationSuggestions(kind, query),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
  const items = (suggestions.data?.items ?? []).filter((item) => item !== value.trim());

  return (
    <label
      className={cn(
        "flex flex-col gap-1 text-sm",
        tone === "glass" ? "text-auth-text" : "text-text-2",
      )}
    >
      {label}
      <Input
        value={value}
        list={listId}
        maxLength={ORGANIZATION_MAX_LENGTH}
        placeholder={placeholder}
        autoComplete="organization"
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist
        id={listId}
        aria-label={
          kind === "school" ? fr.roleDetail.suggestions : fr.roleDetail.companySuggestions
        }
      >
        {items.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </label>
  );
}

export interface RoleDetailFieldsProps {
  role: ProfileRole | null;
  workMode: ProfileWorkMode | null;
  organization: string;
  onWorkModeChange: (workMode: ProfileWorkMode) => void;
  onOrganizationChange: (organization: string) => void;
  tone?: ChoiceTone;
}

/**
 * La précision du rôle : l'établissement d'une personne qui étudie,
 * freelance ou en entreprise pour "Je code", l'entreprise de qui recrute ou
 * dirige. Rien pour les autres rôles. Tout est facultatif.
 */
export function RoleDetailFields({
  role,
  workMode,
  organization,
  onWorkModeChange,
  onOrganizationChange,
  tone = "page",
}: RoleDetailFieldsProps) {
  if (role === "student") {
    return (
      <OrganizationInput
        kind="school"
        label={fr.roleDetail.studentLabel}
        placeholder={fr.roleDetail.studentPlaceholder}
        value={organization}
        onChange={onOrganizationChange}
        tone={tone}
      />
    );
  }
  if (role === "developer") {
    return (
      <div className="flex flex-col gap-3">
        {/* Sur l'onboarding, le titre de l'écran pose déjà la question. */}
        {tone === "page" && (
          <p aria-hidden="true" className="-mb-2 text-sm text-text-2">
            {fr.roleDetail.developerLabel}
          </p>
        )}
        <RadioList
          name="work-mode"
          label={fr.roleDetail.developerLabel}
          options={[
            { value: "freelance", label: fr.roleDetail.freelance },
            { value: "employed", label: fr.roleDetail.employed },
          ]}
          value={workMode ?? ""}
          onChange={(value) => onWorkModeChange(value as ProfileWorkMode)}
          tone={tone}
        />
        {workMode === "employed" && (
          <OrganizationInput
            kind="company"
            label={fr.roleDetail.companyLabel}
            value={organization}
            onChange={onOrganizationChange}
            tone={tone}
          />
        )}
      </div>
    );
  }
  if (role === "hr" || role === "entrepreneur") {
    return (
      <OrganizationInput
        kind="company"
        label={fr.roleDetail.companyLabel}
        value={organization}
        onChange={onOrganizationChange}
        tone={tone}
      />
    );
  }
  return null;
}

/** Question de l'écran d'onboarding, propre au rôle choisi. */
export function roleDetailTitle(role: ProfileRole | null): string {
  if (role === "student") return fr.roleDetail.studentTitle;
  if (role === "developer") return fr.roleDetail.developerTitle;
  if (role === "hr") return fr.roleDetail.hrTitle;
  return fr.roleDetail.entrepreneurTitle;
}
