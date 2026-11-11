import { UserX } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Flag } from "./Flag.js";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 20 | 24 | 32 | 40 | 88;
  /** Drapeau du pays, affiché en badge sur la photo. Réservé aux tailles 32 et 40 : à 24 px, le badge ne laisse plus voir la photo ; à 88 px, le pays est écrit à côté. */
  countryCode?: string;
  /** Compte supprimé : icône neutre, sans initiales ni drapeau (ADR 0023). */
  deleted?: boolean;
  className?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

// Couleurs de Kemet déjà testées en contraste contre --bg dans les deux thèmes
// (tokens.test.ts) : les initiales prennent --bg, comme le motif des insignes.
const GENERATED_BACKGROUNDS = [
  "var(--level-architecte)",
  "var(--level-scribe)",
  "var(--level-apprenti)",
  "var(--level-artisan)",
  "var(--level-legende)",
];

/** Couleur stable pour un même nom, d'un écran à l'autre. */
export function generatedAvatarColor(name: string): string {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return GENERATED_BACKGROUNDS[hash % GENERATED_BACKGROUNDS.length]!;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  20: "size-5 text-[8px]",
  24: "size-6 text-[10px]",
  32: "size-8 text-xs",
  40: "size-10 text-sm",
  88: "size-[88px] text-xl",
};

const ICON_SIZES: Record<NonNullable<AvatarProps["size"]>, string> = {
  20: "size-3",
  24: "size-3.5",
  32: "size-4",
  40: "size-5",
  88: "size-10",
};

export function Avatar({
  name,
  src,
  size = 32,
  countryCode,
  deleted = false,
  className,
}: AvatarProps) {
  if (deleted) {
    return (
      <span
        role="img"
        aria-label={name}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-subtle",
          SIZE_CLASSES[size],
          className,
        )}
      >
        <UserX className={ICON_SIZES[size]} aria-hidden="true" />
      </span>
    );
  }
  const photo = src ? (
    <img
      src={src}
      alt=""
      className={cn("rounded-full object-cover", SIZE_CLASSES[size], className)}
    />
  ) : (
    // Décoratif comme la photo : le nom est toujours écrit à côté ou porté
    // par le lien qui l'entoure, sinon il était lu deux fois.
    <span
      aria-hidden="true"
      style={{ backgroundColor: generatedAvatarColor(name) }}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-bg",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );

  if (!countryCode || size === 20 || size === 24 || size === 88) return photo;

  return (
    <span className="relative inline-flex shrink-0">
      {photo}
      <Flag
        countryCode={countryCode}
        className="absolute -bottom-0.5 -right-1 ring-2 ring-surface"
      />
    </span>
  );
}
