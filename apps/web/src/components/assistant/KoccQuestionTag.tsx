import { X } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { asksKocc } from "../../lib/assistant/koccDraft.js";
import { mentionsAssistant } from "../../lib/chat/assistantNotice.js";
import { KoccSymbol } from "./KoccSymbol.js";

/** Étiquette au-dessus du champ tant que le brouillon commence par @kocc ; la croix retire la mention. */
export function KoccQuestionTag({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft pl-2 pr-0.5 text-xs font-medium text-link">
      <KoccSymbol className="size-4" />
      {fr.assistant.questionTag}
      <button
        type="button"
        onClick={onRemove}
        aria-label={fr.assistant.removeQuestionTag}
        title={fr.assistant.removeQuestionTag}
        className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface-2"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export const ASSISTANT_NOTICE_ID = "assistant-notice";

/**
 * Au-dessus du champ quand le brouillon appelle Kocc : l'étiquette "Question
 * à Kocc" si la mention est en tête, et sur la même ligne la seule phrase
 * sur la confidentialité, avec son lien.
 */
export function KoccComposerHint({
  draft,
  onRemoveMention,
  noticeId = ASSISTANT_NOTICE_ID,
}: {
  draft: string;
  onRemoveMention: () => void;
  noticeId?: string;
}) {
  if (!mentionsAssistant(draft)) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {asksKocc(draft) && <KoccQuestionTag onRemove={onRemoveMention} />}
      <p id={noticeId} className="truncate text-xs text-subtle">
        {fr.assistantNotice.text} ·{" "}
        <a href="/confidentialite" className="text-link hover:underline">
          {fr.assistantNotice.link}
        </a>
      </p>
    </div>
  );
}
