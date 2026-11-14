// Contenu ajouté par seedDemoMedia. Les fichiers nommés ici sont générés par
// seed-assets/render.mjs dans seed-assets/out/. Les blagues et les textes
// sont écrits pour Kemet, aucun n'est repris d'ailleurs.

type PostFormat = "astuce" | "question";

export interface DemoMediaPost {
  key: string;
  authorHandle: string;
  format?: PostFormat;
  body: string;
  image?: string;
  /** Carrousel : plusieurs images, dans l'ordre d'affichage. */
  images?: string[];
  /**
   * Vidéo verticale, seule dans son post. Son aperçu `<nom>-poster.jpg` est
   * produit avec elle par render.ts.
   */
  video?: string;
  hoursAgo: number;
}

export const DEMO_MEDIA_POSTS: DemoMediaPost[] = [
  {
    key: "video-deployer-vendredi",
    authorHandle: "dapo-oyelaran",
    video: "post-video-deploy.webm",
    hoursAgo: 3,
    body:
      "Six vérifications vertes, une migration et un test de santé. Déployer un vendredi soir ne me " +
      "fait plus peur depuis que la CI refuse tout ce qui n'est pas prouvé.",
  },
  {
    key: "video-index-commandes",
    authorHandle: "lyna-bouzid",
    format: "astuce",
    video: "post-video-index.webm",
    hoursAgo: 7,
    body:
      "La liste des commandes d'une boutique mettait 4 secondes à s'afficher. Un index composé sur les deux " +
      "colonnes du filtre et du tri, et on passe à 80 ms. Lisez le plan d'exécution avant d'ajouter du cache.",
  },
  {
    key: "video-coupure-tests",
    authorHandle: "ebo-quansah",
    video: "post-video-coupure.webm",
    hoursAgo: 20,
    body:
      "Course entre ma batterie et la suite de tests pendant la coupure de ce matin. Les tests ont gagné, " +
      "de peu.",
  },
  {
    key: "carrousel-vie-d-un-bug",
    authorHandle: "kiprono-langat",
    images: [
      "carousel-bug-1.jpg",
      "carousel-bug-2.jpg",
      "carousel-bug-3.jpg",
      "carousel-bug-4.jpg",
    ],
    hoursAgo: 5,
    body:
      "La vie d'un bug en quatre étapes. Toute ressemblance avec mon vendredi dernier est " +
      "purement volontaire. Faites défiler jusqu'au correctif.",
  },
  {
    key: "carrousel-git-trois-cartes",
    authorHandle: "ghizlane-amrani",
    format: "astuce",
    images: ["carousel-git-1.jpg", "carousel-git-2.jpg", "carousel-git-3.jpg"],
    hoursAgo: 9,
    body:
      "Mémo Git en trois cartes pour celles et ceux qui débutent en équipe : une branche par idée, " +
      "rattraper main sans fusion inutile, et annuler sans paniquer.",
  },
  {
    key: "carrousel-quatre-go-de-ram",
    authorHandle: "heritier-kabeya",
    images: ["carousel-ram-1.jpg", "carousel-ram-2.jpg", "carousel-ram-3.jpg"],
    hoursAgo: 14,
    body:
      "Pas de budget pour un nouveau PC cette année. Voici comment je code sur 4 Go de RAM sans " +
      "devenir fou. Le chiffre de la dernière carte m'a surpris moi-même.",
  },
  {
    key: "site-moche-perso",
    authorHandle: "ahou-kouadio",
    image: "feed-ugly-site-perso.jpg",
    hoursAgo: 30,
    body:
      "Je m'entraîne pour la compétition du site le plus moche. Première version : 47 balises center, un " +
      "compteur de visites bloqué à 42 et deux boutons qui se disputent l'attention. Je pense pouvoir faire " +
      "pire d'ici la date limite.",
  },
  {
    key: "site-moche-boutique",
    authorHandle: "skander-jaziri",
    image: "feed-ugly-site-boutique.jpg",
    hoursAgo: 22,
    body:
      "Ma réponse au site d'Ahou : une boutique en ligne où le prix barré est plus bas que le vrai prix. " +
      "Aucun client n'a été blessé pendant la conception, aucun n'a acheté non plus.",
  },
  {
    key: "baobab-une-div",
    authorHandle: "dapo-oyelaran",
    image: "feed-une-seule-div.jpg",
    hoursAgo: 50,
    body:
      "Un baobab au coucher du soleil avec une seule div et zéro image, pour le défi du dessin en CSS. " +
      "Tout tient dans les arrière-plans superposés. Le tronc m'a pris plus de temps que le soleil.\n\n" +
      "```css\n" +
      ".baobab {\n" +
      "  background:\n" +
      "    linear-gradient(#3a2416, #3a2416) 405px 245px / 120px 235px no-repeat,\n" +
      "    radial-gradient(circle at 640px 330px, #ffd36b 0 70px, transparent 75px),\n" +
      "    linear-gradient(#ff7a59, #ffd9a0);\n" +
      "}\n" +
      "```",
  },
  {
    key: "push-force-vendredi",
    authorHandle: "lyna-bouzid",
    image: "feed-terminal-vendredi.jpg",
    hoursAgo: 54,
    body:
      "Rappel amical avant le week-end : la protection de branche existe pour une bonne raison. " +
      "Capture reconstituée, aucune production n'a été abîmée. Cette fois.",
  },
  {
    key: "erreur-lundi",
    authorHandle: "kgomotso-mahlangu",
    image: "feed-erreur-lundi.jpg",
    hoursAgo: 3,
    body: "Mon lundi en une capture. Si quelqu'un sait comment rendre lundi appelable, je prends.",
  },
  {
    key: "ci-fuseau-horaire",
    authorHandle: "ebo-quansah",
    image: "feed-terminal-ci.jpg",
    hoursAgo: 18,
    body:
      "Ça passe en local. Ça casse en CI. Il était 23 h. C'était le fuseau horaire. " +
      "C'est toujours le fuseau horaire.",
  },
  {
    key: "estimation-sprint",
    authorHandle: "heritier-kabeya",
    image: "feed-estimation.jpg",
    hoursAgo: 40,
    body:
      "Pendant un sprint, j'ai noté le temps estimé et le temps réel de chaque tâche. " +
      "Je ne commenterai pas la ligne de la mise à jour de dépendance.",
  },
  {
    key: "index-concurrently",
    authorHandle: "coumba-thiam",
    format: "astuce",
    hoursAgo: 16,
    body:
      "Sur une table qui sert du trafic, créez vos index avec CONCURRENTLY. C'est plus lent, mais la table " +
      "reste ouverte en écriture pendant toute la création.\n\n" +
      "```sql\n" +
      "CREATE INDEX CONCURRENTLY idx_payments_created_at\n" +
      "  ON payments (created_at);\n" +
      "```\n\n" +
      "Piège : la commande refuse de tourner dans une transaction, donc dans la plupart des outils de " +
      "migration il faut une option dédiée.",
  },
  {
    key: "cle-idempotence",
    authorHandle: "kiprono-langat",
    format: "astuce",
    hoursAgo: 36,
    body:
      "La règle qui nous a évité tous les doubles débits : même clé et même corps, même réponse. " +
      "Même clé et autre corps, une erreur, jamais un second paiement.\n\n" +
      "```typescript\n" +
      "const existing = await payments.findByKey(idempotencyKey);\n" +
      "if (existing) {\n" +
      '  if (existing.bodyHash !== hashBody(body)) throw new ConflictError("Clé déjà utilisée.");\n' +
      "  return existing.response;\n" +
      "}\n" +
      "```",
  },
  {
    key: "arabizi-normalisation",
    authorHandle: "ghizlane-amrani",
    format: "question",
    hoursAgo: 11,
    body:
      "Comment vous normalisez l'arabe écrit en lettres latines, avec des chiffres à la place de certaines " +
      "lettres ? Mon approche actuelle :\n\n" +
      "```python\n" +
      'REPLACEMENTS = {"3": "ع", "7": "ح", "9": "ق"}\n\n' +
      "def normalize(text: str) -> str:\n" +
      '    return "".join(REPLACEMENTS.get(char, char) for char in text.lower())\n' +
      "```\n\n" +
      "Ça casse dès que quelqu'un écrit un vrai nombre, comme une heure de rendez-vous. Des idées ?",
  },
  {
    key: "retry-backoff",
    authorHandle: "skander-jaziri",
    format: "astuce",
    hoursAgo: 64,
    body:
      "Sur un réseau instable, une nouvelle tentative immédiate ne fait qu'ajouter de la charge. " +
      "Attendre de plus en plus longtemps, avec un peu de hasard pour que tous les téléphones ne " +
      "reviennent pas à la même seconde :\n\n" +
      "```javascript\n" +
      "async function retry(task, attempts = 5) {\n" +
      "  for (let i = 0; i < attempts; i += 1) {\n" +
      "    try {\n" +
      "      return await task();\n" +
      "    } catch (error) {\n" +
      "      if (i === attempts - 1) throw error;\n" +
      "      const delay = 2 ** i * 500 + Math.random() * 300;\n" +
      "      await new Promise((resolve) => setTimeout(resolve, delay));\n" +
      "    }\n" +
      "  }\n" +
      "}\n" +
      "```",
  },
];

/** Images ajoutées à des posts du seed d'origine, retrouvés par leur auteur et le début de leur texte. */
export const DEMO_EXISTING_POST_IMAGES: {
  authorHandle: string;
  bodyStart: string;
  image: string;
}[] = [
  {
    authorHandle: "lyna-bouzid",
    bodyStart: "J'ai écrit un petit outil qui détecte les builds Docker",
    image: "work-ci-memoire.jpg",
  },
  {
    authorHandle: "kgomotso-mahlangu",
    bodyStart: "Mes DAG Airflow plantent",
    image: "work-meteo-cover.jpg",
  },
  {
    authorHandle: "heritier-kabeya",
    bodyStart: "Firmware pour capteurs agricoles",
    image: "work-capteurs-batterie.jpg",
  },
  {
    authorHandle: "ebo-quansah",
    bodyStart: "Quelqu'un a un pattern fiable pour la synchronisation",
    image: "work-sync-conflict.jpg",
  },
  {
    authorHandle: "kiprono-langat",
    bodyStart: "Sur un système de paiement mobile, résoudre",
    image: "work-idempotence-logs.jpg",
  },
  {
    authorHandle: "dapo-oyelaran",
    bodyStart: "Pour un design system React",
    image: "work-a11y-cover.jpg",
  },
];

export interface DemoWorkMediaPlan {
  slug: string;
  cover: string;
  gallery: string[];
  video?: string;
}

export const DEMO_WORK_MEDIA: DemoWorkMediaPlan[] = [
  {
    slug: "synchronisation-hors-ligne-banque-mobile",
    cover: "work-sync-cover.jpg",
    gallery: ["work-sync-conflict.jpg", "work-sync-queue.jpg"],
  },
  {
    slug: "idempotence-paiements-mobile-money",
    cover: "work-idempotence-cover.jpg",
    gallery: ["work-idempotence-receipt.jpg", "work-idempotence-logs.jpg"],
    video: "work-idempotence-video.webm",
  },
  {
    slug: "stock-boutique-hors-ligne",
    cover: "work-stock-cover.jpg",
    gallery: ["work-stock-livraisons.jpg", "work-stock-ventes.jpg"],
  },
  {
    slug: "maladies-manioc-vision-mobile",
    cover: "work-manioc-cover.jpg",
    gallery: ["work-manioc-resultat.jpg", "work-manioc-entrainement.jpg"],
  },
  {
    slug: "capteurs-sol-lora-une-pile",
    cover: "work-capteurs-cover.jpg",
    gallery: ["work-capteurs-boitier.jpg", "work-capteurs-batterie.jpg"],
    video: "work-capteurs-video.webm",
  },
  {
    slug: "pipeline-meteo-cooperatives-agricoles",
    cover: "work-meteo-cover.jpg",
    gallery: ["work-meteo-sms.jpg", "work-capteurs-cover.jpg"],
  },
  {
    slug: "formulaires-paiement-accessibles-react",
    cover: "work-a11y-cover.jpg",
    gallery: ["work-a11y-audit.jpg", "work-idempotence-receipt.jpg"],
  },
  {
    slug: "ci-docker-runners-partages",
    cover: "work-ci-cover.jpg",
    gallery: ["work-ci-memoire.jpg", "feed-terminal-ci.jpg"],
  },
];

/**
 * Utilisations par @kocc et avis visés pour chaque skill de démonstration.
 * Deux skills seulement passent le millier : des compteurs tous énormes ne
 * seraient pas crédibles. Le seed amène chaque skill à ces nombres, en
 * ajoutant ou en retirant des lignes de figurants, jamais celles d'un compte.
 */
export const DEMO_SKILL_TARGETS: {
  slug: string;
  uses: number;
  ratings: number;
  averageStars: number;
}[] = [
  { slug: "wave-paiements", uses: 11_240, ratings: 2_310, averageStars: 4.8 },
  { slug: "paiement-mobile-idempotence", uses: 7_920, ratings: 1_488, averageStars: 4.9 },
  { slug: "flutter-sync-hors-ligne", uses: 640, ratings: 143, averageStars: 4.7 },
  { slug: "ux-reseau-instable", uses: 512, ratings: 97, averageStars: 4.8 },
  { slug: "design-system-theme-sombre", uses: 388, ratings: 74, averageStars: 4.5 },
  { slug: "frame-pacing-android-bas-de-gamme", uses: 214, ratings: 51, averageStars: 4.7 },
  { slug: "ci-docker-fiable", uses: 869, ratings: 142, averageStars: 4.6 },
  { slug: "firmware-autonomie-batterie", uses: 160, ratings: 38, averageStars: 4.1 },
  { slug: "airflow-workers-oom", uses: 97, ratings: 12, averageStars: 3.9 },
  { slug: "nlp-bas-ressource-arabe", uses: 75, ratings: 21, averageStars: 4.4 },
];

/**
 * Nom enregistré pour chaque fichier : le fil s'en sert comme texte
 * alternatif d'une image, il doit donc décrire ce qu'elle montre.
 */
export const DEMO_ASSET_NAMES: Record<string, string> = {
  "post-video-deploy.webm": "Déployer un vendredi soir.webm",
  "post-video-index.webm": "Une requête de 4,2 s ramenée à 80 ms.webm",
  "post-video-coupure.webm": "Coupure de courant pendant les tests.webm",
  "carousel-bug-1.jpg": "Étape 1 : les tests passent sur ma machine.jpg",
  "carousel-bug-2.jpg": "Étape 2 : tout marche aussi en préprod.jpg",
  "carousel-bug-3.jpg": "Étape 3 : erreur 500 en production un vendredi soir.jpg",
  "carousel-bug-4.jpg": "Étape 4 : le correctif tient en un point-virgule.jpg",
  "carousel-git-1.jpg": "Git : créer une branche par idée et relire chaque morceau.jpg",
  "carousel-git-2.jpg": "Git : rattraper main avec un rebase.jpg",
  "carousel-git-3.jpg": "Git : annuler avec restore et revert.jpg",
  "carousel-ram-1.jpg": "Jauge de mémoire à 92 % avec 4 Go de RAM.jpg",
  "carousel-ram-2.jpg": "Quatre astuces pour coder avec 4 Go de RAM.jpg",
  "carousel-ram-3.jpg": "Jauge de mémoire redescendue à 58 %.jpg",
  "feed-ugly-site-perso.jpg": "Page perso aux couleurs criardes, avec un compteur de visites.jpg",
  "feed-ugly-site-boutique.jpg": "Boutique en ligne volontairement illisible.jpg",
  "feed-une-seule-div.jpg": "Baobab au coucher du soleil dessiné avec une seule div.jpg",
  "feed-terminal-vendredi.jpg": "Terminal : push forcé sur main un vendredi soir.jpg",
  "feed-erreur-lundi.jpg": "Fenêtre d'erreur : lundi is not a function.jpg",
  "feed-terminal-ci.jpg": "Tests qui passent en local et échouent en CI.jpg",
  "feed-estimation.jpg": "Graphique du temps estimé contre le temps réel.jpg",
  "work-sync-cover.jpg": "Application bancaire hors ligne avec trois opérations en attente.jpg",
  "work-sync-conflict.jpg": "Écran de conflit de synchronisation entre deux appareils.jpg",
  "work-sync-queue.jpg": "Tableau de bord de la file de synchronisation.jpg",
  "work-idempotence-cover.jpg": "Registre des paiements avec les requêtes rejouées.jpg",
  "work-idempotence-receipt.jpg": "Confirmation de paiement après une coupure réseau.jpg",
  "work-idempotence-logs.jpg": "Journaux d'une API de paiement avec clé d'idempotence.jpg",
  "work-idempotence-video.webm": "Paiement rejoué après une coupure réseau.webm",
  "work-stock-cover.jpg": "Stock d'une boutique de quartier sur téléphone.jpg",
  "work-stock-livraisons.jpg": "Carte de la tournée de livraison du matin.jpg",
  "work-stock-ventes.jpg": "Ventes de la semaine de 42 boutiques.jpg",
  "work-manioc-cover.jpg": "Feuille de manioc analysée par la caméra du téléphone.jpg",
  "work-manioc-resultat.jpg": "Résultat du diagnostic de la feuille de manioc.jpg",
  "work-manioc-entrainement.jpg": "Courbes d'entraînement du modèle de diagnostic.jpg",
  "work-capteurs-cover.jpg": "Humidité du sol relevée par les capteurs LoRa.jpg",
  "work-capteurs-batterie.jpg": "Projection de l'autonomie de la pile des capteurs.jpg",
  "work-capteurs-boitier.jpg": "Boîtier du capteur d'humidité.jpg",
  "work-capteurs-video.webm": "Courbe d'humidité du sol en direct.webm",
  "work-meteo-cover.jpg": "Graphe des tâches du pipeline météo.jpg",
  "work-meteo-sms.jpg": "Alerte météo reçue par SMS.jpg",
  "work-a11y-cover.jpg": "Formulaire de paiement avec un message d'erreur clair.jpg",
  "work-a11y-audit.jpg": "Audit d'accessibilité avant et après la refonte.jpg",
  "work-ci-cover.jpg": "Pipeline de CI sous surveillance mémoire.jpg",
  "work-ci-memoire.jpg": "Mémoire d'un build Docker suivie dans le terminal.jpg",
};
