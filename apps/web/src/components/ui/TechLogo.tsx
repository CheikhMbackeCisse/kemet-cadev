import { TECH_LOGOS, type TechLogoName } from "./techLogos.js";
import { cn } from "../../lib/cn.js";

/** Logo d'une technologie dans sa couleur officielle, sur une pastille blanche lisible dans les deux thèmes. */
export function TechLogo({ name, className }: { name: TechLogoName; className?: string }) {
  const logo = TECH_LOGOS[name];
  return (
    <span
      className={cn("flex size-8 items-center justify-center rounded-control bg-white", className)}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill={logo.color === "#FFFFFF" ? "#000000" : logo.color} role="img" aria-label={logo.title}>
        <path d={logo.path} />
      </svg>
    </span>
  );
}
