import * as RadixToast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";

export type ToastTone = "neutral" | "success" | "danger";

export interface ToastAction {
  label: string;
  /** Ce que fait l'action, pour un lecteur d'écran (Radix l'annonce avec le raccourci F8). */
  altText: string;
  onSelect: () => void;
}

interface ToastItem {
  id: number;
  title: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastContextValue {
  show: (title: string, tone?: ToastTone, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const TONE_CLASSES: Record<ToastTone, string> = {
  neutral: "border-border bg-surface text-text",
  success: "border-success-soft bg-success-soft text-success",
  danger: "border-danger-soft bg-danger-soft text-danger",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((title: string, tone: ToastTone = "neutral", action?: ToastAction) => {
    const id = nextId++;
    setItems((current) => [...current, { id, title, tone, action }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            // Une action doit rester atteignable au clavier (F8, puis Tab) :
            // 4 s ne suffisent pas.
            duration={item.action ? 10000 : 4000}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
            className={cn(
              "flex items-center gap-3 rounded-panel border px-4 py-3 text-sm shadow-floating transition-opacity duration-200",
              TONE_CLASSES[item.tone],
            )}
          >
            <RadixToast.Title className="flex-1">{item.title}</RadixToast.Title>
            {item.action && (
              <RadixToast.Action
                altText={item.action.altText}
                onClick={item.action.onSelect}
                className="inline-flex h-control items-center rounded-control px-2 font-medium text-link hover:underline max-md:h-control-mobile"
              >
                {item.action.label}
              </RadixToast.Action>
            )}
            <RadixToast.Close
              aria-label={fr.common.closeNotification}
              className="inline-flex size-control items-center justify-center rounded-control text-muted hover:text-text max-md:size-control-mobile"
            >
              <X className="size-4" aria-hidden="true" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-[calc(44px+1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 flex max-w-sm flex-col sm:left-auto sm:w-full gap-2 outline-none lg:bottom-4" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast doit être utilisé dans ToastProvider");
  return context;
}
