import { useEffect, type CSSProperties } from "react";
import { AuthBackground } from "../components/auth/AuthBackground.js";
import { KemetSymbol } from "../components/ui/KemetSymbol.js";
import { introQuestionPath } from "../lib/intro/introSteps.js";
import { markIntroSeen } from "../lib/intro/introStorage.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

interface Glyph {
  text: string;
  left: string;
  top: string;
  duration: string;
  delay: string;
}

// Positions fixes plutôt qu'aléatoires : le même écran à chaque visite, et
// rien qui ne bouge entre deux rendus.
const GLYPHS: Glyph[] = [
  { text: "</>", left: "8%", top: "70%", duration: "26s", delay: "-4s" },
  { text: "{ }", left: "20%", top: "92%", duration: "32s", delay: "-18s" },
  { text: "=>", left: "34%", top: "80%", duration: "28s", delay: "-9s" },
  { text: "fn()", left: "62%", top: "88%", duration: "30s", delay: "-22s" },
  { text: "[ ]", left: "76%", top: "74%", duration: "24s", delay: "-2s" },
  { text: ";", left: "88%", top: "95%", duration: "34s", delay: "-14s" },
  { text: "#", left: "48%", top: "98%", duration: "36s", delay: "-27s" },
  { text: "0x1F", left: "14%", top: "40%", duration: "29s", delay: "-11s" },
  { text: "&&", left: "82%", top: "45%", duration: "27s", delay: "-6s" },
  { text: "git", left: "56%", top: "55%", duration: "33s", delay: "-20s" },
];

/**
 * Première arrivée d'un visiteur. Le fond de marque des écrans de compte
 * (docs/adr/0019-fond-des-ecrans-de-compte.md) est réutilisé ici : c'est la
 * porte d'entrée vers l'inscription.
 */
export function WelcomePage() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "ready" || status === "incomplete") {
      markIntroSeen();
      window.location.replace("/");
    }
  }, [status]);

  function explore() {
    markIntroSeen();
    window.location.href = "/fil";
  }

  return (
    <div className="relative min-h-viewport w-full overflow-hidden">
      <AuthBackground />
      <ul aria-hidden="true" className="pointer-events-none absolute inset-0">
        {GLYPHS.map((glyph) => (
          <li
            key={glyph.text}
            className="intro-glyph absolute font-mono text-lg text-auth-text-muted md:text-2xl"
            style={
              {
                left: glyph.left,
                top: glyph.top,
                "--intro-duration": glyph.duration,
                "--intro-delay": glyph.delay,
              } as CSSProperties
            }
          >
            {glyph.text}
          </li>
        ))}
      </ul>

      <main className="auth-on-dark relative z-10 mx-auto flex min-h-viewport w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <span className="kemet-on-dark">
          <KemetSymbol className="h-28 w-auto md:h-36" />
        </span>
        <h1 className="text-xl font-bold text-auth-text md:text-hero">{fr.intro.welcomeTitle}</h1>
        <p className="max-w-md text-md text-auth-text-muted">{fr.intro.welcomeText}</p>
        <div className="mt-4 flex w-full flex-col items-center gap-4">
          <a
            href={introQuestionPath("who")}
            className="inline-flex h-control-mobile w-full items-center justify-center rounded-control bg-white px-6 text-base font-semibold text-[var(--auth-bg-from)] hover:bg-white/90 md:h-control md:w-auto md:min-w-48"
          >
            {fr.intro.start}
          </a>
          <button
            type="button"
            onClick={explore}
            className="inline-flex min-h-control-mobile items-center px-2 text-sm font-medium text-auth-text-muted underline-offset-4 hover:text-auth-text hover:underline md:min-h-control"
          >
            {fr.intro.explore}
          </button>
        </div>
      </main>
    </div>
  );
}
