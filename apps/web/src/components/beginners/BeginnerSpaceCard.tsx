import { Sprout, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BEGINNERS_SPACE_ID } from "@kemet/shared";
import { getSpace, joinSpace } from "../../lib/chat/api.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { IconButton } from "../ui/IconButton.js";
import { useToast } from "../ui/Toast.js";
import { fr } from "../../i18n/fr.js";

const SPACE_PATH = `/salons?space=${BEGINNERS_SPACE_ID}`;

export interface BeginnerSpaceCardProps {
  /** Rejoindre demande un compte : un visiteur ouvre seulement l'espace, lisible sans compte. */
  canJoin: boolean;
  onDismiss?: () => void;
}

/** Proposition de l'espace "Débuter en informatique", dans le fil. */
export function BeginnerSpaceCard({ canJoin, onDismiss }: BeginnerSpaceCardProps) {
  const toast = useToast();
  const [joining, setJoining] = useState(false);
  // Un membre de l'espace se voit proposer de l'ouvrir, pas de le rejoindre.
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (!canJoin) return;
    getSpace(BEGINNERS_SPACE_ID)
      .then((result) => setIsMember(result.space.role !== null))
      .catch(() => setIsMember(false));
  }, [canJoin]);

  async function handleJoin() {
    setJoining(true);
    try {
      await joinSpace(BEGINNERS_SPACE_ID);
      navigate(SPACE_PATH);
    } catch {
      toast.show(fr.beginners.spaceJoinError, "danger");
      setJoining(false);
    }
  }

  return (
    <Card variant="plain" className="flex items-start gap-3">
      <Sprout className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h2 className="text-md font-semibold text-text">{fr.beginners.spaceTitle}</h2>
          <p className="text-sm text-text-2">{fr.beginners.spacePitch}</p>
        </div>
        <div>
          {canJoin && !isMember ? (
            <Button onClick={() => void handleJoin()} loading={joining}>
              {fr.beginners.spaceJoin}
            </Button>
          ) : (
            <a
              href={SPACE_PATH}
              className="inline-flex h-control items-center justify-center rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2 max-md:h-control-mobile"
            >
              {fr.beginners.spaceOpen}
            </a>
          )}
        </div>
      </div>
      {onDismiss && (
        <IconButton
          aria-label={fr.beginners.spaceDismiss}
          onClick={onDismiss}
          className="-mr-2 -mt-2 shrink-0"
        >
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      )}
    </Card>
  );
}
