import { ReadingPage } from "../components/layout/ReadingPage.js";
import { fr } from "../i18n/fr.js";

/** Courte explication liée depuis la mention "Données de démonstration". */
export function DemoDataPage() {
  return (
    <ReadingPage header={<h1 className="text-lg font-bold text-text">{fr.demo.title}</h1>}>
      <div className="flex max-w-xl flex-col gap-3 text-base text-text-2">
        {fr.demo.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </ReadingPage>
  );
}
