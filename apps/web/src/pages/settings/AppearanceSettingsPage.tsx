import { SettingsSubPage } from "../../components/settings/SettingsSubPage.js";
import { LanguageSwitch } from "../../components/ui/LanguageSwitch.js";
import { Select } from "../../components/ui/Select.js";
import { useTheme, type ThemeChoice } from "../../theme/theme-context.js";
import { fr } from "../../i18n/fr.js";

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: fr.settings.themeSystem },
  { value: "light", label: fr.settings.themeLight },
  { value: "dark", label: fr.settings.themeDark },
];

/** Ouverte aussi aux visiteurs : le thème est gardé dans le navigateur. */
export function AppearanceSettingsPage() {
  const { choice, setChoice } = useTheme();
  return (
    <SettingsSubPage title={fr.settings.appearanceSection}>
      <label className="flex max-w-sm flex-col gap-1 text-base text-text-2">
        {fr.settings.themeLabel}
        <Select
          aria-label={fr.settings.themeLabel}
          value={choice}
          onValueChange={(value) => setChoice(value as ThemeChoice)}
          options={THEME_OPTIONS}
        />
      </label>
      <div className="mt-5 flex flex-col gap-1 text-base text-text-2">
        {fr.settings.languageLabel}
        <LanguageSwitch />
      </div>
    </SettingsSubPage>
  );
}
