import { cn } from "../../lib/cn.js";

export interface KemetSymbolProps {
  className?: string;
}

export function KemetSymbol({ className }: KemetSymbolProps) {
  return (
    <>
      <img src="/brand/kemet-symbol.svg" alt="" className={cn("kemet-symbol-light", className)} />
      <img
        src="/brand/kemet-symbol-dark.svg"
        alt=""
        className={cn("kemet-symbol-dark", className)}
      />
    </>
  );
}
