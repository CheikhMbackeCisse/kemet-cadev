import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { COUNTRIES, type Profile } from "@kemet/shared";
import { Avatar } from "../ui/Avatar.js";
import { Flag } from "../ui/Flag.js";
import { OrganizationLabel } from "../ui/OrganizationLabel.js";
import { cn } from "../../lib/cn.js";
import { formatCount } from "../../lib/formatCount.js";
import { fr } from "../../i18n/fr.js";

export interface OrganizationStat {
  label: string;
  value: number;
  onClick?: () => void;
}

export interface OrganizationHeaderProps {
  profile: Profile;
  stats: OrganizationStat[];
  actions?: ReactNode;
}

const STAT_CLASS = "flex min-w-0 flex-col items-start gap-0.5 rounded-control px-1 py-1";

/** Le site sans "https://" ni barre finale : "systalink.com" plutôt que l'adresse entière. */
function websiteLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return (parsed.host + parsed.pathname).replace(/^www\./, "").replace(/\/$/, "");
  } catch {
    return url;
  }
}

/**
 * En-tête d'une organisation : logo carré, nom et étiquette, type, pays et
 * site, description. Ni niveau, ni points, ni barre de progression.
 */
export function OrganizationHeader({ profile, stats, actions }: OrganizationHeaderProps) {
  const countryName = COUNTRIES.find((country) => country.code === profile.country)?.name;
  const typeLabel = profile.organizationType
    ? fr.organizations.types[profile.organizationType]
    : null;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <Avatar
          name={profile.displayName}
          src={profile.avatarUrl ?? undefined}
          size={88}
          square
          className="border border-border"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="min-w-0 break-words text-xl font-bold text-text">
              {profile.displayName}
            </h1>
            <OrganizationLabel />
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-text-2">
            {typeLabel && <span>{typeLabel}</span>}
            {countryName && (
              <>
                {typeLabel && <span aria-hidden="true">·</span>}
                <span className="inline-flex items-center gap-1.5">
                  <Flag countryCode={profile.country} decorative />
                  {countryName}
                </span>
              </>
            )}
          </p>
          {profile.websiteUrl && (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex w-fit items-center gap-1 text-sm text-link hover:underline"
            >
              <span className="sr-only">{fr.organizations.website} : </span>
              {websiteLabel(profile.websiteUrl)}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {profile.bio && (
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-base text-text">
          {profile.bio}
        </p>
      )}

      <ul aria-label={fr.profile.statsLabel} className="flex gap-6">
        {stats.map((stat) => {
          const content = (
            <>
              <span className="font-display text-lg font-semibold tabular-nums text-text">
                {formatCount(stat.value)}
              </span>
              <span className="text-xs text-text-2">{stat.label}</span>
            </>
          );
          return (
            <li key={stat.label}>
              {stat.onClick ? (
                <button
                  type="button"
                  onClick={stat.onClick}
                  className={cn(STAT_CLASS, "hover:bg-surface-2 max-md:min-h-control-mobile")}
                >
                  {content}
                </button>
              ) : (
                <div className={STAT_CLASS}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {actions}
    </header>
  );
}
