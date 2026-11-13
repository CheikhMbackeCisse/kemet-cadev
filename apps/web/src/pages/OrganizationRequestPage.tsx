import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ImagePlus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
  ORGANIZATION_LOGO_MAX_BYTES,
  ORGANIZATION_LOGO_MIME_TYPES,
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_TYPES,
  type OrganizationRequest,
  type OrganizationType,
} from "@kemet/shared";
import {
  ChatApiError,
  getMyOrganizationRequest,
  sendOrganizationRequest,
} from "../lib/chat/api.js";
import { navigate } from "../lib/navigation/navigate.js";
import type { FieldErrors } from "../lib/forms.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { FormPage } from "../components/layout/FormPage.js";
import { RailPage } from "../components/layout/RailPage.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { CountrySelect } from "../components/ui/CountrySelect.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { FormField } from "../components/ui/FormField.js";
import { Input } from "../components/ui/Input.js";
import { OrganizationLabel } from "../components/ui/OrganizationLabel.js";
import { Select } from "../components/ui/Select.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Textarea } from "../components/ui/Textarea.js";
import { useToast } from "../components/ui/Toast.js";

type Field = "name" | "organizationType" | "country" | "websiteUrl" | "logo";

const TYPE_OPTIONS = ORGANIZATION_TYPES.map((type) => ({
  value: type,
  label: fr.organizations.types[type],
}));

const MY_REQUEST_KEY = ["my-organization-request"];

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** La demande déjà envoyée, à la place d'un second formulaire tant qu'elle est en attente. */
function RequestCard({ request }: { request: OrganizationRequest }) {
  const pending = request.status === "pending";
  return (
    <section
      aria-labelledby="organization-request-title"
      className="flex max-w-xl flex-col gap-3 rounded-card border border-border p-4"
    >
      <h2 id="organization-request-title" className="text-md font-semibold text-text">
        {pending ? fr.organizations.pendingTitle : fr.organizations.acceptedTitle}
      </h2>
      <div className="flex items-center gap-3">
        <Avatar name={request.name} src={request.logoUrl ?? undefined} size={40} square />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-words font-medium text-text">{request.name}</span>
            <OrganizationLabel />
          </span>
          <span className="text-sm text-text-2">
            {fr.organizations.types[request.organizationType]}
          </span>
        </div>
      </div>
      {pending ? (
        <Badge className="self-start">{fr.organizations.pendingStatus}</Badge>
      ) : (
        request.organizationHandle && (
          <a
            href={`/u/${request.organizationHandle}`}
            className="self-start text-sm text-link hover:underline"
          >
            {fr.organizations.openPage}
          </a>
        )
      )}
    </section>
  );
}

export function OrganizationRequestPage() {
  const { status, isSuspended } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [organizationType, setOrganizationType] = useState<OrganizationType | "">("");
  const [country, setCountry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
  }, [status]);

  useEffect(() => {
    if (!logo) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const myRequest = useQuery({
    queryKey: MY_REQUEST_KEY,
    queryFn: getMyOrganizationRequest,
    enabled: status === "ready",
    staleTime: 0,
  });

  function chooseLogo(file: File | undefined) {
    if (!file) return;
    const valid =
      (ORGANIZATION_LOGO_MIME_TYPES as readonly string[]).includes(file.type) &&
      file.size <= ORGANIZATION_LOGO_MAX_BYTES;
    setErrors((current) => ({
      ...current,
      logo: valid ? undefined : fr.organizations.logoInvalid,
    }));
    setLogo(valid ? file : null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const nextErrors: FieldErrors<Field> = {};
    if (name.trim().length < 2) nextErrors.name = fr.organizations.nameRequired;
    if (!organizationType) nextErrors.organizationType = fr.organizations.typeRequired;
    if (!country) nextErrors.country = fr.organizations.countryRequired;
    if (websiteUrl.trim() && !isHttpsUrl(websiteUrl.trim()))
      nextErrors.websiteUrl = fr.organizations.websiteInvalid;
    if (errors.logo) nextErrors.logo = errors.logo;
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !organizationType) return;

    setSubmitting(true);
    try {
      const { request } = await sendOrganizationRequest({
        name: name.trim(),
        organizationType,
        country,
        websiteUrl: websiteUrl.trim(),
        description: description.trim(),
        logo,
      });
      queryClient.setQueryData(MY_REQUEST_KEY, { request });
      toast.show(fr.organizations.sent, "success");
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 409) {
        if (err.message.includes("nom")) setErrors({ name: fr.organizations.nameTaken });
        else void myRequest.refetch();
      } else {
        setError(
          err instanceof ChatApiError && err.statusCode === 400
            ? err.message
            : fr.organizations.sendError,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== "ready" || myRequest.isPending) {
    return (
      <RailPage activeSection="fil">
        <div className="flex max-w-xl flex-col gap-3" aria-hidden="true">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </RailPage>
    );
  }
  if (myRequest.isError) {
    return (
      <RailPage activeSection="fil">
        <ErrorState
          message={fr.organizations.loadingError}
          retry={{ label: fr.chat.retry, onClick: () => void myRequest.refetch() }}
        />
      </RailPage>
    );
  }

  const latest = myRequest.data.request;
  if (latest?.status === "pending") {
    return (
      <RailPage activeSection="fil">
        <h1 className="text-lg font-bold text-text">{fr.organizations.formTitle}</h1>
        <RequestCard request={latest} />
      </RailPage>
    );
  }

  return (
    <FormPage
      title={fr.organizations.formTitle}
      activeSection="fil"
      backHref="/fil?onglet=opportunites"
      submitLabel={fr.organizations.submit}
      submitting={submitting}
      submitDisabled={isSuspended}
      error={error}
      onSubmit={handleSubmit}
    >
      {latest?.status === "accepted" && <RequestCard request={latest} />}
      {latest?.status === "refused" && (
        <p className="text-sm text-text-2">{fr.organizations.refusedNote}</p>
      )}
      <FormField label={fr.organizations.nameLabel} error={errors.name}>
        <Input
          value={name}
          maxLength={ORGANIZATION_NAME_MAX_LENGTH}
          autoComplete="organization"
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <FormField label={fr.organizations.typeLabel} error={errors.organizationType}>
        <Select
          value={organizationType}
          onValueChange={(value) => setOrganizationType(value as OrganizationType)}
          options={TYPE_OPTIONS}
          placeholder={fr.organizations.typeLabel}
        />
      </FormField>
      <FormField label={fr.organizations.countryLabel} error={errors.country}>
        <CountrySelect
          value={country}
          onValueChange={setCountry}
          placeholder={fr.organizations.countryLabel}
        />
      </FormField>
      <FormField label={fr.organizations.websiteLabel} error={errors.websiteUrl}>
        <Input
          type="url"
          inputMode="url"
          value={websiteUrl}
          maxLength={300}
          placeholder="https://"
          onChange={(event) => setWebsiteUrl(event.target.value)}
        />
      </FormField>
      <FormField label={fr.organizations.descriptionLabel}>
        <Textarea
          value={description}
          maxLength={ORGANIZATION_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormField>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-text-2" id="organization-logo-label">
          {fr.organizations.logoLabel}
        </span>
        <div className="flex items-center gap-3">
          {logoPreview ? (
            <Avatar name={name || fr.organizations.logoLabel} src={logoPreview} size={40} square />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-[22%] bg-surface-2 text-subtle"
            >
              <Building2 className="size-5" />
            </span>
          )}
          <Button
            variant="secondary"
            aria-describedby={errors.logo ? "organization-logo-error" : undefined}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            {fr.organizations.chooseLogo}
          </Button>
          {logo && (
            <Button variant="ghost" onClick={() => setLogo(null)}>
              {fr.organizations.removeLogo}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ORGANIZATION_LOGO_MIME_TYPES.join(",")}
            aria-labelledby="organization-logo-label"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              chooseLogo(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        {errors.logo && (
          <p id="organization-logo-error" className="text-sm text-danger">
            {errors.logo}
          </p>
        )}
      </div>
    </FormPage>
  );
}
