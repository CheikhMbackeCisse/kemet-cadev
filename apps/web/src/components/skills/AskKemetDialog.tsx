import { navigate } from "../../lib/navigation/navigate.js";
import { Hash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Channel, Space } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { listChannels, listSpaces } from "../../lib/chat/api.js";
import { storeChannelDraft } from "../../lib/chat/useChannelDraft.js";
import { Dialog } from "../ui/Dialog.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { SpaceIcon, spaceTints } from "../ui/SpaceIcon.js";

interface SpaceWithChannels {
  space: Space;
  channels: Channel[];
}

async function listAllSpaces(): Promise<Space[]> {
  const spaces: Space[] = [];
  let cursor: string | undefined;
  do {
    const page = await listSpaces(cursor);
    spaces.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return spaces;
}

// Seuls les espaces dont on est membre : ailleurs, le message ne partirait pas.
async function loadWritableChannels(): Promise<SpaceWithChannels[]> {
  const memberSpaces = (await listAllSpaces()).filter((space) => space.role !== null);
  const groups = await Promise.all(
    memberSpaces.map(async (space) => ({ space, channels: (await listChannels(space.id)).items })),
  );
  return groups.filter((group) => group.channels.length > 0);
}

export interface AskKemetDialogProps {
  skillSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Choix du salon où poser sa question à @kemet, le skill déjà demandé dans le composeur. */
export function AskKemetDialog({ skillSlug, open, onOpenChange }: AskKemetDialogProps) {
  const [groups, setGroups] = useState<SpaceWithChannels[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setGroups(null);
    setError(false);
    loadWritableChannels()
      .then(setGroups)
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function openChannel(space: Space, channel: Channel) {
    storeChannelDraft(channel.id, fr.skills.askKemetDraft(skillSlug));
    navigate(`/salons?space=${space.id}&channel=${channel.id}`);
  }

  const tints = spaceTints(groups?.map(({ space }) => space) ?? []);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={fr.skills.askKemetTitle}
      description={fr.skills.askKemetDescription}
    >
      {error ? (
        <ErrorState
          message={fr.skills.askKemetLoadingError}
          retry={{ label: fr.chat.retry, onClick: load }}
        />
      ) : groups === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">{fr.skills.askKemetLoading}</span>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-text-2">
          {fr.skills.askKemetNoSpace}{" "}
          <a href="/salons" className="text-link hover:underline">
            {fr.skills.askKemetBrowseSpaces}
          </a>
        </p>
      ) : (
        <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
          {groups.map(({ space, channels }) => (
            <section key={space.id} aria-labelledby={`ask-kemet-space-${space.id}`}>
              <h3
                id={`ask-kemet-space-${space.id}`}
                className="flex items-center gap-2 text-sm font-semibold text-text"
              >
                <SpaceIcon
                  id={space.id}
                  name={space.name}
                  tint={tints.get(space.id)}
                  className="size-6 rounded-[6px]"
                  glyphClassName="size-3.5"
                />
                {space.name}
              </h3>
              <ul className="mt-1 flex flex-col">
                {channels.map((channel) => (
                  <li key={channel.id}>
                    <button
                      type="button"
                      onClick={() => openChannel(space, channel)}
                      className="flex h-control w-full items-center gap-2 rounded-control px-2 text-left text-sm text-text-2 hover:bg-surface-2 hover:text-text max-md:h-control-mobile"
                    >
                      <Hash className="size-4 shrink-0" aria-hidden="true" />
                      {channel.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}
