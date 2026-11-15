import { currentLanguage, switchLanguage, type Language } from "../../i18n/language.js";
import { fr } from "../../i18n/fr.js";

const LANGUAGES: { value: Language; short: string }[] = [
  { value: "fr", short: "FR" },
  { value: "en", short: "EN" },
];

/**
 * Choix FR / EN. Le français reste la langue de tout le monde ; l'anglais
 * n'est pris que par ce choix, gardé dans le navigateur, et la page se
 * recharge pour que tous les textes changent d'un coup.
 */
export function LanguageSwitch({ tone = "default" }: { tone?: "default" | "onDark" }) {
  const active = currentLanguage();
  const base =
    "inline-flex min-h-9 min-w-11 items-center justify-center rounded-control px-3 text-sm font-medium max-md:min-h-11";
  const colors =
    tone === "onDark"
      ? {
          on: "bg-auth-text text-[var(--auth-bg-to)]",
          off: "text-auth-text-muted hover:text-auth-text",
        }
      : { on: "bg-action-strong text-on-action-strong", off: "text-text-2 hover:bg-surface-2" };
  return (
    <div role="group" aria-label={fr.common.language} className="inline-flex gap-1">
      {LANGUAGES.map((language) => (
        <button
          key={language.value}
          type="button"
          lang={language.value}
          aria-label={fr.common.languageNames[language.value]}
          aria-pressed={active === language.value}
          onClick={() => {
            if (language.value !== active) switchLanguage(language.value);
          }}
          className={`${base} ${active === language.value ? colors.on : colors.off}`}
        >
          {language.short}
        </button>
      ))}
    </div>
  );
}
