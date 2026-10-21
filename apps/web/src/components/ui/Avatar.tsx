import { cn } from "../../lib/cn.js";
import { Flag } from "./Flag.js";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 24 | 32 | 40;
  /** Drapeau du pays, affiché en badge sur la photo. Réservé aux tailles 32 et 40 : à 24 px, le badge ne laisse plus voir la photo. */
  countryCode?: string;
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

export function Avatar({ name, src, size = 32, countryCode, className }: AvatarProps) {
  const photo = src ? (
    <img src={src} alt="" className={cn("rounded-full object-cover", SIZE_CLASSES[size], className)} />
  ) : (
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

  if (!countryCode || size === 24) return photo;

  return (
    <span className="relative inline-flex shrink-0">
      {photo}
      <Flag countryCode={countryCode} className="absolute -bottom-0.5 -right-1 ring-2 ring-surface" />
    </span>
  );
}
