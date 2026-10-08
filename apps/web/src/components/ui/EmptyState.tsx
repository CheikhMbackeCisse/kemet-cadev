import type { ComponentType, ReactNode } from "react";
import { Button } from "./Button.js";
import { cn } from "../../lib/cn.js";

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  message: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, message, action, className, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && <Icon className="size-8 text-subtle" />}
      <p className="max-w-sm text-sm text-text-2">{message}</p>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
