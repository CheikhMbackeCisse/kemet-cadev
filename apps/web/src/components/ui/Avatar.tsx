import { cn } from "../../lib/cn.js";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 24 | 32 | 40;
  className?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  24: "size-6 text-[10px]",
  32: "size-8 text-xs",
  40: "size-10 text-sm",
};

export function Avatar({ name, src, size = 32, className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("rounded-full object-cover", SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-accent-soft font-semibold text-primary",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
