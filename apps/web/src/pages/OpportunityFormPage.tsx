import { useEffect, useId, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CONTRACT_TYPES, OPPORTUNITY_KINDS, type OpportunityKind } from "@kemet/shared";
import {
  ChatApiError,
  createOpportunity,
  getOpportunity,
  updateOpportunity,
} from "../lib/chat/api.js";
import { navigate } from "../lib/navigation/navigate.js";
import { createWithSlugFromTitle } from "../lib/slugify.js";
import {
  buildOfferInput,
  draftFromOffer,
  EMPTY_OFFER_DRAFT,
  type OfferDraft,
  type OfferField,
} from "../lib/opportunities/offerForm.js";
import type { FieldErrors } from "../lib/forms.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";
import { FormPage } from "../components/layout/FormPage.js";
import {
  PublishAsField,
  PUBLISH_AS_ME,
  useManagedOrganizations,
} from "../components/organizations/PublishAsField.js";
import { DomainGrid } from "../components/onboarding/DomainGrid.js";
import { Checkbox } from "../components/ui/Checkbox.js";
import { CountrySelect } from "../components/ui/CountrySelect.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { FormField } from "../components/ui/FormField.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Textarea } from "../components/ui/Textarea.js";

const KIND_OPTIONS = OPPORTUNITY_KINDS.map((kind) => ({
  value: kind,
  label: fr.opportunities.kinds[kind],
}));
// Le contrat de stage va de soi pour un stage : il ne se choisit que pour un emploi.
const JOB_CONTRACT_OPTIONS = CONTRACT_TYPES.filter((type) => type !== "stage").map((type) => ({
  value: type,
  label: fr.opportunities.contracts[type],
}));

/** Identifiant de l'offre à modifier, ou `null` sur /opportunites/nouvelle. */
function editedSlug(): string | null {
  const match = /^\/opportunites\/([^/]+)\/modifier\/?$/.exec(window.location.pathname);
  return match ? decodeURIComponent(match[1]!) : null;
}

export function OpportunityFormPage() {
  const { status, isSuspended, profile } = useSession();
  const queryClient = useQueryClient();
  const domainsErrorId = useId();
  const [slug] = useState(editedSlug);
  const [draft, setDraft] = useState<OfferDraft>(EMPTY_OFFER_DRAFT);
  const [loadState, setLoadState] = useState<"ready" | "loading" | "notFound" | "error">(
    slug ? "loading" : "ready",
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadedAuthorId, setLoadedAuthorId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<OfferField>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishAs, setPublishAs] = useState(PUBLISH_AS_ME);
  const managed = useManagedOrganizations();
  const managedItems = managed.data?.items ?? [];
  const publishingOrganization = managedItems.find((item) => item.id === publishAs) ?? null;
  // L'offre d'une organisation garde son nom référencé : le serveur ignore la saisie.
  const organizationLocked =
    publishingOrganization !== null || managedItems.some((item) => item.id === loadedAuthorId);

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  useEffect(() => {
    if (!slug) return;
    setLoadState("loading");
    getOpportunity(slug)
      .then(({ opportunity }) => {
        setDraft(draftFromOffer(opportunity));
        setLoadedAuthorId(opportunity.authorId);
        setLoadState("ready");
      })
      .catch((err: unknown) =>
        setLoadState(err instanceof ChatApiError && err.statusCode === 404 ? "notFound" : "error"),
      );
  }, [slug, loadAttempt]);

  // Seuls l'auteur et les gestionnaires de l'organisation auteure modifient :
  // un autre compte retourne à l'offre avant d'avoir rien rempli.
  useEffect(() => {
    if (!slug || !profile || !loadedAuthorId || loadedAuthorId === profile.id) return;
    if (managed.isPending) return;
    if (managed.data?.items.some((item) => item.id === loadedAuthorId)) return;
    navigate(`/opportunites/${slug}`, { replace: true });
  }, [slug, profile, loadedAuthorId, managed.isPending, managed.data]);

  function choosePublishAs(value: string) {
    setPublishAs(value);
    const organization = managedItems.find((item) => item.id === value);
    if (organization) update("organization", organization.displayName);
  }

  function update<Key extends keyof OfferDraft>(key: Key, value: OfferDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const { input, errors: nextErrors } = buildOfferInput(draft);
    setErrors(nextErrors);
    if (!input) return;
    setSubmitting(true);
    try {
      const { opportunity } = slug
        ? await updateOpportunity(slug, input)
        : await createWithSlugFromTitle(input.title, "offre", (candidate) =>
            createOpportunity({
              ...input,
              slug: candidate,
              asOrganizationId: publishingOrganization?.id ?? null,
            }),
          );
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.removeQueries({ queryKey: ["opportunity", opportunity.slug] });
      navigate(`/opportunites/${opportunity.slug}`);
    } catch (err) {
      setError(
        err instanceof ChatApiError && err.statusCode === 400
          ? err.message
          : fr.opportunities.saveError,
      );
      setSubmitting(false);
    }
  }

  const isMission = draft.kind === "mission";
  const title = slug ? fr.opportunities.editTitle : fr.opportunities.newTitle;
  const backHref = slug ? `/opportunites/${slug}` : "/fil?onglet=opportunites";

  return (
    <FormPage
      title={title}
      activeSection="fil"
      backHref={backHref}
      submitLabel={slug ? fr.opportunities.submitEdit : fr.opportunities.submitCreate}
      submitting={submitting}
      submitDisabled={isSuspended || loadState !== "ready"}
      error={error}
      onSubmit={handleSubmit}
    >
      {loadState === "loading" ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : loadState === "notFound" ? (
        <ErrorState message={fr.opportunities.notFound} />
      ) : loadState === "error" ? (
        <ErrorState
          message={fr.opportunities.editLoadingError}
          retry={{ label: fr.chat.retry, onClick: () => setLoadAttempt((attempt) => attempt + 1) }}
        />
      ) : (
        <>
          {!slug && (
            <PublishAsField value={publishAs} onChange={choosePublishAs} disabled={isSuspended} />
          )}
          <FormField label={fr.opportunities.kindLabel}>
            <Select
              value={draft.kind}
              onValueChange={(kind) => update("kind", kind as OpportunityKind)}
              options={KIND_OPTIONS}
            />
          </FormField>
          <FormField label={fr.opportunities.titleLabel} error={errors.title}>
            <Input
              value={draft.title}
              maxLength={120}
              onChange={(event) => update("title", event.target.value)}
            />
          </FormField>
          <FormField label={fr.opportunities.organizationLabel} error={errors.organization}>
            <Input
              value={draft.organization}
              maxLength={80}
              disabled={organizationLocked}
              onChange={(event) => update("organization", event.target.value)}
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm text-text max-md:min-h-11">
            <Checkbox
              checked={draft.remote}
              onCheckedChange={(checked) => update("remote", checked)}
            />
            {fr.opportunities.remoteLabel}
          </label>
          <FormField label={fr.opportunities.countryLabel} error={errors.countryCode}>
            <CountrySelect
              value={draft.countryCode}
              onValueChange={(countryCode) => update("countryCode", countryCode)}
              placeholder={fr.opportunities.countryPlaceholder}
            />
          </FormField>
          <FormField label={fr.opportunities.cityLabel}>
            <Input
              value={draft.city}
              maxLength={60}
              onChange={(event) => update("city", event.target.value)}
            />
          </FormField>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm text-text-2">
              {fr.opportunities.domainsFieldLabel}
            </legend>
            <DomainGrid
              value={draft.domains}
              onChange={(domains) => update("domains", domains)}
              exclude={["other"]}
              errorId={errors.domains ? domainsErrorId : undefined}
            />
            {errors.domains && (
              <p id={domainsErrorId} className="text-sm text-danger" role="alert">
                {errors.domains}
              </p>
            )}
          </fieldset>

          <CodeTextarea
            label={fr.opportunities.descriptionLabel}
            value={draft.description}
            onValueChange={(description) => update("description", description)}
            error={errors.description}
          />

          {isMission ? (
            <>
              <FormField label={fr.opportunities.budgetMinLabel} error={errors.budgetMin}>
                <Input
                  inputMode="numeric"
                  value={draft.budgetMin}
                  onChange={(event) => update("budgetMin", event.target.value)}
                />
              </FormField>
              <FormField label={fr.opportunities.budgetMaxLabel} error={errors.budgetMax}>
                <Input
                  inputMode="numeric"
                  value={draft.budgetMax}
                  onChange={(event) => update("budgetMax", event.target.value)}
                />
              </FormField>
              <FormField label={fr.opportunities.deadlineFieldLabel} error={errors.deadline}>
                <Input
                  type="date"
                  value={draft.deadline}
                  onChange={(event) => update("deadline", event.target.value)}
                />
              </FormField>
              <FormField label={fr.opportunities.criteriaLabel} error={errors.criteria}>
                <Textarea
                  variant="form"
                  placeholder={fr.opportunities.criteriaPlaceholder}
                  value={draft.criteria}
                  onChange={(event) => update("criteria", event.target.value)}
                />
              </FormField>
            </>
          ) : (
            <>
              {draft.kind === "job" && (
                <FormField label={fr.opportunities.contractFieldLabel} error={errors.contractType}>
                  <Select
                    value={draft.contractType}
                    onValueChange={(contractType) =>
                      update("contractType", contractType as OfferDraft["contractType"])
                    }
                    options={JOB_CONTRACT_OPTIONS}
                    placeholder={fr.opportunities.contractPlaceholder}
                  />
                </FormField>
              )}
              <FormField label={fr.opportunities.startDateLabel} error={errors.startDate}>
                <Input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => update("startDate", event.target.value)}
                />
              </FormField>
              <FormField label={fr.opportunities.jobDeadlineFieldLabel}>
                <Input
                  type="date"
                  value={draft.deadline}
                  onChange={(event) => update("deadline", event.target.value)}
                />
              </FormField>
              <FormField
                label={fr.opportunities.compensationFieldLabel}
                error={errors.compensation}
              >
                <Input
                  inputMode="numeric"
                  value={draft.compensation}
                  onChange={(event) => update("compensation", event.target.value)}
                />
              </FormField>
            </>
          )}
        </>
      )}
    </FormPage>
  );
}
