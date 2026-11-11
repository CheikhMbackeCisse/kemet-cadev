import { useState, type FormEvent } from "react";
import type { WorkSort, WorkType } from "@kemet/shared";
import { FormPage } from "../components/layout/FormPage.js";
import { FormField } from "../components/ui/FormField.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { WORK_TYPE_LABELS, WORK_TYPES } from "../components/works/workLabels.js";
import { navigate } from "../lib/navigation/navigate.js";
import { readWorkFilters, workFiltersSearch } from "../lib/works/filters.js";
import { fr } from "../i18n/fr.js";

const ALL = "all";

/** Filtres de /travaux sur téléphone : une page plutôt qu'une rangée de listes. */
export function WorkFiltersPage() {
  const [initial] = useState(() => readWorkFilters(window.location.search));
  const [type, setType] = useState<WorkType | null>(initial.type);
  const [sort, setSort] = useState<WorkSort>(initial.sort);
  const [tag, setTag] = useState(initial.tag);

  function submit(event: FormEvent) {
    event.preventDefault();
    const search = workFiltersSearch({ ...initial, type, sort, tag: tag.trim().toLowerCase() });
    navigate(`/travaux${search}`, { replace: true });
  }

  return (
    <FormPage
      title={fr.works.filtersTitle}
      activeSection="travaux"
      backHref={`/travaux${workFiltersSearch(initial)}`}
      submitLabel={fr.works.filtersApply}
      onSubmit={submit}
    >
      <FormField label={fr.works.filterTypeLabel}>
        <Select
          value={type ?? ALL}
          onValueChange={(value) => setType(value === ALL ? null : (value as WorkType))}
          options={[
            { value: ALL, label: fr.works.filterAllTypes },
            ...WORK_TYPES.map((value) => ({ value, label: WORK_TYPE_LABELS[value] })),
          ]}
        />
      </FormField>
      <FormField label={fr.works.sortLabel}>
        <Select
          value={sort}
          onValueChange={(value) => setSort(value as WorkSort)}
          options={[
            { value: "recent", label: fr.works.sortRecent },
            { value: "discussed", label: fr.works.sortDiscussed },
          ]}
        />
      </FormField>
      <FormField label={fr.works.filterTagLabel}>
        <Input
          value={tag}
          placeholder={fr.works.filterTagPlaceholder}
          onChange={(event) => setTag(event.target.value)}
        />
      </FormField>
    </FormPage>
  );
}
