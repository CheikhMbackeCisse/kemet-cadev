import { Menu as MenuIcon, PanelRight, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { fr } from "../../i18n/fr.js";
import { IconButton } from "../ui/IconButton.js";
import { Sheet } from "../ui/Sheet.js";
import { ChannelList, type ChannelListProps } from "./ChannelList.js";
import { MobileTabBar } from "./MobileTabBar.js";
import { RightPanel } from "./RightPanel.js";
import { SpaceRail, type SpaceRailProps } from "./SpaceRail.js";

export interface AppShellProps {
  spaceRail: SpaceRailProps;
  channelList: ChannelListProps;
  activeMobileTabId: string;
  rightPanel?: { title: string; content: ReactNode };
  topBarExtra?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  spaceRail,
  channelList,
  activeMobileTabId,
  rightPanel,
  topBarExtra,
  children,
}: AppShellProps) {
  const [channelDrawerOpen, setChannelDrawerOpen] = useState(false);
  const [rightSheetOpen, setRightSheetOpen] = useState(false);

  const activeChannelName = channelList.channels.find(
    (channel) => channel.id === channelList.activeChannelId,
  )?.name;

  return (
    <div className="flex h-viewport w-full overflow-hidden overscroll-none bg-bg">
      <SpaceRail {...spaceRail} />

      <div className="hidden w-channel-list shrink-0 flex-col border-r border-border-strong bg-surface lg:flex">
        <div className="flex h-12 shrink-0 items-center border-b border-border px-3">
          <h2 className="truncate text-md font-semibold text-text">{channelList.spaceName}</h2>
        </div>
        <ChannelList {...channelList} className="flex-1" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-12 shrink-0 items-center justify-between border-b border-border px-3 py-1 lg:h-12 lg:px-4 lg:py-0">
          <IconButton
            aria-label="Ouvrir la liste des salons"
            className="lg:hidden"
            onClick={() => setChannelDrawerOpen(true)}
          >
            <MenuIcon className="size-5" aria-hidden="true" />
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
          {activeChannelName && (
            <h2 className="hidden truncate text-md font-semibold text-text lg:block">
              #{activeChannelName}
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
                aria-label="Ouvrir le panneau"
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

      {rightPanel && <RightPanel title={rightPanel.title}>{rightPanel.content}</RightPanel>}

      <Sheet
        open={channelDrawerOpen}
        onOpenChange={setChannelDrawerOpen}
        side="left"
        title={channelList.spaceName}
      >
        <div className="flex h-full flex-col">
          <ChannelList
            {...channelList}
            className="min-h-0 flex-1"
            onSelect={(id) => {
              channelList.onSelect(id);
              setChannelDrawerOpen(false);
            }}
          />
          {/* Sur mobile, le rail est masqué : créer un espace se fait ici,
              avec un libellé, plutôt que par un "+" seul dans l'en-tête. */}
          {spaceRail.onCreateSpace && (
            <div className="border-t border-border px-2 py-3">
              <a
                href="/salons/nouveau"
                className="flex h-control-mobile w-full items-center gap-2 rounded-control px-2 text-sm font-medium text-link hover:bg-surface-2"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                {fr.spaces.createTitle}
              </a>
            </div>
          )}
        </div>
      </Sheet>

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

      <MobileTabBar activeTabId={activeMobileTabId} />
    </div>
  );
}
