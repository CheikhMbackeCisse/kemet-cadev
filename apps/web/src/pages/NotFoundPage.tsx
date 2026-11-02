import { ReadingPage } from "../components/layout/ReadingPage.js";
import { fr } from "../i18n/fr.js";

export function NotFoundPage() {
  return (
    <ReadingPage header={<h1 className="text-lg font-bold text-text">{fr.notFound.title}</h1>}>
      <p className="text-sm text-text-2">
        {fr.notFound.body}{" "}
        <a href="/fil" className="text-link hover:underline">
          {fr.notFound.backToFeed}
        </a>
      </p>
    </ReadingPage>
  );
}
