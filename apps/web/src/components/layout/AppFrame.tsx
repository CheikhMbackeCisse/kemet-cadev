import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { ActivityBar } from "../shell/ActivityBar.js";
import { MobileTabBar } from "../shell/MobileTabBar.js";
import { SidePanelColumn } from "../shell/SidePanelColumn.js";
import { SidePanelProvider } from "../shell/sidePanel.js";
import { useSession } from "../../session/SessionProvider.js";
import {
  messagesBadgeCount,
  useConversationUnread,
} from "../../lib/messaging/conversationUnread.js";

export interface AppFrameSidePanel {
  title: string;
  content: ReactNode;
  footer?: ReactNode;
}

export interface AppFrameProps {
  /** Section de la barre d'activité à marquer comme active (voir `RAIL_NAV`). */
  activeSection?: string;
  activeMobileTab: string;
  sidePanel?: AppFrameSidePanel;
  /**
   * Vrai pour un salon : le cadre fait la hauteur de l'écran et ne défile
   * pas, seule la liste des messages défile.
   */
  fixedHeight?: boolean;
  children: ReactNode;
}

/**
 * Cadre commun de toutes les pages : barre d'activité et panneau latéral
 * sur bureau, barre d'onglets sous lg.
 */
export function AppFrame({
  activeSection,
  activeMobileTab,
  sidePanel,
  fixedHeight,
  children,
}: AppFrameProps) {
  const { status } = useSession();
  const messagesBadge = messagesBadgeCount(useConversationUnread(status === "ready"));
  return (
    <SidePanelProvider enabled={Boolean(sidePanel)}>
      <div
        className={cn(
          "flex w-full bg-bg",
          fixedHeight ? "h-viewport overflow-hidden overscroll-none" : "min-h-viewport",
        )}
      >
        <ActivityBar
          activeSection={activeSection}
          hasSidePanel={Boolean(sidePanel)}
          unreadCounts={{ messages: messagesBadge }}
        />
        {sidePanel && (
          <SidePanelColumn title={sidePanel.title} footer={sidePanel.footer}>
            {sidePanel.content}
          </SidePanelColumn>
        )}
        {children}
      </div>
      <MobileTabBar activeTabId={activeMobileTab} privateUnread={messagesBadge} />
    </SidePanelProvider>
  );
}
