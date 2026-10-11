import { useEffect, useState } from "react";
import { DevUiPage } from "./pages/DevUiPage.js";
import { ShellPreviewPage } from "./pages/ShellPreviewPage.js";
import { SpacePage } from "./pages/SpacePage.js";
import { InvitePage } from "./pages/InvitePage.js";
import { SkillsPage } from "./pages/SkillsPage.js";
import { SkillPage } from "./pages/SkillPage.js";
import { FeedPage } from "./pages/FeedPage.js";
import { PostPage } from "./pages/PostPage.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";
import { ProjectPage } from "./pages/ProjectPage.js";
import { CompetitionsPage } from "./pages/CompetitionsPage.js";
import { CompetitionPage } from "./pages/CompetitionPage.js";
import { HomePage } from "./pages/HomePage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.js";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.js";
import { CompleteProfilePage } from "./pages/CompleteProfilePage.js";
import { checkService, SERVICE_CHECKS, type ServiceStatus } from "./serviceStatus.js";
import { SessionProvider } from "./session/SessionProvider.js";
import { ThemeProvider } from "./theme/theme-context.js";
import { ToastProvider } from "./components/ui/Toast.js";
import { TooltipProvider } from "./components/ui/Tooltip.js";

const STATUS_LABELS: Record<ServiceStatus, string> = {
  verification: "vérification…",
  ok: "en ligne",
  indisponible: "indisponible",
};

function StatusPage() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>(
    () => Object.fromEntries(SERVICE_CHECKS.map((service) => [service.name, "verification"])),
  );

  useEffect(() => {
    for (const service of SERVICE_CHECKS) {
      checkService(service.path).then((status) => {
        setStatuses((current) => ({ ...current, [service.name]: status }));
      });
    }
  }, []);

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6">
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

function resolvePage(pathname: string) {
  if (pathname === "/") return <HomePage />;
  if (pathname === "/connexion") return <LoginPage />;
  if (pathname === "/inscription") return <SignupPage />;
  if (pathname === "/mot-de-passe-oublie") return <ForgotPasswordPage />;
  if (pathname === "/reinitialiser-mot-de-passe") return <ResetPasswordPage />;
  if (pathname === "/completer-profil") return <CompleteProfilePage />;
  if (pathname === "/statut") return <StatusPage />;
  if (pathname.startsWith("/salons/invite/")) return <InvitePage />;
  if (pathname.startsWith("/salons")) return <SpacePage />;
  if (pathname === "/skills" || pathname === "/skills/") return <SkillsPage />;
  if (pathname.startsWith("/skills/")) return <SkillPage />;
  if (pathname === "/fil" || pathname === "/fil/") return <FeedPage />;
  if (pathname.startsWith("/fil/")) return <PostPage />;
  if (pathname === "/projets" || pathname === "/projets/") return <ProjectsPage />;
  if (pathname.startsWith("/projets/")) return <ProjectPage />;
  if (pathname === "/competitions" || pathname === "/competitions/") return <CompetitionsPage />;
  if (pathname.startsWith("/competitions/")) return <CompetitionPage />;
  if (import.meta.env.DEV) {
    if (pathname.startsWith("/dev/ui/shell")) return <ShellPreviewPage />;
    if (pathname.startsWith("/dev/ui")) return <DevUiPage />;
  }
  return <StatusPage />;
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider>
          <SessionProvider>{resolvePage(window.location.pathname)}</SessionProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
