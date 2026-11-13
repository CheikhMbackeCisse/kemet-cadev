import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { COUNTRIES, type OrganizationRequest } from "@kemet/shared";
import { decideOrganizationRequest, listPendingOrganizationRequests } from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";
import { Avatar } from "../ui/Avatar.js";
import { Button } from "../ui/Button.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { useToast } from "../ui/Toast.js";

const QUERY_KEY = ["organization-requests"];

function RequestRow({
  request,
  busy,
  onDecide,
}: {
  request: OrganizationRequest;
  busy: boolean;
  onDecide: (decision: "accept" | "refuse") => void;
}) {
  const countryName = COUNTRIES.find((country) => country.code === request.country)?.name;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-3">
        <Avatar name={request.name} src={request.logoUrl ?? undefined} size={40} square />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="break-words font-medium text-text">{request.name}</span>
          <span className="text-sm text-text-2">
            {fr.organizations.types[request.organizationType]}
            {countryName && ` · ${countryName}`}
          </span>
          {request.websiteUrl && (
            <a
              href={request.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all text-sm text-link hover:underline"
            >
              {request.websiteUrl}
            </a>
          )}
          {request.description && (
            <p className="break-words text-sm text-text">{request.description}</p>
          )}
          <span className="text-xs text-subtle">
            <a href={`/u/${request.requesterHandle}`} className="hover:underline">
              {fr.organizations.requestedBy(request.requesterHandle)}
            </a>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-[52px]">
        <Button variant="secondary" disabled={busy} onClick={() => onDecide("accept")}>
          {fr.organizations.accept}
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          disabled={busy}
          onClick={() => onDecide("refuse")}
        >
          {fr.organizations.refuse}
        </Button>
      </div>
    </li>
  );
}

/** Demandes de référencement en attente, dans la page d'administration. */
export function OrganizationRequestsAdmin() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const requests = useQuery({ queryKey: QUERY_KEY, queryFn: listPendingOrganizationRequests });

  async function decide(request: OrganizationRequest, decision: "accept" | "refuse") {
    setBusyId(request.id);
    try {
      await decideOrganizationRequest(request.id, decision);
      queryClient.setQueryData<{ items: OrganizationRequest[] }>(QUERY_KEY, (data) =>
        data ? { items: data.items.filter((item) => item.id !== request.id) } : data,
      );
      toast.show(
        decision === "accept" ? fr.organizations.accepted(request.name) : fr.organizations.refused,
        "success",
      );
    } catch {
      toast.show(fr.organizations.decideError, "danger");
      void requests.refetch();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="organization-requests-title" className="flex flex-col gap-3">
      <h2 id="organization-requests-title" className="text-sm font-medium text-text">
        {fr.organizations.adminTitle}
      </h2>
      {requests.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : requests.isError ? (
        <ErrorState
          message={fr.moderation.loadingError}
          retry={{ label: fr.chat.retry, onClick: () => void requests.refetch() }}
        />
      ) : requests.data.items.length === 0 ? (
        <p className="text-sm text-subtle">{fr.organizations.adminEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {requests.data.items.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              busy={busyId === request.id}
              onDecide={(decision) => void decide(request, decision)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
