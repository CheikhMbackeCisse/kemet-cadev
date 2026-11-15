import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { focusContent } from "./focusContent.js";
import { fr } from "../../i18n/fr.js";

export type SheetSide = "bottom" | "left" | "right";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: SheetSide;
  title: string;
  children: ReactNode;
  className?: string;
}

const SIDE_CLASSES: Record<SheetSide, string> = {
  bottom: "inset-x-0 bottom-0 max-h-[85vh] rounded-t-panel border-t",
  left: "inset-y-0 left-0 h-full w-[85vw] max-w-xs rounded-r-panel border-r",
  right: "inset-y-0 right-0 h-full w-[85vw] max-w-xs rounded-l-panel border-l",
};

export function Sheet({ open, onOpenChange, side, title, children, className }: SheetProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <RadixDialog.Content
          tabIndex={-1}
          onOpenAutoFocus={focusContent}
          className={cn(
            "outline-none fixed z-50 flex flex-col overflow-y-auto border-border bg-bg p-4 shadow-floating transition-transform duration-200",
            SIDE_CLASSES[side],
            className,
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <RadixDialog.Title className="text-md font-semibold text-text">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label={fr.common.close}
              className="inline-flex size-control-mobile shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2"
            >
              <X className="size-5" aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
