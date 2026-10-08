import { COUNTRIES } from "@kemet/shared";
import { cn } from "../../lib/cn.js";

export interface FlagProps {
  countryCode: string;
  className?: string;
}

export function Flag({ countryCode, className }: FlagProps) {
  const name = COUNTRIES.find((country) => country.code === countryCode)?.name ?? countryCode;

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(`fi fi-${countryCode.toLowerCase()}`, "inline-block h-3 w-4 shrink-0 rounded-[1px]", className)}
    />
  );
}
