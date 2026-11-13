import { ArrowLeft, PanelRight, Plus, Users } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Space } from "@kemet/shared";
import { ChatSearch } from "../search/ChatSearch.js";
import { useMobileChatView } from "../../lib/chat/useMobileChatView.js";
import { useEdgeSwipe } from "../../lib/useEdgeSwipe.js";
import { fr } from "../../i18n/fr.js";
import { AppFrame } from "../layout/AppFrame.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { Sheet } from "../ui/Sheet.js";
import type { ChannelListProps } from "./ChannelList.js";
import { RightPanel } from "./RightPanel.js";
import { sectionLabel } from "./railNav.js";
import { SpaceNavigator, type SpaceNavigatorStatus } from "./SpaceNavigator.js";
import type { SpaceItem } from "./types.js";

export interface AppShellSpaces {
  /** Titre de la liste : "Mes espaces", ou "Espaces publics" pour un visiteur. */
  title: string;
  items: SpaceItem[];
  activeSpaceId: string;
  onSelect: (id: string) => void;
  status: SpaceNavigatorStatus;
  onRetry: () => void;
  channelsLoading: boolean;
  channelsError: boolean;
  onRetryChannels: () => void;
  /** Faux pour un visiteur ou un compte suspendu : le lien n'est pas rendu. */
  canCreateSpace: boolean;
  /** Ouvre un espace trouvé par la recherche (espaces et personnes), en tête de la liste. */
  onOpenSearchedSpace: (space: Space) => void;
}

export interface AppShellProps {
  spaces: AppShellSpaces;
  channelList: ChannelListProps;
  activeMobileTabId: string;
  /** `openLabel` : mot du bouton qui ouvre le panneau sur téléphone, à la place d'une icône seule. */
  rightPanel?: { title: string; content: ReactNode; openLabel?: string };
  topBarExtra?: ReactNode;
  children: ReactNode;
}

function CreateSpaceLink() {
  return (
    <a
      href="/salons/nouveau"
      className="flex h-control w-full items-center gap-2 rounded-control px-2 text-sm font-medium text-link hover:bg-surface-2"
    >
      <Plus className="size-4 shrink-0" aria-hidden="true" />
      {fr.spaces.createTitle}
    </a>
  );
}

export function AppShell({
  spaces,
  channelList,
  activeMobileTabId,
  rightPanel,
  topBarExtra,
  children,
}: AppShellProps) {
  // Sous lg : la liste des espaces et des salons, ou une discussion en plein écran.
  const { view: mobileView, openChat, backToList } = useMobileChatView();
  const [rightSheetOpen, setRightSheetOpen] = useState(false);
  const swipeHandlers = useEdgeSwipe(backToList);
  const chatTitleRef = useRef<HTMLHeadingElement>(null);
  const navigatorRef = useRef<HTMLDivElement>(null);
  const previousView = useRef(mobileView);
  // Le bouton activé disparaît avec la vue : le focus suit le changement,
  // vers le titre du salon à l'entrée, vers le salon quitté au retour.
  useEffect(() => {
    if (previousView.current === "list" && mobileView === "chat") chatTitleRef.current?.focus();
    if (previousView.current === "chat" && mobileView === "list") {
      navigatorRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    }
    previousView.current = mobileView;
  }, [mobileView]);

  const activeChannelName = channelList.channels.find(
    (channel) => channel.id === channelList.activeChannelId,
  )?.name;

  return (
    <AppFrame
      activeSection="salons"
      activeMobileTab={activeMobileTabId}
      fixedHeight
      tabSwipe={mobileView === "list"}
      sidePanel={{
        title: sectionLabel("salons"),
        content: (
          <ChatSearch layout="panel" section="salons" onOpenSpace={spaces.onOpenSearchedSpace}>
            <SpaceNavigator
              layout="panel"
              title={spaces.title}
              status={spaces.status}
              onRetry={spaces.onRetry}
              spaces={spaces.items}
              activeSpaceId={spaces.activeSpaceId}
              onSelectSpace={spaces.onSelect}
              spaceName={channelList.spaceName}
              channels={channelList.channels}
              channelsLoading={spaces.channelsLoading}
              channelsError={spaces.channelsError}
              onRetryChannels={spaces.onRetryChannels}
              activeChannelId={channelList.activeChannelId}
              onSelectChannel={channelList.onSelect}
              canCreateSpace={false}
            />
          </ChatSearch>
        ),
        footer: spaces.canCreateSpace ? <CreateSpaceLink /> : undefined,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {mobileView === "list" && (
          <div
            ref={navigatorRef}
            className="flex min-h-0 flex-1 flex-col pb-[calc(44px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:hidden"
          >
            <ChatSearch
              layout="page"
              section="salons"
              onOpenSpace={spaces.onOpenSearchedSpace}
              visitorTitle={spaces.title}
            >
              <SpaceNavigator
                layout="page"
                title={spaces.title}
                status={spaces.status}
                onRetry={spaces.onRetry}
                spaces={spaces.items}
                activeSpaceId={spaces.activeSpaceId}
                onSelectSpace={spaces.onSelect}
                spaceName={channelList.spaceName}
                channels={channelList.channels}
                channelsLoading={spaces.channelsLoading}
                channelsError={spaces.channelsError}
                onRetryChannels={spaces.onRetryChannels}
                activeChannelId={channelList.activeChannelId}
                onSelectChannel={(id) => {
                  channelList.onSelect(id);
                  openChat();
                }}
                canCreateSpace={spaces.canCreateSpace}
              />
            </ChatSearch>
          </div>
        )}
        <div
          className={`min-h-0 flex-1 flex-col ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}
          {...swipeHandlers}
        >
          <header className="flex min-h-12 shrink-0 items-center justify-between border-b border-border px-3 py-1 lg:h-12 lg:px-4 lg:py-0">
            <IconButton
              aria-label={fr.shell.backToChannelList}
              className="lg:hidden"
              onClick={backToList}
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </IconButton>
            {/* Sous lg, le salon d'abord, en entier sur deux lignes au plus,
              l'espace en dessous : "Espace · #salon" sur une ligne
              coupait le nom du salon dès que l'espace avait un nom long. */}
            <h1
              ref={chatTitleRef}
              tabIndex={-1}
              className="flex min-w-0 flex-1 flex-col px-2 outline-none lg:hidden"
            >
              <span className="line-clamp-2 break-words text-md font-semibold leading-tight text-text">
                {activeChannelName ?? channelList.spaceName}
              </span>
              {activeChannelName && (
                <span className="truncate text-xs text-muted">{channelList.spaceName}</span>
              )}
            </h1>
            {/* Sur bureau, le panneau latéral peut être replié : l'en-tête
              rappelle donc aussi l'espace, pas seulement le salon. */}
            {(activeChannelName || channelList.spaceName) && (
              <h2 className="hidden min-w-0 truncate text-md font-semibold text-text lg:block">
                {activeChannelName ? `#${activeChannelName}` : channelList.spaceName}
                {activeChannelName && channelList.spaceName && (
                  <span className="font-normal text-muted"> · {channelList.spaceName}</span>
                )}
              </h2>
            )}
            <div className="flex items-center gap-2">
              {topBarExtra}
              {/* Sous lg le panneau devient une feuille, sans autre point
                d'entree que ce bouton. Au-dessus il est affiche en colonne et
                se ferme par sa propre croix : un bouton de bascule de plus
                encombrait la barre du haut. */}
              {rightPanel?.openLabel ? (
                <Button
                  variant="ghost"
                  aria-haspopup="dialog"
                  aria-expanded={rightSheetOpen}
                  className="gap-1.5 px-2 lg:hidden"
                  onClick={() => setRightSheetOpen(true)}
                >
                  <Users className="size-4" aria-hidden="true" />
                  {rightPanel.openLabel}
                </Button>
              ) : (
                rightPanel && (
                  <IconButton
                    aria-label={fr.shell.openDetailsPanel}
                    className="lg:hidden"
                    onClick={() => setRightSheetOpen(true)}
                  >
                    <PanelRight className="size-5" aria-hidden="true" />
                  </IconButton>
                )
              )}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(44px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </main>
        </div>
      </div>

      {rightPanel && <RightPanel title={rightPanel.title}>{rightPanel.content}</RightPanel>}

      {rightPanel && (
        <Sheet
          open={rightSheetOpen}
          onOpenChange={setRightSheetOpen}
          side="bottom"
          title={rightPanel.title}
        >
          {rightPanel.content}
        </Sheet>
      )}
    </AppFrame>
  );
}
