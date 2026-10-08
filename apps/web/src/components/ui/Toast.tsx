import * as RadixToast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export type ToastTone = "neutral" | "success" | "danger";

interface ToastItem {
  id: number;
  title: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (title: string, tone?: ToastTone) => void;
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

  const show = useCallback((title: string, tone: ToastTone = "neutral") => {
    const id = nextId++;
    setItems((current) => [...current, { id, title, tone }]);
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
            duration={4000}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
            className={cn(
              "flex items-center gap-3 rounded-panel border px-4 py-3 text-sm shadow-floating transition-opacity duration-200",
              TONE_CLASSES[item.tone],
            )}
          >
            <RadixToast.Title className="flex-1">{item.title}</RadixToast.Title>
            <RadixToast.Close aria-label="Fermer la notification" className="text-muted hover:text-text">
              <X className="size-4" aria-hidden="true" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-[calc(44px+1rem+env(safe-area-inset-bottom))] right-4 z-50 flex w-full max-w-sm flex-col gap-2 outline-none lg:bottom-4" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast doit être utilisé dans ToastProvider");
  return context;
}
