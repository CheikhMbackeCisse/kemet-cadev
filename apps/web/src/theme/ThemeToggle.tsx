import { Monitor, Moon, Sun } from "lucide-react";
import { IconButton } from "../components/ui/IconButton.js";
import { Menu } from "../components/ui/Menu.js";
import { useTheme, type ThemeChoice } from "./theme-context.js";

const CHOICE_ICONS: Record<ThemeChoice, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const CHOICE_LABELS: Record<ThemeChoice, string> = {
  system: "Système",
  light: "Clair",
  dark: "Sombre",
};

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  const Icon = CHOICE_ICONS[choice];

  return (
    <Menu
      trigger={
        <IconButton aria-label={`Thème : ${CHOICE_LABELS[choice]}`}>
          <Icon className="size-4" aria-hidden="true" />
        </IconButton>
      }
      items={(["system", "light", "dark"] as const).map((value) => ({
        value,
        label: CHOICE_LABELS[value],
      }))}
      selectedValue={choice}
      onSelect={(value) => setChoice(value as ThemeChoice)}
    />
  );
}
