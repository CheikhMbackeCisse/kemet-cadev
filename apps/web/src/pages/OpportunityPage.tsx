import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isDeletedAccountHandle, type OpportunityDetail } from "@kemet/shared";
import {
  ChatApiError,
  deleteOpportunity,
  getOpportunity,
  openConversation,
} from "../lib/chat/api.js";
import { storeChannelDraft } from "../lib/chat/useChannelDraft.js";
import { navigate } from "../lib/navigation/navigate.js";
import {
  deadlineLabel,
  formatFcfa,
  formatOfferDate,
  kindLabel,
  locationLabel,
} from "../lib/opportunities/format.js";
import { SIGN_UP_PATH } from "../session/signUpInvite.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { RichText } from "../components/content/RichText.js";
import { ReadingPage } from "../components/layout/ReadingPage.js";
import { OPPORTUNITY_KIND_ICONS } from "../components/opportunities/OpportunityRow.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { ReportDialog } from "../components/moderation/ReportMenu.js";
import { MoreActionsMenu } from "../components/ui/MoreActionsMenu.js";
import { ProfileLink } from "../components/ui/ProfileLink.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";

function slugFromPath(): string {
  return decodeURIComponent(window.location.pathname.split("/")[2] ?? "");
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-base text-text">{children}</dd>
    </div>
  );
}

function OfferFacts({ offer }: { offer: OpportunityDetail }) {
  const deadline = offer.deadline ? formatOfferDate(offer.deadline) : null;
  return (
    <section aria-labelledby="offer-facts" className="rounded-card bg-surface-2 p-4">
      <h2 id="offer-facts" className="sr-only">
        {fr.opportunities.detailsTitle}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
        <Fact label={fr.opportunities.locationLabel}>{locationLabel(offer)}</Fact>
        {offer.contractType && (
          <Fact label={fr.opportunities.contractLabel}>
            {fr.opportunities.contracts[offer.contractType]}
          </Fact>
        )}
        {offer.startDate && (
          <Fact label={fr.opportunities.startLabel}>{formatOfferDate(offer.startDate)}</Fact>
        )}
        {offer.compensationFcfa !== null && (
          <Fact label={fr.opportunities.compensationLabel}>
            {fr.opportunities.perMonth(formatFcfa(offer.compensationFcfa))}
          </Fact>
        )}
        {offer.budgetMinFcfa !== null && offer.budgetMaxFcfa !== null && (
          <Fact label={fr.opportunities.budgetLabel}>
            {offer.budgetMinFcfa === offer.budgetMaxFcfa
              ? `${formatFcfa(offer.budgetMinFcfa)} FCFA`
              : `${formatFcfa(offer.budgetMinFcfa)} à ${formatFcfa(offer.budgetMaxFcfa)} FCFA`}
          </Fact>
        )}
        {deadline && <Fact label={fr.opportunities.deadlineLabel}>{deadline}</Fact>}
        <Fact label={fr.opportunities.domainsLabel}>
          {offer.domains
            .map(
              (domain) =>
                fr.onboarding.interests[domain as keyof typeof fr.onboarding.interests] ?? domain,
            )
            .join(", ")}
        </Fact>
      </dl>
    </section>
  );
}

/** Postuler ou proposer ses services : une demande de conversation, avec un brouillon à relire. */
function ApplyAction({ offer }: { offer: OpportunityDetail }) {
  const { status, profile, isSuspended } = useSession();
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const isMission = offer.kind === "mission";

  if (offer.closed) return null;
  if (status === "visitor") {
    return (
      <a
        href={SIGN_UP_PATH}
        className="inline-flex h-control items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover max-md:h-control-mobile"
      >
        {isMission ? fr.opportunities.signUpToOffer : fr.opportunities.signUpToApply}
      </a>
    );
  }
  if (!profile) return null;
  if (profile.id === offer.authorId)
    return <p className="text-base text-muted">{fr.opportunities.ownOffer}</p>;

  async function handleApply() {
    if (!profile) return;
    setOpening(true);
    try {
      const { conversation } = await openConversation([offer.authorHandle]);
      const profileUrl = `${window.location.origin}/u/${profile.handle}`;
      const draft = isMission
        ? fr.opportunities.offerDraft(offer.title, profileUrl)
        : fr.opportunities.applyDraft(offer.title, profileUrl);
      storeChannelDraft(conversation.channelId, draft);
      navigate(`/messages/${conversation.id}`);
    } catch (error) {
      toast.show(
        error instanceof ChatApiError && error.statusCode < 500
          ? error.message
          : fr.opportunities.applyError,
        "danger",
      );
      setOpening(false);
    }
  }

  return (
    <Button onClick={handleApply} disabled={opening || isSuspended} className="self-start">
      {isMission ? fr.opportunities.offerServices : fr.opportunities.apply}
    </Button>
  );
}

export function OpportunityPage() {
  const slug = slugFromPath();
  const { profile } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const query = useQuery({
    queryKey: ["opportunity", slug],
    queryFn: () => getOpportunity(slug),
    retry: (count, error) =>
      !(error instanceof ChatApiError && error.statusCode === 404) && count < 2,
  });
  const offer = query.data?.opportunity;
  const isAuthor = offer !== undefined && profile?.id === offer.authorId;
  const menuItems = isAuthor
    ? [
        { value: "edit", label: fr.opportunities.edit },
        { value: "delete", label: fr.opportunities.delete, danger: true },
      ]
    : profile
      ? [{ value: "report", label: fr.moderation.reportAction }]
      : [];

  function onMenuSelect(value: string) {
    if (value === "edit") navigate(`/opportunites/${offer!.slug}/modifier`);
    if (value === "delete") setDeleteOpen(true);
    if (value === "report") setReportOpen(true);
  }

  const header = (
    <a
      href="/fil?onglet=opportunites"
      className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {fr.opportunities.tab}
    </a>
  );

  const state = query.isPending
    ? ({ kind: "loading" } as const)
    : query.error instanceof ChatApiError && query.error.statusCode === 404
      ? ({ kind: "notFound", message: fr.opportunities.notFound } as const)
      : query.isError || !offer
        ? ({
            kind: "error",
            message: fr.opportunities.loadingError,
            retry: { label: fr.chat.retry, onClick: () => void query.refetch() },
          } as const)
        : undefined;

  async function handleDelete() {
    setDeleteOpen(false);
    try {
      await deleteOpportunity(slug);
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      navigate("/fil?onglet=opportunites");
    } catch {
      toast.show(fr.opportunities.deleteError, "danger");
    }
  }

  const Icon = offer ? OPPORTUNITY_KIND_ICONS[offer.kind] : null;
  const deadline = offer ? deadlineLabel(offer) : null;

  return (
    <ReadingPage
      activeSection="fil"
      header={header}
      state={state}
      loadingSkeleton={
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      {offer && Icon && (
        <article className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-card bg-surface-2 text-text-2"
            >
              <Icon className="size-6" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{kindLabel(offer)}</Badge>
                {offer.closed && <Badge tone="danger">{fr.opportunities.closed}</Badge>}
              </div>
              <h1 className="break-words text-xl font-bold text-text">{offer.title}</h1>
              <p className="text-base text-text-2">
                {offer.organization}
                <span aria-hidden="true"> · </span>
                {locationLabel(offer)}
              </p>
            </div>
            {menuItems.length > 0 && <MoreActionsMenu items={menuItems} onSelect={onMenuSelect} />}
          </div>

          <div className="flex flex-col gap-2">
            <ApplyAction offer={offer} />
            {deadline && <p className="text-base text-muted">{deadline}</p>}
          </div>

          <OfferFacts offer={offer} />

          <RichText source={offer.description} className="text-base text-text" />

          {offer.criteria.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-md font-semibold text-text">{fr.opportunities.criteriaTitle}</h2>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-text">
                {offer.criteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 className="text-xs text-muted">{fr.opportunities.publishedBy}</h2>
            <ProfileLink handle={offer.authorHandle} className="flex w-fit items-center gap-2">
              <Avatar
                deleted={isDeletedAccountHandle(offer.authorHandle)}
                name={offer.authorDisplayName}
                src={offer.authorAvatarUrl ?? undefined}
                countryCode={offer.authorCountry}
              />
              <UserName name={offer.authorDisplayName} level={offer.authorLevel} />
            </ProfileLink>
          </section>
        </article>
      )}

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={fr.opportunities.delete}
        description={fr.opportunities.deleteConfirm}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            {fr.opportunities.cancel}
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            {fr.opportunities.delete}
          </Button>
        </div>
      </Dialog>

      {offer && !isAuthor && (
        <ReportDialog
          contentType="opportunity"
          contentId={offer.id}
          authorId={offer.authorId}
          authorHandle={offer.authorHandle}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
        />
      )}
    </ReadingPage>
  );
}
