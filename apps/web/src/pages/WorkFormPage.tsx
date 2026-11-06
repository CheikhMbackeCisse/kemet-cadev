import { FileText, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { WorkAttachment, WorkDetail, WorkLinkType, WorkStatus, WorkType } from "@kemet/shared";
import {
  ChatApiError,
  createWork,
  getUserProfile,
  getWork,
  inviteWorkCoauthor,
  removeWorkCoauthor,
  updateWork,
  uploadWorkAttachment,
} from "../lib/chat/api.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";
import { FormPage } from "../components/layout/FormPage.js";
import { RailPage } from "../components/layout/RailPage.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Checkbox } from "../components/ui/Checkbox.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { useToast } from "../components/ui/Toast.js";
import {
  formatFileSize,
  WORK_LINK_TYPE_LABELS,
  WORK_LINK_TYPES,
  WORK_STATUS_LABELS,
  WORK_STATUSES,
  WORK_TYPE_LABELS,
  WORK_TYPES,
} from "../components/works/workLabels.js";
import { useSession } from "../session/SessionProvider.js";
import { missingFieldsReason } from "../lib/forms.js";
import { slugify } from "../lib/slugify.js";
import { fr } from "../i18n/fr.js";

const MAX_SLUG_LENGTH = 80;

interface LinkDraft {
  key: number;
  type: WorkLinkType;
  url: string;
  label: string;
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

/** `/travaux/nouveau` ou `/travaux/:slug/modifier`. */
function readEditedSlug(pathname: string): string | null {
  const match = pathname.match(/^\/travaux\/([^/]+)\/modifier\/?$/);
  return match ? decodeURIComponent(match[1]!) : null;
}

const STATUS_LABELS = {
  pending: fr.works.coauthorStatusPending,
  accepted: fr.works.coauthorStatusAccepted,
  declined: fr.works.coauthorStatusDeclined,
};

export function WorkFormPage() {
  const editedSlug = readEditedSlug(window.location.pathname);
  const { status, profile } = useSession();
  const [existing, setExisting] = useState<WorkDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error" | "forbidden">(
    editedSlug ? "loading" : "ready",
  );

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
  }, [status]);

  useEffect(() => {
    if (!editedSlug || status !== "ready") return;
    getWork(editedSlug)
      .then(({ work }) => {
        setExisting(work);
        setLoadState(work.viewerRole === "publisher" ? "ready" : "forbidden");
      })
      .catch(() => setLoadState("error"));
  }, [editedSlug, status]);

  if (loadState === "loading" || status === "loading" || status === "visitor") {
    return (
      <RailPage activeSection="travaux">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-xl" />
      </RailPage>
    );
  }
  if (loadState === "error" || loadState === "forbidden") {
    return (
      <RailPage activeSection="travaux">
        <ErrorState
          message={loadState === "forbidden" ? fr.works.notFound : fr.works.loadingError}
          retry={{ label: fr.works.back, onClick: () => (window.location.href = "/travaux") }}
        />
      </RailPage>
    );
  }
  return <WorkForm existing={existing} ownHandle={profile?.handle ?? null} />;
}

function WorkForm({
  existing,
  ownHandle,
}: {
  existing: WorkDetail | null;
  ownHandle: string | null;
}) {
  const toast = useToast();
  const isEdit = existing !== null;
  const nextLinkKey = useRef(existing?.links.length ?? 1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [type, setType] = useState<WorkType | "">(existing?.type ?? "");
  const [workStatus, setWorkStatus] = useState<WorkStatus>(existing?.status ?? "completed");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [stack, setStack] = useState(existing?.stack.join(", ") ?? "");
  const [year, setYear] = useState(existing?.year ? String(existing.year) : "");
  const [institution, setInstitution] = useState(existing?.institution ?? "");
  const [links, setLinks] = useState<LinkDraft[]>(
    existing?.links.map((link, index) => ({
      key: index,
      type: link.type,
      url: link.url,
      label: link.label ?? "",
    })) ?? [{ key: 0, type: "github", url: "", label: "" }],
  );
  const [attachment, setAttachment] = useState<WorkAttachment | null>(existing?.attachment ?? null);
  const [uploading, setUploading] = useState(false);
  const [coauthorHandles, setCoauthorHandles] = useState<string[]>([]);
  const [invitations, setInvitations] = useState(existing?.invitations ?? []);
  const [coauthorDraft, setCoauthorDraft] = useState("");
  const [coauthorError, setCoauthorError] = useState<string | null>(null);
  const [externalAuthors, setExternalAuthors] = useState<string[]>(existing?.externalAuthors ?? []);
  const [externalDraft, setExternalDraft] = useState("");
  const [publishRight, setPublishRight] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDriveLink = links.some(
    (link) => link.type === "drive" || link.url.includes("drive.google."),
  );

  function updateLink(key: number, patch: Partial<LinkDraft>) {
    setLinks((current) => current.map((link) => (link.key === key ? { ...link, ...patch } : link)));
  }

  function removeLink(key: number) {
    setLinks((current) => current.filter((item) => item.key !== key));
  }

  function addLink() {
    setLinks((current) => [
      ...current,
      { key: nextLinkKey.current++, type: "site", url: "", label: "" },
    ]);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setAttachment(await uploadWorkAttachment(file));
    } catch {
      toast.show(fr.works.pdfUploadError, "danger");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function addCoauthor() {
    const handle = normalizeHandle(coauthorDraft);
    if (!handle) return;
    setCoauthorError(null);
    if (handle === ownHandle) {
      setCoauthorError(fr.works.coauthorSelf);
      return;
    }
    if (isEdit) {
      try {
        const { work } = await inviteWorkCoauthor(existing.slug, handle);
        setInvitations(work.invitations ?? []);
        setCoauthorDraft("");
      } catch (err) {
        setCoauthorError(
          err instanceof ChatApiError && err.statusCode === 409
            ? fr.works.coauthorAlreadyInvited
            : err instanceof ChatApiError && err.statusCode === 400
              ? fr.works.coauthorNotFound(handle)
              : fr.works.coauthorInviteError,
        );
      }
      return;
    }
    try {
      await getUserProfile(handle);
    } catch {
      setCoauthorError(fr.works.coauthorNotFound(handle));
      return;
    }
    setCoauthorHandles((current) => (current.includes(handle) ? current : [...current, handle]));
    setCoauthorDraft("");
  }

  async function removeInvitation(handle: string) {
    if (!existing) return;
    try {
      await removeWorkCoauthor(existing.slug, handle);
      setInvitations((current) => current.filter((entry) => entry.person.handle !== handle));
    } catch {
      toast.show(fr.works.coauthorRemoveError, "danger");
    }
  }

  function addExternalAuthor() {
    const name = externalDraft.trim();
    if (!name) return;
    setExternalAuthors((current) => (current.includes(name) ? current : [...current, name]));
    setExternalDraft("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!type) return;
    setError(null);
    setSubmitting(true);
    const fields = {
      title: title.trim(),
      type,
      status: workStatus,
      summary,
      tags: parseList(tags),
      stack: parseList(stack),
      year: year.trim() ? Number(year) : null,
      institution: institution.trim() || null,
      links: links
        .filter((link) => link.url.trim())
        .map((link) => ({
          type: link.type,
          url: link.url.trim(),
          label: link.label.trim() || null,
        })),
      externalAuthors,
      attachmentId: attachment?.id ?? null,
    };
    try {
      const { work } = isEdit
        ? await updateWork(existing.slug, fields)
        : await createWork({ ...fields, slug, publishRightConfirmed: true, coauthorHandles });
      window.location.href = `/travaux/${work.slug}`;
    } catch (err) {
      if (err instanceof ChatApiError && err.statusCode === 409) setError(fr.works.slugTaken);
      else if (err instanceof ChatApiError && err.code === "invalid_input")
        setError(fr.works.invalidInput);
      else if (err instanceof ChatApiError && err.statusCode === 400)
        setError(fr.works.checkCoauthorsAndPdf);
      else setError(isEdit ? fr.works.saveError : fr.works.createError);
      setSubmitting(false);
    }
  }

  const missing = missingFieldsReason([
    [title, fr.works.titleLabel],
    ...(isEdit ? [] : ([[slug, fr.works.slugLabel]] as const)),
    [type, fr.works.typeLabel],
    [summary, fr.works.summaryLabel],
    ...(publishRight ? [] : ([["", fr.works.publishRightRequired]] as const)),
  ]);

  return (
    <FormPage
      title={isEdit ? fr.works.editTitle : fr.works.createTitle}
      subtitle={isEdit ? fr.works.editSubtitle : fr.works.createSubtitle}
      activeSection="travaux"
      backHref={isEdit ? `/travaux/${existing.slug}` : "/travaux"}
      submitLabel={isEdit ? fr.works.save : fr.works.publish}
      submitting={submitting}
      submitDisabled={uploading}
      submitDisabledReason={uploading ? fr.works.pdfUploading : missing}
      error={error}
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.works.titleLabel}
        <Input
          value={title}
          maxLength={140}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!isEdit) setSlug(slugify(event.target.value).slice(0, MAX_SLUG_LENGTH));
          }}
        />
      </label>
      {!isEdit && (
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {fr.works.slugLabel}
          <Input
            value={slug}
            onChange={(event) => setSlug(slugify(event.target.value).slice(0, MAX_SLUG_LENGTH))}
          />
          <span className="text-xs text-subtle">{fr.works.slugHint}</span>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.works.typeLabel}
        <Select
          value={type}
          onValueChange={(value) => setType(value as WorkType)}
          aria-label={fr.works.typeLabel}
          placeholder={fr.works.typePlaceholder}
          options={WORK_TYPES.map((value) => ({ value, label: WORK_TYPE_LABELS[value] }))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.works.statusLabel}
        <Select
          value={workStatus}
          onValueChange={(value) => setWorkStatus(value as WorkStatus)}
          aria-label={fr.works.statusLabel}
          options={WORK_STATUSES.map((value) => ({ value, label: WORK_STATUS_LABELS[value] }))}
        />
      </label>
      <div className="flex flex-col gap-1">
        <CodeTextarea
          label={fr.works.summaryLabel}
          value={summary}
          onValueChange={setSummary}
          maxLength={6000}
        />
        <span className="text-xs text-subtle">{fr.works.summaryHint}</span>
      </div>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.works.tagsLabel}
        <Input value={tags} onChange={(event) => setTags(event.target.value)} />
        <span className="text-xs text-subtle">{fr.works.tagsHint}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.works.stackLabel}
        <Input value={stack} onChange={(event) => setStack(event.target.value)} />
      </label>
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className="flex flex-col gap-1 text-sm text-text-2 sm:w-40">
          {fr.works.yearLabel}
          <Input
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm text-text-2">
          {fr.works.institutionLabel}
          <Input
            value={institution}
            maxLength={120}
            onChange={(event) => setInstitution(event.target.value)}
          />
        </label>
      </div>

      <div className="border-t border-border pt-4">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-md font-semibold text-text">{fr.works.linksTitle}</legend>
          {links.map((link, index) => (
            <div
              key={link.key}
              className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:border-0 sm:pb-0"
            >
              <p className="text-xs font-medium text-text-2 sm:hidden">
                {fr.works.linkNumber(index + 1)}
              </p>
              <Select
                value={link.type}
                onValueChange={(value) => updateLink(link.key, { type: value as WorkLinkType })}
                aria-label={`${fr.works.linkTypeLabel} ${index + 1}`}
                options={WORK_LINK_TYPES.map((value) => ({
                  value,
                  label: WORK_LINK_TYPE_LABELS[value],
                }))}
                className="sm:w-32"
              />
              <Input
                aria-label={`${fr.works.linkUrlLabel} ${index + 1}`}
                placeholder="https://"
                inputMode="url"
                value={link.url}
                onChange={(event) => updateLink(link.key, { url: event.target.value })}
                className="sm:flex-1"
              />
              <Input
                aria-label={`${fr.works.linkLabelLabel} ${index + 1}`}
                placeholder={fr.works.linkLabelLabel}
                value={link.label}
                maxLength={60}
                onChange={(event) => updateLink(link.key, { label: event.target.value })}
                className="sm:w-40"
              />
              <IconButton
                type="button"
                aria-label={`${fr.works.removeLink} ${index + 1}`}
                onClick={() => removeLink(link.key)}
                className="max-sm:hidden"
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeLink(link.key)}
                className="self-start sm:hidden"
              >
                {fr.works.removeLink}
              </Button>
            </div>
          ))}
          {hasDriveLink && (
            <p className="text-xs text-muted" role="note">
              {fr.works.driveReminder}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={addLink}
            className="self-start"
            disabled={links.length >= 8}
          >
            <Plus className="size-4" aria-hidden="true" />
            {fr.works.addLink}
          </Button>
        </fieldset>
      </div>

      <div className="border-t border-border pt-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-md font-semibold text-text">{fr.works.pdfLabel}</legend>
          <p className="text-xs text-subtle">{fr.works.pdfHint}</p>
          {attachment && (
            <div className="flex items-center gap-2 text-sm text-text">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="truncate">{attachment.originalName}</span>
              <span className="shrink-0 text-xs text-subtle">
                {formatFileSize(attachment.byteSize)}
              </span>
              <IconButton
                type="button"
                aria-label={fr.works.pdfRemove}
                onClick={() => setAttachment(null)}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {attachment ? fr.works.pdfReplace : fr.works.pdfChoose}
          </Button>
        </fieldset>
      </div>

      <div className="border-t border-border pt-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-md font-semibold text-text">{fr.works.coauthorsTitle}</legend>
          <p className="text-xs text-subtle">{fr.works.coauthorsHint}</p>
          <ul className="flex flex-wrap gap-2">
            {coauthorHandles.map((handle) => (
              <li
                key={handle}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-3 pr-1 text-sm"
              >
                @{handle}
                <IconButton
                  className="size-6 max-md:size-control-mobile"
                  type="button"
                  aria-label={fr.works.removeCoauthor(handle)}
                  onClick={() =>
                    setCoauthorHandles((current) => current.filter((item) => item !== handle))
                  }
                >
                  <X className="size-3.5" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
            {invitations.map((entry) => (
              <li
                key={entry.person.id}
                className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-0.5 pl-3 pr-1 text-sm"
              >
                @{entry.person.handle}
                <Badge tone={entry.status === "accepted" ? "success" : "neutral"}>
                  {STATUS_LABELS[entry.status]}
                </Badge>
                {entry.status !== "declined" && (
                  <IconButton
                    className="size-6 max-md:size-control-mobile"
                    type="button"
                    aria-label={fr.works.removeCoauthor(entry.person.handle)}
                    onClick={() => removeInvitation(entry.person.handle)}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Input
              aria-label={fr.works.coauthorHandleLabel}
              placeholder={fr.works.coauthorHandlePlaceholder}
              value={coauthorDraft}
              onChange={(event) => setCoauthorDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addCoauthor();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addCoauthor}
              disabled={!coauthorDraft.trim()}
            >
              {fr.works.addCoauthor}
            </Button>
          </div>
          {coauthorError && (
            <p className="text-xs text-danger" role="alert">
              {coauthorError}
            </p>
          )}
        </fieldset>
      </div>

      <div className="border-t border-border pt-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-md font-semibold text-text">
            {fr.works.externalAuthorsTitle}
          </legend>
          <p className="text-xs text-subtle">{fr.works.externalAuthorsHint}</p>
          <ul className="flex flex-wrap gap-2">
            {externalAuthors.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-3 pr-1 text-sm"
              >
                {name}
                <IconButton
                  className="size-6 max-md:size-control-mobile"
                  type="button"
                  aria-label={fr.works.removeExternalAuthor(name)}
                  onClick={() =>
                    setExternalAuthors((current) => current.filter((item) => item !== name))
                  }
                >
                  <X className="size-3.5" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Input
              aria-label={fr.works.externalAuthorLabel}
              placeholder={fr.works.externalAuthorLabel}
              value={externalDraft}
              maxLength={80}
              onChange={(event) => setExternalDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addExternalAuthor();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addExternalAuthor}
              disabled={!externalDraft.trim()}
            >
              {fr.works.addExternalAuthor}
            </Button>
          </div>
        </fieldset>
      </div>

      {!isEdit && (
        <label className="flex items-start gap-3 border-t border-border pt-4 text-sm text-text">
          <Checkbox
            checked={publishRight}
            onCheckedChange={setPublishRight}
            className="mt-0.5 shrink-0"
          />
          <span>{fr.works.publishRightLabel}</span>
        </label>
      )}
    </FormPage>
  );
}
