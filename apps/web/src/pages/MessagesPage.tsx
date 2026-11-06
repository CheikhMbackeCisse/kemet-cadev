import { MessagesSquare, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { ConversationBox } from "@kemet/shared";
import { AppFrame } from "../components/layout/AppFrame.js";
import { ConversationList, ConversationListSkeleton } from "../components/messaging/ConversationList.js";
import { ConversationView } from "../components/messaging/ConversationView.js";
import { SalonsSegment } from "../components/shell/SalonsSegment.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Tabs } from "../components/ui/Tabs.js";
import { useConversationUnread } from "../lib/messaging/conversationUnread.js";
import { useConversationList } from "../lib/messaging/useConversationList.js";
import { useMediaQuery } from "../lib/useMediaQuery.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

const REQUESTS_PARAM = "demandes";
const LIST_HEADING_ID = "messages-heading";

function readConversationId(pathname: string): string | null {
  const match = pathname.match(/^\/messages\/([0-9a-f-]{36})$/);
  return match?.[1] ?? null;
}

function readBox(): ConversationBox {
  return new URLSearchParams(window.location.search).has(REQUESTS_PARAM) ? "requests" : "inbox";
}

function NewConversationLink() {
  return (
    <a
      href="/messages/nouveau"
      className="flex h-control w-full items-center gap-2 rounded-control px-2 text-sm font-medium text-link hover:bg-surface-2 max-lg:h-control-mobile"
    >
      <Plus className="size-4 shrink-0" aria-hidden="true" />
      {fr.messages.newConversation}
    </a>
  );
}

function ConversationBoxes({ activeConversationId }: { activeConversationId: string | null }) {
  const { profile } = useSession();
  const [box, setBox] = useState<ConversationBox>(readBox);
  const inbox = useConversationList("inbox", box === "inbox");
  const requests = useConversationList("requests", box === "requests");
  const pendingRequests = useConversationUnread(true)?.pendingRequests ?? 0;

  function changeBox(next: string) {
    const value = next as ConversationBox;
    setBox(value);
    const url = new URL(window.location.href);
    if (value === "requests") url.searchParams.set(REQUESTS_PARAM, "");
    else url.searchParams.delete(REQUESTS_PARAM);
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <Tabs
      value={box}
      onValueChange={changeBox}
      className="px-3 pt-1"
      items={[
        {
          value: "inbox",
          label: fr.messages.inbox,
          content: (
            <div className="-mx-3 -mt-2">
              <ConversationList box="inbox" list={inbox} activeConversationId={activeConversationId} viewerId={profile?.id ?? null} />
            </div>
          ),
        },
        {
          value: "requests",
          label:
            pendingRequests > 0 ? (
              <>
                {fr.messages.requests}
                <span aria-hidden="true"> · {pendingRequests}</span>
                <span className="sr-only">{fr.messages.requestsCountSr(pendingRequests)}</span>
              </>
            ) : (
              fr.messages.requests
            ),
          content: (
            <div className="-mx-3 -mt-2">
              <ConversationList
                box="requests"
                list={requests}
                activeConversationId={activeConversationId}
                viewerId={profile?.id ?? null}
              />
            </div>
          ),
        },
      ]}
    />
  );
}

export function MessagesPage() {
  const { status } = useSession();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [conversationId, setConversationId] = useState(() => readConversationId(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setConversationId(readConversationId(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function backToList() {
    window.history.pushState(null, "", "/messages");
    setConversationId(null);
    // La conversation disparaît avec le bouton qui avait le focus.
    requestAnimationFrame(() => document.getElementById(LIST_HEADING_ID)?.focus());
  }

  useEffect(() => {
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  if (status === "loading" || status === "incomplete") {
    return (
      <AppFrame activeSection="messages" activeMobileTab="salons" fixedHeight>
        <div className="flex-1">
          <ConversationListSkeleton />
        </div>
      </AppFrame>
    );
  }

  if (status !== "ready") {
    return (
      <AppFrame activeSection="messages" activeMobileTab="salons">
        <main className="flex flex-1 items-center justify-center p-4">
          <EmptyState
            icon={MessagesSquare}
            message={fr.messages.signInRequired}
            action={{ label: fr.messages.signIn, onClick: () => (window.location.href = "/connexion") }}
          />
        </main>
      </AppFrame>
    );
  }

  const conversation = conversationId ? (
    <ConversationView key={conversationId} conversationId={conversationId} onClosed={backToList} />
  ) : (
    <div className="flex h-full items-center justify-center">
      <EmptyState icon={MessagesSquare} message={fr.messages.noSelection} />
    </div>
  );

  return (
    <AppFrame
      activeSection="messages"
      activeMobileTab="salons"
      fixedHeight
      // Sous lg, la liste vit dans la page : la monter aussi dans le panneau
      // masqué la chargerait deux fois.
      sidePanel={
        isDesktop
          ? {
              title: fr.messages.title,
              content: <ConversationBoxes activeConversationId={conversationId} />,
              footer: <NewConversationLink />,
            }
          : undefined
      }
    >
      <main className="flex min-w-0 flex-1 flex-col pb-[calc(44px+env(safe-area-inset-bottom))] lg:pb-0">
        <h1 id={LIST_HEADING_ID} tabIndex={-1} className="sr-only">
          {fr.messages.title}
        </h1>
        {isDesktop ? (
          conversation
        ) : conversationId ? (
          conversation
        ) : (
          <>
            <SalonsSegment active="messages" />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConversationBoxes activeConversationId={null} />
              <div className="border-t border-border px-2 py-3">
                <NewConversationLink />
              </div>
            </div>
          </>
        )}
      </main>
    </AppFrame>
  );
}
