import { cn } from "../../lib/cn.js";

export interface KemetWordmarkProps {
  className?: string;
}

export function KemetWordmark({ className }: KemetWordmarkProps) {
  return (
    <>
      <img
        src="/brand/kemet-wordmark.svg"
        alt="Kemet"
        className={cn("kemet-wordmark-light", className)}
      />
      <img
        src="/brand/kemet-wordmark-dark.svg"
        alt="Kemet"
        className={cn("kemet-wordmark-dark", className)}
      />
    </>
  );
}
