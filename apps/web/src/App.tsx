import { INTRO_BASE_PATH } from "./lib/intro/introSteps.js";
import { hasSeenIntro } from "./lib/intro/introStorage.js";
import {
  lazy,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { Router } from "./components/navigation/Router.js";
import { UpdateBanner } from "./components/shell/UpdateBanner.js";
import { navigate } from "./lib/navigation/navigate.js";
import { PAGE_LOADERS, pageFor, type PageKey } from "./lib/navigation/pages.js";
import { Skeleton } from "./components/ui/Skeleton.js";
import { checkService, SERVICE_CHECKS, type ServiceStatus } from "./serviceStatus.js";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "./session/SessionProvider.js";
import { createQueryClient } from "./lib/query/queryClient.js";
import { landingPath, onboardingPath } from "./lib/onboarding/steps.js";
import { ThemeProvider } from "./theme/theme-context.js";
import { ToastProvider } from "./components/ui/Toast.js";
import { TooltipProvider } from "./components/ui/Tooltip.js";

// Hors développement, ces deux pages ne sont même pas construites.
const DevUiPage = import.meta.env.DEV
  ? lazy(() => import("./pages/DevUiPage.js").then((m) => ({ default: m.DevUiPage })))
  : null;
const ShellPreviewPage = import.meta.env.DEV
  ? lazy(() => import("./pages/ShellPreviewPage.js").then((m) => ({ default: m.ShellPreviewPage })))
  : null;

const PAGES = Object.fromEntries(
  (Object.keys(PAGE_LOADERS) as PageKey[]).map((key) => [
    key,
    // Un échec (fichiers d'une version remplacée) tombe dans PageErrorBoundary,
    // qui propose de recharger : jamais de rechargement sans clic.
    lazy(PAGE_LOADERS[key]),
  ]),
) as Record<PageKey, LazyExoticComponent<ComponentType>>;

const FeedPage = PAGES.feed;

const queryClient = createQueryClient();

const STATUS_LABELS: Record<ServiceStatus, string> = {
  verification: "vérification…",
  ok: "en ligne",
  indisponible: "indisponible",
};

function StatusPage() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>(() =>
    Object.fromEntries(SERVICE_CHECKS.map((service) => [service.name, "verification"])),
  );

  useEffect(() => {
    for (const service of SERVICE_CHECKS) {
      checkService(service.path).then((status) => {
        setStatuses((current) => ({ ...current, [service.name]: status }));
      });
    }
  }, []);

  return (
    <main className="flex h-viewport flex-col items-center justify-center gap-6">
      <p className="text-lg">Kemet arrive.</p>
      <ul className="flex flex-col gap-2 text-sm" aria-live="polite">
        {SERVICE_CHECKS.map((service) => (
          <li key={service.name} className="flex items-center gap-2">
            <span className="w-20 font-medium">{service.name}</span>
            <span>{STATUS_LABELS[statuses[service.name] ?? "verification"]}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-muted">
          <span className="w-20 font-medium">worker</span>
          <span>vérifié par Docker uniquement</span>
        </li>
      </ul>
    </main>
  );
}

/** Le temps que la page arrive : la forme commune des écrans plutôt qu'une page blanche. */
function PageFallback() {
  return (
    <div className="flex min-h-viewport w-full bg-bg" aria-busy="true">
      <div className="hidden w-activity-bar shrink-0 border-r border-border-strong bg-surface lg:block" />
      <div className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 pt-3 lg:pt-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return <PageFallback />;
}

/**
 * Ancienne adresse de l'écran Rôle : un compte qui a fini l'onboarding va
 * directement au fil, sans passer par l'écran qui le renverrait au fil.
 */
function RoleRedirect() {
  const { status, onboarding } = useSession();
  if (status === "loading") return <PageFallback />;
  const finished = status === "ready" && onboarding?.completed === true;
  return <Redirect to={finished ? "/fil" : onboardingPath("role")} />;
}

/**
 * L'adresse racine, où arrivent aussi les connexions GitHub, Google et
 * LinkedIn : un compte qui n'a pas fini l'onboarding le reprend, les autres
 * voient le fil.
 */
function RootPage() {
  const { status, onboarding } = useSession();
  const introSeen = hasSeenIntro();
  // Le fil s'affiche sans attendre la session pour qui a déjà vu l'accueil :
  // un visiteur, le cas le plus courant ici, n'a pas à patienter pour une
  // redirection qui ne le concerne pas.
  if (status === "visitor") return introSeen ? <FeedPage /> : <Redirect to={INTRO_BASE_PATH} />;
  if (status === "loading") return introSeen ? <FeedPage /> : <PageFallback />;
  const destination = landingPath(status, onboarding);
  if (destination === "/fil") return <FeedPage />;
  return <Redirect to={destination} />;
}

function renderPage(pathname: string): ReactNode {
  const key = pageFor(pathname);
  switch (key) {
    case "root":
      return <RootPage />;
    case "roleRedirect":
      return <RoleRedirect />;
    case "status":
      return <StatusPage />;
    case "devShell":
      return ShellPreviewPage ? <ShellPreviewPage /> : null;
    case "devUi":
      return DevUiPage ? <DevUiPage /> : null;
    default: {
      const Page = PAGES[key];
      return <Page />;
    }
  }
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <Router fallback={<PageFallback />} render={renderPage} />
              <UpdateBanner />
            </SessionProvider>
          </QueryClientProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
