import { ArrowLeft, PanelRight, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useEdgeSwipe } from "../../lib/useEdgeSwipe.js";
import { MobileSpaceNavigator } from "./MobileSpaceNavigator.js";
import { fr } from "../../i18n/fr.js";
import { AppFrame } from "../layout/AppFrame.js";
import { IconButton } from "../ui/IconButton.js";
import { Sheet } from "../ui/Sheet.js";
import type { ChannelListProps } from "./ChannelList.js";
import { RightPanel } from "./RightPanel.js";
import { SalonsSegment } from "./SalonsSegment.js";
import { sectionLabel } from "./railNav.js";
import { SpaceTree, type SpaceTreeStatus } from "./SpaceTree.js";
import type { SpaceItem } from "./types.js";

export interface AppShellSpaces {
  /** Titre de la liste : "Mes espaces", ou "Espaces publics" pour un visiteur. */
  title: string;
  items: SpaceItem[];
  activeSpaceId: string;
  onSelect: (id: string) => void;
  status: SpaceTreeStatus;
  onRetry: () => void;
  channelsLoading: boolean;
  /** Faux pour un visiteur ou un compte suspendu : le lien n'est pas rendu. */
  canCreateSpace: boolean;
}

export interface AppShellProps {
  spaces: AppShellSpaces;
  channelList: ChannelListProps;
  activeMobileTabId: string;
  rightPanel?: { title: string; content: ReactNode };
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
  // Sous lg : la liste des espaces et des salons, ou une discussion en plein
  // écran. Une adresse qui désigne un espace ou un salon (lien partagé,
  // espace tout juste créé ou rejoint) ouvre directement la discussion.
  const [mobileView, setMobileView] = useState<"list" | "chat">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("channel") || params.has("space") ? "chat" : "list";
  });
  const [rightSheetOpen, setRightSheetOpen] = useState(false);
  const swipeHandlers = useEdgeSwipe(() => setMobileView("list"));

  const activeChannelName = channelList.channels.find(
    (channel) => channel.id === channelList.activeChannelId,
  )?.name;

  return (
    <AppFrame
      activeSection="salons"
      activeMobileTab={activeMobileTabId}
      fixedHeight
      sidePanel={{
        title: sectionLabel("salons"),
        content: (
          <SpaceTree
            title={spaces.title}
            status={spaces.status}
            onRetry={spaces.onRetry}
            spaces={spaces.items}
            activeSpaceId={spaces.activeSpaceId}
            onSelectSpace={spaces.onSelect}
            channels={channelList.channels}
            channelsLoading={spaces.channelsLoading}
            activeChannelId={channelList.activeChannelId}
            onSelectChannel={channelList.onSelect}
          />
        ),
        footer: spaces.canCreateSpace ? <CreateSpaceLink /> : undefined,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {mobileView === "list" && (
          <div className="flex min-h-0 flex-1 flex-col pb-[calc(44px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:hidden">
            <SalonsSegment active="salons" />
            <MobileSpaceNavigator
              title={spaces.title}
              status={spaces.status}
              onRetry={spaces.onRetry}
              spaces={spaces.items}
              activeSpaceId={spaces.activeSpaceId}
              onSelectSpace={spaces.onSelect}
              spaceName={channelList.spaceName}
              channels={channelList.channels}
              channelsLoading={spaces.channelsLoading}
              activeChannelId={channelList.activeChannelId}
              onSelectChannel={(id) => {
                channelList.onSelect(id);
                setMobileView("chat");
              }}
              canCreateSpace={spaces.canCreateSpace}
            />
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
              onClick={() => setMobileView("list")}
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </IconButton>
            {/* Sous lg, le salon d'abord, en entier sur deux lignes au plus,
              l'espace en dessous : "Espace · #salon" sur une ligne
              coupait le nom du salon dès que l'espace avait un nom long. */}
            <h1 className="flex min-w-0 flex-1 flex-col px-2 lg:hidden">
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
              {rightPanel && (
                <IconButton
                  aria-label={fr.shell.openDetailsPanel}
                  className="lg:hidden"
                  onClick={() => setRightSheetOpen(true)}
                >
                  <PanelRight className="size-5" aria-hidden="true" />
                </IconButton>
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
