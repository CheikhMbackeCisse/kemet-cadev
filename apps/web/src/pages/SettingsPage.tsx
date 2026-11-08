import { ChevronRight, LogOut } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { RailPage } from "../components/layout/RailPage.js";
import {
  filterSettingsSections,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "../components/settings/settingsSections.js";
import { SuspendedBanner } from "../components/shell/SuspendedBanner.js";
import { Input } from "../components/ui/Input.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { useToast } from "../components/ui/Toast.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

const GROUPS: { id: SettingsSection["group"]; sections: SettingsSection[] }[] = [
  { id: "account", sections: SETTINGS_SECTIONS.filter((section) => section.group === "account") },
  { id: "app", sections: SETTINGS_SECTIONS.filter((section) => section.group === "app") },
];

/** Liste des réglages, groupée, avec une recherche ; chaque section a sa page. */
export function SettingsPage() {
  const { status, isSuspended, signOut } = useSession();
  const toast = useToast();
  const searchId = useId();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (status === "incomplete") window.location.href = "/completer-profil";
  }, [status]);

  if (status === "incomplete") return null;
  const signedIn = status === "ready";
  const groups = GROUPS.map((group) => ({
    ...group,
    sections: filterSettingsSections(
      group.sections.filter((section) => signedIn || !section.requiresAccount),
      query,
    ),
  })).filter((group) => group.sections.length > 0);

  return (
    <RailPage activeSection="parametres" className="gap-6 px-4 py-6 lg:py-8">
      <h1 className="text-lg font-bold text-text">{fr.settings.title}</h1>
      {isSuspended && <SuspendedBanner />}

      <div className="flex max-w-xl flex-col gap-1">
        <label htmlFor={searchId} className="sr-only">
          {fr.settings.searchLabel}
        </label>
        <Input
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder={fr.settings.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {status === "loading" ? (
        <div className="flex max-w-xl flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-base text-text-2">{fr.settings.searchNoResult(query.trim())}</p>
      ) : (
        groups.map((group) => (
          <ul key={group.id} className="flex max-w-xl flex-col divide-y divide-border border-y border-border">
            {group.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={section.href}
                  className="flex min-h-control-mobile items-center gap-3 px-2 py-3 lg:hover:bg-surface-2"
                >
                  <section.icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-medium text-text">{section.label}</span>
                    <span className="truncate text-xs text-subtle">{section.hint}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        ))
      )}

      {signedIn && !query && (
        <button
          type="button"
          onClick={() =>
            void signOut()
              .then(() => (window.location.href = "/fil"))
              .catch(() => toast.show(fr.auth.signOutError, "danger"))
          }
          className="flex min-h-control-mobile w-full max-w-xl items-center gap-3 border-y border-border px-2 py-3 text-base font-medium text-danger lg:hover:bg-surface-2"
        >
          <LogOut className="size-5" aria-hidden="true" />
          {fr.auth.signOut}
        </button>
      )}
    </RailPage>
  );
}
