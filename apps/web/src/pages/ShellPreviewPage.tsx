import { Flame, Hash, MessageSquare, Trophy, User } from "lucide-react";
import { useState } from "react";
import { AssistantMessage } from "../components/assistant/AssistantMessage.js";
import { AppShell } from "../components/shell/AppShell.js";
import type { ChannelItem, MobileTabItem, SpaceItem } from "../components/shell/types.js";
import { Avatar } from "../components/ui/Avatar.js";
import { KemetSymbol } from "../components/ui/KemetSymbol.js";
import { UserName } from "../components/ui/UserName.js";

const SAMPLE_SPACES: SpaceItem[] = [
  { id: "accueil", name: "Dev Sénégal" },
  { id: "decouvrir", name: "Carrière Freelance" },
  { id: "competitions", name: "CADEV 2026" },
  { id: "duels", name: "Entraide Backend" },
];

const SAMPLE_CHANNELS: ChannelItem[] = [
  { id: "general", name: "général" },
  { id: "backend", name: "backend", unreadCount: 3 },
  { id: "frontend", name: "frontend" },
  { id: "ia-assistant", name: "ia-et-assistant", unreadCount: 12 },
  { id: "cadev-2026", name: "cadev-2026" },
];

const SAMPLE_TABS: MobileTabItem[] = [
  { id: "fil", label: "Fil", icon: Flame },
  { id: "salons", label: "Salons", icon: MessageSquare },
  { id: "projets", label: "Projets", icon: Hash },
  { id: "competitions", label: "Compétitions", icon: Trophy },
  { id: "moi", label: "Moi", icon: User },
];

/**
 * Page isolée (chargée dans une iframe par /dev/ui) : la barre d'onglets
 * mobile et les feuilles de AppShell utilisent `position: fixed`, ancré au
 * bon endroit uniquement si la page occupe tout le viewport.
 */
export function ShellPreviewPage() {
  const [activeSpaceId, setActiveSpaceId] = useState("accueil");
  const [activeChannelId, setActiveChannelId] = useState("backend");
  const [activeTabId, setActiveTabId] = useState("salons");

  return (
    <AppShell
      spaceRail={{ spaces: SAMPLE_SPACES, activeSpaceId, onSelect: setActiveSpaceId }}
      channelList={{
        spaceName: "Accueil",
        channels: SAMPLE_CHANNELS,
        activeChannelId,
        onSelect: setActiveChannelId,
      }}
      mobileTabs={SAMPLE_TABS}
      activeMobileTabId={activeTabId}
      onSelectMobileTab={setActiveTabId}
      rightPanel={{
        title: "Détails du salon",
        content: (
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <h3 className="mb-1 font-medium text-text">Description</h3>
              <p className="text-text-2">
                Discussions sur l'architecture serveur : Fastify, Socket.IO, BullMQ.
              </p>
            </div>
            <div>
              <h3 className="mb-2 font-medium text-text">Membres actifs</h3>
              <div className="flex flex-col gap-2">
                <UserName name="Awa Ndiaye" level="architecte" />
                <UserName name="Koffi Mensah" level="scribe" />
                <UserName name="Chidi Okafor" level="artisan" />
              </div>
            </div>
          </div>
        ),
      }}
    >
      <div className="flex flex-col gap-5 px-4 py-4 lg:px-6">
        <div className="flex gap-3">
          <Avatar name="Awa Ndiaye" />
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <UserName name="Awa Ndiaye" level="architecte" />
              <span className="text-xs text-subtle">10:14</span>
            </div>
            <p className="mt-0.5 text-base text-text">
              Le job `integration-tests` passe enfin contre une vraie base Postgres, les quatre
              tables Better Auth sont bonnes.
            </p>
            <p className="mt-1 text-base text-text">
              Je pousse le correctif `globalPassThroughEnv` dans la foulée.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Avatar name="Koffi Mensah" />
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <UserName name="Koffi Mensah" level="scribe" />
              <span className="text-xs text-subtle">10:16</span>
            </div>
            <pre className="mt-1 overflow-x-auto rounded-control border border-border bg-surface p-3 font-mono text-sm text-text">
              {`globalPassThroughEnv: ["DATABASE_URL_TEST"]`}
            </pre>
          </div>
        </div>

        <div className="flex gap-3">
          <KemetSymbol className="size-8" />
          <div className="min-w-0 flex-1">
            <AssistantMessage
              content={
                <p>
                  Pour relancer les migrations proprement après un changement de schéma, exécute{" "}
                  <code className="font-mono text-xs">pnpm db:migrate</code> depuis la racine : il
                  applique les fichiers de{" "}
                  <code className="font-mono text-xs">packages/db/migrations</code> dans l'ordre,
                  sans jamais modifier une migration déjà fusionnée.
                </p>
              }
              skill={{
                skillName: "migrations-drizzle",
                skillHref: "#",
                authorName: "Awa Ndiaye",
                authorHref: "#",
              }}
              readSummary="A lu les 3 derniers messages de ce salon."
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
