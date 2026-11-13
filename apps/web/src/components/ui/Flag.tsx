import { COUNTRIES } from "@kemet/shared";
import { cn } from "../../lib/cn.js";

// Une image par pays, téléchargée seulement quand un drapeau s'affiche. La
// feuille de style de flag-icons insérait les 270 drapeaux dans le CSS
// principal (220 ko avant compression), lu avant le premier affichage.
const FLAG_URLS = import.meta.glob<string>("../../../node_modules/flag-icons/flags/4x3/*.svg", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});

const FLAG_DIRECTORY = "../../../node_modules/flag-icons/flags/4x3/";

function flagUrl(countryCode: string): string | undefined {
  return FLAG_URLS[`${FLAG_DIRECTORY}${countryCode.toLowerCase()}.svg`];
}

export interface FlagProps {
  countryCode: string;
  className?: string;
  /** Vrai quand le nom du pays est déjà écrit à côté : il ne serait pas lu deux fois. */
  decorative?: boolean;
}

export function Flag({ countryCode, className, decorative = false }: FlagProps) {
  const name = COUNTRIES.find((country) => country.code === countryCode)?.name ?? countryCode;
  const src = flagUrl(countryCode);
  // text-[0px] : sans réseau, le texte de remplacement ne déborde pas de la case.
  const classes = cn(
    "inline-block h-3 w-4 shrink-0 overflow-hidden rounded-[1px] object-cover text-[0px]",
    className,
  );

  if (!src) {
    return decorative ? (
      <span aria-hidden="true" className={cn(classes, "bg-surface-2")} />
    ) : (
      <span role="img" aria-label={name} title={name} className={cn(classes, "bg-surface-2")} />
    );
  }
  return (
    <img
      src={src}
      alt={decorative ? "" : name}
      title={decorative ? undefined : name}
      width={16}
      height={12}
      loading="lazy"
      decoding="async"
      className={classes}
    />
  );
}
