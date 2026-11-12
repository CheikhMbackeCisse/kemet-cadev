import { useQuery } from "@tanstack/react-query";
import { listMyOrganizations } from "../../lib/chat/api.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";
import { FormField } from "../ui/FormField.js";
import { Select } from "../ui/Select.js";

/** Valeur du choix "moi" : publier sous son propre nom. */
export const PUBLISH_AS_ME = "me";

/** Organisations que la personne connectée gère, mises en cache pour les formulaires. */
export function useManagedOrganizations() {
  const { status } = useSession();
  return useQuery({
    queryKey: ["my-organizations"],
    queryFn: listMyOrganizations,
    enabled: status === "ready",
    staleTime: 60_000,
  });
}

/**
 * "Publier en tant que : moi / [organisation]". Rien n'est affiché pour une
 * personne qui ne gère aucune organisation. Le serveur revérifie le droit.
 */
export function PublishAsField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const organizations = useManagedOrganizations();
  const items = organizations.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <FormField label={fr.organizations.publishAs}>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        options={[
          { value: PUBLISH_AS_ME, label: fr.organizations.publishAsMe },
          ...items.map((organization) => ({
            value: organization.id,
            label: organization.displayName,
          })),
        ]}
      />
    </FormField>
  );
}
