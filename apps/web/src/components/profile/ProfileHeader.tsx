import { type ReactNode } from "react";
import { COUNTRIES, type Profile } from "@kemet/shared";
import { Avatar } from "../ui/Avatar.js";
import { Flag } from "../ui/Flag.js";
import { LevelBadge } from "../ui/LevelBadge.js";
import { Skeleton } from "../ui/Skeleton.js";
import { cn } from "../../lib/cn.js";
import { formatCount } from "../../lib/formatCount.js";
import { fr } from "../../i18n/fr.js";

type HeaderProfile = Pick<
  Profile,
  "displayName" | "handle" | "avatarUrl" | "bannerUrl" | "country" | "bio" | "level"
>;

export interface ProfileStat {
  label: string;
  /** `null` pendant le chargement. */
  value: number | null;
  /** Ses propres points au point près : "2,6k" ne laisse pas suivre sa progression. */
  exact?: boolean;
  onClick?: () => void;
}

export interface ProfileHeaderProps {
  profile: HeaderProfile;
  stats: ProfileStat[];
  /** Sous les chiffres, sur toute la largeur (progression de niveau sur Moi). */
  belowStats?: ReactNode;
  /** Rôle et spécialité, sur le profil public. */
  subtitle?: string | null;
  /** Moi n'en montre que deux lignes : le profil public la donne en entier. */
  clampBio?: boolean;
  actions?: ReactNode;
}

const exactNumber = new Intl.NumberFormat("fr-FR");

const STAT_CLASS = "flex min-w-0 flex-col items-center gap-0.5 rounded-control px-1 py-1";

function StatValue({ stat }: { stat: ProfileStat }) {
  return (
    <>
      {stat.value === null ? (
        <Skeleton className="h-6 w-8" />
      ) : (
        <span className="font-display text-lg font-semibold tabular-nums text-text">
          {stat.exact ? exactNumber.format(stat.value) : formatCount(stat.value)}
        </span>
      )}{" "}
      <span className="max-w-full truncate text-xs text-text-2">{stat.label}</span>
    </>
  );
}

/**
 * En-tête commun à Moi et au profil public : bannière (ou bande de couleur),
 * photo de 88 px qui chevauche son bord, chiffres à côté, puis l'identité.
 * Seule la photo remonte sur la bannière : des chiffres alignés sur son bas
 * passaient en partie sur une bannière sombre.
 */
export function ProfileHeader({
  profile,
  stats,
  belowStats,
  subtitle,
  clampBio = false,
  actions,
}: ProfileHeaderProps) {
  const countryName = COUNTRIES.find((country) => country.code === profile.country)?.name;

  return (
    <header className="flex flex-col gap-3">
      <div>
        {profile.bannerUrl ? (
          // Décorative : le nom et l'avatar juste en dessous portent l'information.
          <img
            src={profile.bannerUrl}
            alt=""
            className="aspect-[4/1] max-h-40 w-full rounded-card bg-surface-2 object-cover"
          />
        ) : (
          <div aria-hidden="true" className="h-24 rounded-card bg-accent-soft" />
        )}
        <div className="flex items-start gap-3 pl-3">
          <span className="-mt-11 shrink-0 rounded-full bg-bg p-1">
            <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={88} />
          </span>
          <ul
            aria-label={fr.profile.statsLabel}
            className="flex min-w-0 flex-1 justify-between gap-1 pt-1 md:justify-start md:gap-8 md:pl-4"
          >
            {stats.map((stat) => (
              <li key={stat.label} className="flex min-w-0 justify-center">
                {stat.onClick ? (
                  <button
                    type="button"
                    onClick={stat.onClick}
                    className={cn(STAT_CLASS, "hover:bg-surface-2 max-md:min-h-control-mobile")}
                  >
                    <StatValue stat={stat} />
                  </button>
                ) : (
                  <div className={STAT_CLASS}>
                    <StatValue stat={stat} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {belowStats}

      <div className="flex flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="min-w-0 break-words text-xl font-bold text-text">{profile.displayName}</h1>
          <LevelBadge level={profile.level} showLabel link />
        </div>
        {subtitle && <p className="text-sm text-text-2">{subtitle}</p>}
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-subtle">
          <span>@{profile.handle}</span>
          {countryName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Flag countryCode={profile.country} decorative />
                {countryName}
              </span>
            </>
          )}
        </p>
      </div>

      {profile.bio && (
        <p
          className={cn(
            "whitespace-pre-wrap break-words text-base text-text",
            clampBio && "line-clamp-2",
          )}
        >
          {profile.bio}
        </p>
      )}

      {actions}
    </header>
  );
}
