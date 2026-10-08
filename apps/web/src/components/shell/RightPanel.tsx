import { PanelRightClose } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "../ui/IconButton.js";

export interface RightPanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function RightPanel({ title, onClose, children }: RightPanelProps) {
  return (
    <aside
      aria-label={title}
      className="hidden w-panel shrink-0 flex-col border-l border-border bg-surface lg:flex"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <IconButton aria-label="Fermer le panneau" onClick={onClose}>
          <PanelRightClose className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}
