import type { ReactNode } from "react";
import { KemetWordmark } from "../ui/KemetWordmark.js";
import { ThemeToggle } from "../../theme/ThemeToggle.js";

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex justify-center">
          <KemetWordmark className="h-7 w-auto" />
        </a>
        <div className="flex flex-col gap-4 rounded-card border border-border-strong p-6">
          <div>
            <h1 className="text-lg font-semibold text-text">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-subtle">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
