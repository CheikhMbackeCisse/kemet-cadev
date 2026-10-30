import { lazy, Suspense, useEffect, useState } from "react";
import { Skeleton } from "./components/ui/Skeleton.js";
import { checkService, SERVICE_CHECKS, type ServiceStatus } from "./serviceStatus.js";
import { SessionProvider } from "./session/SessionProvider.js";
import { ThemeProvider } from "./theme/theme-context.js";
import { ToastProvider } from "./components/ui/Toast.js";
import { TooltipProvider } from "./components/ui/Tooltip.js";

// Chaque page est chargée à la demande : un seul fichier pour tous les écrans
// pesait 610 ko avant le premier affichage.
const DevUiPage = lazy(() =>
  import("./pages/DevUiPage.js").then((m) => ({ default: m.DevUiPage })),
);
const ShellPreviewPage = lazy(() =>
  import("./pages/ShellPreviewPage.js").then((m) => ({ default: m.ShellPreviewPage })),
);
const NewSpacePage = lazy(() =>
  import("./pages/NewSpacePage.js").then((m) => ({ default: m.NewSpacePage })),
);
const SpacePage = lazy(() =>
  import("./pages/SpacePage.js").then((m) => ({ default: m.SpacePage })),
);
const InvitePage = lazy(() =>
  import("./pages/InvitePage.js").then((m) => ({ default: m.InvitePage })),
);
const NewSkillPage = lazy(() =>
  import("./pages/NewSkillPage.js").then((m) => ({ default: m.NewSkillPage })),
);
const SkillsPage = lazy(() =>
  import("./pages/SkillsPage.js").then((m) => ({ default: m.SkillsPage })),
);
const SkillPage = lazy(() =>
  import("./pages/SkillPage.js").then((m) => ({ default: m.SkillPage })),
);
const NewPostPage = lazy(() =>
  import("./pages/NewPostPage.js").then((m) => ({ default: m.NewPostPage })),
);
const FeedPage = lazy(() => import("./pages/FeedPage.js").then((m) => ({ default: m.FeedPage })));
const PostPage = lazy(() => import("./pages/PostPage.js").then((m) => ({ default: m.PostPage })));
const NewProjectPage = lazy(() =>
  import("./pages/NewProjectPage.js").then((m) => ({ default: m.NewProjectPage })),
);
const ProjectsPage = lazy(() =>
  import("./pages/ProjectsPage.js").then((m) => ({ default: m.ProjectsPage })),
);
const NewHelpRequestPage = lazy(() =>
  import("./pages/NewHelpRequestPage.js").then((m) => ({ default: m.NewHelpRequestPage })),
);
const ProjectPage = lazy(() =>
  import("./pages/ProjectPage.js").then((m) => ({ default: m.ProjectPage })),
);
const NewCompetitionPage = lazy(() =>
  import("./pages/NewCompetitionPage.js").then((m) => ({ default: m.NewCompetitionPage })),
);
const CompetitionsPage = lazy(() =>
  import("./pages/CompetitionsPage.js").then((m) => ({ default: m.CompetitionsPage })),
);
const SubmitProjectPage = lazy(() =>
  import("./pages/SubmitProjectPage.js").then((m) => ({ default: m.SubmitProjectPage })),
);
const CompetitionPage = lazy(() =>
  import("./pages/CompetitionPage.js").then((m) => ({ default: m.CompetitionPage })),
);
const ProPage = lazy(() => import("./pages/ProPage.js").then((m) => ({ default: m.ProPage })));
const ModerationPage = lazy(() =>
  import("./pages/ModerationPage.js").then((m) => ({ default: m.ModerationPage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage.js").then((m) => ({ default: m.LoginPage })),
);
const SignupPage = lazy(() =>
  import("./pages/SignupPage.js").then((m) => ({ default: m.SignupPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/ForgotPasswordPage.js").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("./pages/ResetPasswordPage.js").then((m) => ({ default: m.ResetPasswordPage })),
);
const CompleteProfilePage = lazy(() =>
  import("./pages/CompleteProfilePage.js").then((m) => ({ default: m.CompleteProfilePage })),
);
const RolePage = lazy(() => import("./pages/RolePage.js").then((m) => ({ default: m.RolePage })));
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage.js").then((m) => ({ default: m.SettingsPage })),
);
const UserPage = lazy(() => import("./pages/UserPage.js").then((m) => ({ default: m.UserPage })));

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

/** Le temps que la page arrive : la forme commune des écrans plutôt qu'une page blanche. */
function PageFallback() {
  return (
    <div className="flex min-h-screen w-full bg-bg" aria-busy="true">
      <div className="hidden w-rail shrink-0 border-r border-border-strong bg-surface lg:block" />
      <div className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

function resolvePage(pathname: string) {
  if (pathname === "/connexion") return <LoginPage />;
  if (pathname === "/inscription") return <SignupPage />;
  if (pathname === "/mot-de-passe-oublie") return <ForgotPasswordPage />;
  if (pathname === "/reinitialiser-mot-de-passe") return <ResetPasswordPage />;
  if (pathname === "/completer-profil") return <CompleteProfilePage />;
  if (pathname === "/ton-role") return <RolePage />;
  if (pathname === "/parametres") return <SettingsPage />;
  if (pathname === "/statut") return <StatusPage />;
  if (pathname.startsWith("/salons/invite/")) return <InvitePage />;
  if (pathname === "/salons/nouveau") return <NewSpacePage />;
  if (pathname.startsWith("/salons")) return <SpacePage />;
  if (pathname === "/skills" || pathname === "/skills/") return <SkillsPage />;
  if (pathname === "/skills/nouveau") return <NewSkillPage />;
  if (pathname.startsWith("/skills/")) return <SkillPage />;
  if (pathname === "/" || pathname === "/fil" || pathname === "/fil/") return <FeedPage />;
  if (pathname === "/fil/nouveau") return <NewPostPage />;
  if (pathname.startsWith("/fil/")) return <PostPage />;
  if (pathname === "/projets" || pathname === "/projets/") return <ProjectsPage />;
  if (pathname === "/projets/nouveau") return <NewProjectPage />;
  if (/^\/projets\/[^/]+\/demandes\/nouvelle$/.test(pathname)) return <NewHelpRequestPage />;
  if (pathname.startsWith("/projets/")) return <ProjectPage />;
  if (pathname === "/competitions" || pathname === "/competitions/") return <CompetitionsPage />;
  if (pathname === "/competitions/nouvelle") return <NewCompetitionPage />;
  if (/^\/competitions\/[^/]+\/soumettre$/.test(pathname)) return <SubmitProjectPage />;
  if (pathname.startsWith("/competitions/")) return <CompetitionPage />;
  if (pathname.startsWith("/u/")) return <UserPage />;
  if (pathname === "/pro") return <ProPage />;
  if (pathname === "/moderation") return <ModerationPage />;
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
          <SessionProvider>
            <Suspense fallback={<PageFallback />}>{resolvePage(window.location.pathname)}</Suspense>
          </SessionProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
