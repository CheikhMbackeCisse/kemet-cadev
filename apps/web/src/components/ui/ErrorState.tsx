import { TriangleAlert } from "lucide-react";
import { Button } from "./Button.js";
import { cn } from "../../lib/cn.js";

export interface ErrorStateProps {
  message: string;
  retry?: { label: string; onClick: () => void };
  className?: string;
}

export function ErrorState({ message, retry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <TriangleAlert className="size-8 text-danger" aria-hidden="true" />
      <p className="max-w-sm text-sm text-text-2">{message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry.onClick}>
          {retry.label}
        </Button>
      )}
    </div>
  );
}
