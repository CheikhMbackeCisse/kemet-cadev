import { BarChart3, Layers, type LucideIcon, ShieldCheck, Smartphone, Sparkles, Users, Zap } from "lucide-react";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { ThemeToggle } from "../theme/ThemeToggle.js";
import { fr } from "../i18n/fr.js";

interface Benefit {
  icon: LucideIcon;
  title: string;
  body: string;
}

const BENEFITS: Benefit[] = [
  { icon: Zap, title: fr.pro.benefitAiQuotaTitle, body: fr.pro.benefitAiQuotaBody },
  { icon: BarChart3, title: fr.pro.benefitStatsTitle, body: fr.pro.benefitStatsBody },
  { icon: Users, title: fr.pro.benefitDirectoryTitle, body: fr.pro.benefitDirectoryBody },
  { icon: Layers, title: fr.pro.benefitSpacesTitle, body: fr.pro.benefitSpacesBody },
];

export function ProPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div className="flex items-center gap-3">
          <Sparkles className="size-6 text-primary" aria-hidden="true" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-text">{fr.pro.title}</h1>
              <Badge>{fr.pro.previewBadge}</Badge>
            </div>
            <p className="text-sm text-subtle">{fr.pro.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="/salons"
            className="inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2"
          >
            {fr.pro.salonsLink}
          </a>
        </div>
      </div>

      <p className="rounded-card border border-border bg-surface-2 p-4 text-sm text-text-2">{fr.pro.previewNotice}</p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((benefit) => (
          <li key={benefit.title} className="flex flex-col gap-2 rounded-card border border-border p-4">
            <benefit.icon className="size-5 text-text-2" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-text">{benefit.title}</h2>
            <p className="text-sm text-text-2">{benefit.body}</p>
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-2 rounded-card border border-border p-4 text-sm text-text-2">
        <ShieldCheck className="size-5 shrink-0 text-text-2" aria-hidden="true" />
        <p>{fr.pro.verificationNote}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-4">
        <div className="flex items-center gap-2">
          <Smartphone className="size-5 text-text-2" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-text">{fr.pro.paymentTitle}</h2>
            <p className="text-sm text-text-2">{fr.pro.paymentBody}</p>
          </div>
        </div>
        <Button disabled>{fr.pro.comingSoon}</Button>
      </div>
    </main>
  );
}
