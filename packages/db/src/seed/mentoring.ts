import type { DbOrTx } from "../client.js";
import { applications, helpRequests, postFeedback, postReplies, posts } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { seededShuffle } from "./filler-profiles.js";
import type { DemoProjectIds } from "./projects.js";
import { daysAgo } from "./time.js";

// Entraide passée d'Coumba Thiam, propriétaire de l'espace CADEV 2026 et jurée
// du mini-défi : chaque point de son niveau Architecte vient d'une réponse
// marquée comme solution, d'une aide acceptée sur un projet ou d'un retour
// sur un post À tester, écrits ici. Tout est daté de 15 à 82 jours : hors du
// fil "Pour toi" (14 jours), dans la fenêtre de régularité (90 jours).
const FIRST_DAY = 15;
const LAST_DAY = 82;

interface AnsweredQuestion {
  question: string;
  answer: string;
}

const ANSWERED_QUESTIONS: AnsweredQuestion[] = [
  {
    question: "Mon API Fastify renvoie des 500 au hasard sous charge, et les logs disent seulement \"too many clients\". Je regarde où ?",
    answer: "Le pool de connexions PostgreSQL est épuisé. Crée un seul pool pour tout le processus, pas un par requête, et fixe sa taille sous max_connections divisé par le nombre d'instances.",
  },
  {
    question: "Comment stocker des montants en FCFA sans erreurs d'arrondi ? J'utilise des float en JavaScript.",
    answer: "Le franc CFA n'a pas de centimes : stocke des entiers (bigint en base, number entier côté JS). Pour une devise à centimes, stocke les centimes en entier, jamais un float.",
  },
  {
    question: "Un même webhook de paiement arrive deux fois et je crédite deux fois le client. Une idée propre ?",
    answer: "Rends le traitement idempotent : un index unique sur l'identifiant de transaction du fournisseur, et un insert avec on conflict do nothing. Le second appel ne fait plus rien.",
  },
  {
    question: "Faut-il mettre les sessions utilisateur dans Redis ou dans PostgreSQL pour une petite app ?",
    answer: "PostgreSQL suffit largement à cette échelle, avec un index sur le jeton et une date d'expiration. Un cache en plus ne se justifie que si tu mesures un vrai goulot.",
  },
  {
    question: "Ma requête avec LIKE '%dakar%' devient lente à 2 millions de lignes. Index B-tree classique, rien ne change.",
    answer: "Un B-tree ne sert pas pour un motif qui commence par %. Active pg_trgm et crée un index GIN avec gin_trgm_ops sur la colonne : la même requête utilisera l'index.",
  },
  {
    question: "Pagination : OFFSET devient lent après la page 500. Comment font les gros sites ?",
    answer: "Pagination par curseur : tu passes la dernière valeur vue (date, puis id pour départager) et tu filtres dessus. Le coût ne dépend plus de la profondeur de la page.",
  },
  {
    question: "Comment valider le corps d'une requête Fastify sans dupliquer mes types TypeScript ?",
    answer: "Écris le schéma une fois avec Zod, déduis le type avec z.infer et appelle parse au début du handler. Le même schéma peut vivre dans un paquet partagé avec le client.",
  },
  {
    question: "Je dois envoyer 3 000 SMS de rappel chaque soir. Une boucle avec await dans la route, c'est une mauvaise idée ?",
    answer: "Oui : la requête expire et un plantage perd tout. Mets un job par lot dans une file (BullMQ par exemple) avec des tentatives et un délai, et la route répond tout de suite.",
  },
  {
    question: "Mes migrations Drizzle passent en local mais cassent en production sur une colonne NOT NULL ajoutée.",
    answer: "La table de production a déjà des lignes. Ajoute la colonne nullable ou avec une valeur par défaut, remplis-la, puis pose NOT NULL dans une seconde migration.",
  },
  {
    question: "Comment éviter qu'un utilisateur modifie la commande d'un autre en changeant l'id dans l'URL ?",
    answer: "Ne fais jamais confiance à l'id seul : filtre toujours par l'identifiant de la session dans la requête (where id = ? and owner_id = ?) et renvoie 404 si rien ne correspond.",
  },
  {
    question: "JWT ou cookie de session pour une app web classique avec un seul backend ?",
    answer: "Cookie de session httpOnly, secure et sameSite=lax. Un JWT se révoque mal et n'apporte rien quand un seul serveur lit la session.",
  },
  {
    question: "J'ai une transaction qui lit un solde puis l'écrit, et deux requêtes simultanées font passer le solde en négatif.",
    answer: "Fais la mise à jour en une seule instruction conditionnelle (update ... set solde = solde - x where solde >= x) ou verrouille la ligne avec select ... for update dans la transaction.",
  },
  {
    question: "Quel format de date renvoyer dans une API consommée au Sénégal, au Maroc et au Kenya ?",
    answer: "ISO 8601 en UTC partout dans l'API. Le fuseau ne s'applique qu'à l'affichage, côté client, avec Intl.DateTimeFormat.",
  },
  {
    question: "Mon conteneur Node redémarre en boucle en production avec \"JavaScript heap out of memory\".",
    answer: "Regarde d'abord ce que tu gardes en mémoire (un cache sans limite, une liste chargée en entier). Ensuite seulement, aligne --max-old-space-size sur la mémoire du conteneur.",
  },
  {
    question: "Comment tester mes routes qui touchent la base sans tout simuler ?",
    answer: "Une base de test réelle, vidée avant chaque test, et app.inject de Fastify pour appeler les routes sans ouvrir de port. Les mocks de base cachent trop de bugs SQL.",
  },
  {
    question: "Rate limiting : par IP ou par utilisateur ?",
    answer: "Les deux, selon la route. Par IP avant la connexion (inscription, mot de passe), par utilisateur ensuite. Derrière un proxy, configure trustProxy sinon toutes les requêtes ont la même IP.",
  },
  {
    question: "Mon index composite (pays, date) n'est pas utilisé quand je filtre seulement par date.",
    answer: "Un index composite sert de gauche à droite. Filtrer sur la date seule ne profite pas d'un index qui commence par le pays : ajoute un index sur la date, ou inverse l'ordre si c'est le cas le plus fréquent.",
  },
  {
    question: "Comment stocker des mots de passe en 2026 ? On m'a parlé de bcrypt.",
    answer: "Argon2id est le choix recommandé aujourd'hui, bcrypt reste acceptable. Dans tous les cas une fonction lente et salée, jamais un simple SHA-256.",
  },
  {
    question: "Est-ce que je dois mettre un ORM ou écrire du SQL à la main pour mon premier backend ?",
    answer: "Un constructeur de requêtes typé comme Drizzle donne le meilleur des deux : tu écris quasiment du SQL, avec les types. Apprends quand même à lire un EXPLAIN.",
  },
  {
    question: "Comment exposer les fichiers envoyés par les utilisateurs sans risque ?",
    answer: "Détecte le type par le contenu, pas par l'extension, sers-les avec Content-Type fixé et X-Content-Type-Options: nosniff, et en pièce jointe pour tout ce qui n'est pas une image sûre.",
  },
  {
    question: "Le temps réel avec Socket.IO marche sur une instance mais pas quand j'en lance deux.",
    answer: "Chaque instance ne connaît que ses propres sockets. Ajoute un adaptateur pub/sub (Redis ou Valkey) pour que les événements passent d'une instance à l'autre.",
  },
  {
    question: "Faut-il un microservice par module pour un projet de quatre personnes ?",
    answer: "Non. Un monolithe bien découpé en modules se déploie et se débogue bien plus simplement. Sépare un service seulement quand une contrainte réelle l'impose, par exemple un worker.",
  },
  {
    question: "Comment logguer les erreurs sans mettre les mots de passe dans les logs ?",
    answer: "Configure la censure des champs sensibles dans le logger (redact chez pino) et ne loggue jamais le corps complet des requêtes d'authentification.",
  },
  {
    question: "L'intégration Orange Money me renvoie parfois un timeout alors que le paiement est passé.",
    answer: "Un timeout ne veut pas dire un échec. Garde la transaction en attente et interroge le statut côté fournisseur avant de conclure, puis laisse le webhook trancher.",
  },
  {
    question: "Comment versionner une API publique sans casser les applications mobiles déjà installées ?",
    answer: "Préfixe les routes (/v1), ajoute des champs sans jamais en retirer, et garde l'ancienne version tant que des clients l'appellent. Mesure avant de supprimer.",
  },
  {
    question: "Mes tests passent seuls mais échouent quand je lance toute la suite.",
    answer: "Ils partagent un état : la même base, une variable globale ou une horloge. Isole chaque test (base vidée, données créées dans le test) et ne dépends jamais de l'ordre.",
  },
  {
    question: "Où mettre les clés API de mon fournisseur SMS ? Dans le code, c'est plus simple.",
    answer: "Dans des variables d'environnement, jamais dans le dépôt. Documente-les dans un .env.example sans valeur réelle et change la clé si elle a déjà été commitée.",
  },
  {
    question: "Une recherche plein texte en français dans PostgreSQL, ça vaut le coup avant Elasticsearch ?",
    answer: "Oui pour commencer : to_tsvector('french', ...) avec un index GIN gère les accents et les pluriels. Tu sauras vite si tu as besoin de plus.",
  },
  {
    question: "Comment faire une suppression de compte sans casser les conversations des autres ?",
    answer: "Anonymise plutôt que d'effacer : l'auteur devient \"Compte supprimé\" et les données personnelles partent. Les messages des autres restent lisibles.",
  },
  {
    question: "Le CORS bloque mes appels depuis le front en développement, même avec origin: '*'.",
    answer: "Avec des cookies, '*' est refusé par le navigateur. Liste l'origine exacte et active credentials, ou passe par le proxy du serveur de développement pour rester sur la même origine.",
  },
  {
    question: "Comment garder une API rapide pour des utilisateurs en 3G ?",
    answer: "Renvoie moins : pagination, champs utiles seulement, compression gzip ou brotli. Et mesure le temps total vu par le client, pas seulement celui du serveur.",
  },
  {
    question: "Mon worker traite deux fois le même job après un redémarrage.",
    answer: "Une file garantit en général \"au moins une fois\". Rends le job idempotent, par exemple avec une clé unique en base, plutôt que d'espérer qu'il ne soit jamais rejoué.",
  },
  {
    question: "Comment gérer les fuseaux horaires pour un rappel \"tous les jours à 8 h\" ?",
    answer: "Stocke le fuseau de la personne (Africa/Dakar, Africa/Nairobi) et calcule la prochaine échéance dans ce fuseau, puis convertis en UTC pour la planification.",
  },
  {
    question: "Est-ce grave de renvoyer le message d'erreur PostgreSQL brut au client ?",
    answer: "Oui : il révèle des noms de tables et de contraintes. Renvoie une erreur métier claire avec un code, et garde le détail dans les logs du serveur.",
  },
  {
    question: "Comment sauvegarder ma base PostgreSQL de production sur un petit VPS ?",
    answer: "pg_dump chaque nuit, chiffré, copié hors du serveur. Et surtout, restaure-le régulièrement sur une base vide : une sauvegarde jamais restaurée ne compte pas.",
  },
  {
    question: "UUID ou entier auto-incrémenté comme clé primaire ?",
    answer: "UUID dès qu'un identifiant sort dans une URL : on ne peut pas deviner les autres ni compter tes lignes. L'entier reste très bien pour des tables purement internes.",
  },
  {
    question: "Mon endpoint de recherche se fait spammer par un bot.",
    answer: "Limite le débit par IP sur cette route, renvoie 429 avec Retry-After, et mets en cache les recherches fréquentes. Un captcha seulement si ça ne suffit pas.",
  },
  {
    question: "Comment structurer les dossiers d'un backend Fastify qui grossit ?",
    answer: "Par module métier (routes, accès aux données, sérialisation), pas par type de fichier. Les routes restent fines et les requêtes SQL vivent dans des fonctions nommées.",
  },
  {
    question: "Je dois importer un CSV de 500 000 lignes de transactions.",
    answer: "Lis le fichier en flux, valide chaque ligne et insère par lots de quelques milliers dans une transaction par lot. COPY est encore plus rapide si le format est propre.",
  },
  {
    question: "Comment savoir quelle requête SQL ralentit mon application ?",
    answer: "Active pg_stat_statements et trie par temps total : la coupable est souvent une petite requête appelée des milliers de fois, pas la grosse.",
  },
  {
    question: "Les notifications push de mon app arrivent en double sur Android.",
    answer: "Le jeton de l'appareil a changé et l'ancien est resté en base. Garde un seul jeton par appareil, mis à jour à chaque lancement, et supprime ceux que le fournisseur signale invalides.",
  },
  {
    question: "Comment exposer un état de santé pour mon orchestrateur de conteneurs ?",
    answer: "Une route /health qui vérifie vraiment les dépendances critiques (la base répond) et répond vite. Garde-la sans authentification mais sans rien de sensible.",
  },
  {
    question: "Faut-il chiffrer les numéros de téléphone en base ?",
    answer: "Commence par en garder le moins possible et restreindre l'accès. Un chiffrement au niveau colonne a un coût (recherche, rotation des clés) : réserve-le aux données les plus sensibles.",
  },
  {
    question: "Une transaction PostgreSQL reste ouverte des minutes et bloque tout.",
    answer: "Ne fais jamais d'appel réseau externe (paiement, e-mail) au milieu d'une transaction. Pose aussi idle_in_transaction_session_timeout pour qu'une session oubliée soit coupée.",
  },
  {
    question: "Comment générer un identifiant lisible pour les factures, du type FAC-2026-0042 ?",
    answer: "Une séquence PostgreSQL par année, formatée à l'insertion. Ne calcule jamais max(numéro) + 1 dans le code : deux requêtes simultanées obtiendraient le même.",
  },
  {
    question: "Ma route d'export CSV fait tomber le serveur quand le fichier est gros.",
    answer: "Envoie le fichier en flux à mesure que tu lis les lignes, au lieu de tout construire en mémoire. Pour les très gros exports, prépare-le dans un job et envoie un lien.",
  },
  {
    question: "Comment empêcher deux personnes de réserver le même créneau ?",
    answer: "Une contrainte d'unicité en base sur (ressource, créneau), et tu traites l'erreur de conflit. La base est le seul endroit où deux requêtes simultanées se départagent sûrement.",
  },
  {
    question: "Quelle différence entre 401 et 403 pour mon API ?",
    answer: "401 : on ne sait pas qui tu es (pas de session ou session expirée). 403 : on sait qui tu es, mais tu n'as pas le droit. Et 404 quand révéler l'existence de la ressource serait déjà une fuite.",
  },
];

interface ProjectHelp {
  project: keyof Omit<DemoProjectIds, "waveLedger">;
  owner: keyof DemoAccountIds;
  day: number;
  title: string;
  description: string;
  application: string;
}

// Jamais avant la création du projet (voir projects.ts).
const PROJECT_HELP: ProjectHelp[] = [
  {
    project: "pesaRail",
    owner: "kipronoLangat",
    day: 82,
    title: "Relecture du schéma de rapprochement",
    description: "Je veux un second regard sur les tables de rapprochement avant d'y brancher les opérateurs.",
    application: "J'ai fait le même rapprochement pour des paiements Wave, je peux relire le schéma cette semaine.",
  },
  {
    project: "pesaRail",
    owner: "kipronoLangat",
    day: 71,
    title: "Idempotence des callbacks opérateurs",
    description: "Certains opérateurs rejouent leurs callbacks. Cherche quelqu'un pour poser la déduplication.",
    application: "Index unique sur l'identifiant opérateur et insertion sans conflit : je peux l'écrire avec ses tests.",
  },
  {
    project: "ciDockerWatchdog",
    owner: "lynaBouzid",
    day: 66,
    title: "Exposer les métriques en Prometheus",
    description: "Le watchdog détecte les conteneurs saturés, il faut maintenant exporter ce qu'il voit.",
    application: "Je peux ajouter une route /metrics avec les compteurs principaux et un exemple de tableau de bord.",
  },
  {
    project: "ciDockerWatchdog",
    owner: "lynaBouzid",
    day: 58,
    title: "Tests d'intégration avec un vrai Docker",
    description: "Les tests simulent Docker et ratent des cas réels. Cherche de l'aide pour des tests de bout en bout.",
    application: "J'ai déjà monté ce genre de tests en CI avec un démon Docker éphémère, je peux m'en occuper.",
  },
  {
    project: "offliBank",
    owner: "eboQuansah",
    day: 50,
    title: "API de synchronisation côté serveur",
    description: "L'application mobile garde une file d'opérations hors ligne, il manque l'API qui les reçoit.",
    application: "Je peux écrire la route qui accepte les lots d'opérations et renvoie les conflits un par un.",
  },
  {
    project: "offliBank",
    owner: "eboQuansah",
    day: 44,
    title: "Résolution des conflits par horodatage serveur",
    description: "Deux appareils modifient le même compte hors ligne. Il faut une règle claire et testée.",
    application: "Horodatage serveur et version par ligne : je propose une implémentation avec des tests de concurrence.",
  },
  {
    project: "darijaNlpToolkit",
    owner: "ghizlaneAmrani",
    day: 34,
    title: "API d'inférence pour le modèle",
    description: "Le modèle tourne en notebook, il faut une petite API pour que d'autres puissent l'essayer.",
    application: "Je peux exposer le modèle derrière une route Fastify avec une file pour les requêtes longues.",
  },
  {
    project: "kemetDesignKit",
    owner: "dapoOyelaran",
    day: 29,
    title: "Documentation des composants de formulaire",
    description: "Les composants existent, il manque des exemples d'usage avec validation côté serveur.",
    application: "J'écris les exemples avec des schémas Zod partagés entre le formulaire et l'API.",
  },
  {
    project: "dataPulse",
    owner: "kgomotsoMahlangu",
    day: 24,
    title: "Partitionner la table des événements",
    description: "La table des événements dépasse 50 millions de lignes, les requêtes par mois ralentissent.",
    application: "Partitionnement par mois avec PostgreSQL natif, je peux préparer la migration sans coupure.",
  },
  {
    project: "dataPulse",
    owner: "kgomotsoMahlangu",
    day: 20,
    title: "Alertes quand un pipeline s'arrête",
    description: "Un pipeline peut s'arrêter sans erreur visible. Cherche une alerte simple sur l'absence de données.",
    application: "Une vérification planifiée sur la date du dernier événement reçu suffit, je la branche sur vos alertes.",
  },
  {
    project: "saharaRun",
    owner: "ahouKouadio",
    day: 18,
    title: "Classement en ligne",
    description: "Le jeu a besoin d'un classement des meilleurs temps, résistant aux scores falsifiés.",
    application: "Je peux faire l'API du classement avec une vérification côté serveur des temps envoyés.",
  },
  {
    project: "pesaRail",
    owner: "kipronoLangat",
    day: 16,
    title: "Documentation de l'API pour les commerçants",
    description: "Les premiers commerçants arrivent, il faut une documentation de l'API claire et à jour.",
    application: "Je génère la documentation depuis les schémas de validation pour qu'elle ne dérive jamais du code.",
  },
];

interface TestedPost {
  body: string;
  testUrl: string;
  testAsk: string;
  feedback: string;
}

const TESTED_POSTS: TestedPost[] = [
  {
    body: "J'ai écrit un petit outil qui génère des données de test réalistes pour des transactions mobile money.",
    testUrl: "https://fake-momo.demo.kemetlabs.dev",
    testAsk: "Est-ce que les montants et les horaires vous semblent crédibles ?",
    feedback: "Crédibles, oui. Il manque les pics de fin de mois et les échecs pour solde insuffisant, très fréquents dans les vraies données.",
  },
  {
    body: "Première version de mon API de prise de rendez-vous pour cliniques, testable sans compte.",
    testUrl: "https://rdv-clinique.demo.kemetlabs.dev",
    testAsk: "Essayez de réserver deux fois le même créneau.",
    feedback: "J'ai obtenu deux réservations sur le même créneau en lançant deux requêtes en même temps. Une contrainte d'unicité en base réglerait ça.",
  },
  {
    body: "Je publie un client Node pour l'API d'un opérateur de paiement, avec reprise automatique.",
    testUrl: "https://momo-client.demo.kemetlabs.dev",
    testAsk: "La reprise après erreur réseau vous paraît sûre ?",
    feedback: "La reprise rejoue aussi les paiements, pas seulement les lectures. Sans clé d'idempotence, c'est un double débit possible.",
  },
  {
    body: "Tableau de bord de suivi de colis pour livreurs à moto, pensé pour des connexions lentes.",
    testUrl: "https://colis-moto.demo.kemetlabs.dev",
    testAsk: "Combien de temps met la page à s'afficher chez vous ?",
    feedback: "Quatre secondes en 3G simulée. La liste charge tous les colis d'un coup : une pagination et des réponses compressées le ramèneraient sous la seconde.",
  },
  {
    body: "J'ai ouvert l'inscription de mon application de tontine en ligne.",
    testUrl: "https://tontine.demo.kemetlabs.dev",
    testAsk: "Le parcours d'inscription est-il clair ?",
    feedback: "Clair. En revanche, le lien de réinitialisation du mot de passe reste valable après usage : il devrait expirer dès qu'il a servi.",
  },
  {
    body: "Petit service qui convertit des factures PDF en données structurées.",
    testUrl: "https://factures.demo.kemetlabs.dev",
    testAsk: "Essayez avec vos propres factures.",
    feedback: "Bons résultats sur trois factures. Un PDF de 40 Mo fait tomber le service : posez une taille maximale et traitez les gros fichiers dans une file.",
  },
  {
    body: "API publique des horaires de bus de Dakar Dem Dikk, reconstruite à partir des données ouvertes.",
    testUrl: "https://horaires-ddd.demo.kemetlabs.dev",
    testAsk: "Le format des réponses vous convient ?",
    feedback: "Le format est bon. Les heures sont renvoyées sans fuseau : de l'ISO 8601 avec le décalage éviterait les erreurs côté client.",
  },
  {
    body: "Je teste un bot qui répond aux questions fréquentes d'une boutique en ligne sur WhatsApp.",
    testUrl: "https://boutique-bot.demo.kemetlabs.dev",
    testAsk: "Arrivez-vous à lui faire dire n'importe quoi ?",
    feedback: "Oui, en lui demandant d'ignorer ses consignes il a donné un code promo interne. Le contenu de la conversation doit rester une donnée, jamais une instruction.",
  },
];

function remainingDays(taken: Set<number>): number[] {
  const days: number[] = [];
  for (let day = FIRST_DAY; day <= LAST_DAY; day += 1) if (!taken.has(day)) days.push(day);
  return days;
}

function atHour(day: number, hour: number): Date {
  const date = daysAgo(day);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

export async function createMentoringHistory(
  db: DbOrTx,
  ids: DemoAccountIds,
  projectIds: DemoProjectIds,
  fillerProfileIds: string[],
): Promise<void> {
  const helpDays = new Set(PROJECT_HELP.map((help) => help.day));
  const freeDays = remainingDays(helpDays);
  if (freeDays.length < ANSWERED_QUESTIONS.length + TESTED_POSTS.length) {
    throw new Error("Pas assez de jours distincts pour dater l'historique d'entraide.");
  }
  const askers = seededShuffle(fillerProfileIds, "mentoring-askers").slice(0, ANSWERED_QUESTIONS.length + TESTED_POSTS.length);

  for (const [index, item] of ANSWERED_QUESTIONS.entries()) {
    const day = freeDays[index]!;
    const [question] = await db
      .insert(posts)
      .values({ authorId: askers[index]!, format: "question", body: item.question, createdAt: atHour(day, 8) })
      .returning({ id: posts.id });
    await db.insert(postReplies).values({
      postId: question!.id,
      authorId: ids.coumbaThiam,
      body: item.answer,
      isSolution: true,
      createdAt: atHour(day, 11),
    });
  }

  for (const [index, item] of TESTED_POSTS.entries()) {
    const day = freeDays[ANSWERED_QUESTIONS.length + index]!;
    const [testedPost] = await db
      .insert(posts)
      .values({
        authorId: askers[ANSWERED_QUESTIONS.length + index]!,
        format: "a_tester",
        body: item.body,
        testUrl: item.testUrl,
        testAsk: item.testAsk,
        createdAt: atHour(day, 9),
      })
      .returning({ id: posts.id });
    await db.insert(postFeedback).values({
      postId: testedPost!.id,
      authorId: ids.coumbaThiam,
      body: item.feedback,
      createdAt: atHour(day, 15),
    });
  }

  for (const help of PROJECT_HELP) {
    const [helpRequest] = await db
      .insert(helpRequests)
      .values({
        projectId: projectIds[help.project],
        authorId: ids[help.owner],
        kind: "help",
        title: help.title,
        description: help.description,
        stack: [],
        status: "closed",
        createdAt: atHour(help.day + 2, 9),
        closedAt: atHour(help.day, 16),
      })
      .returning({ id: helpRequests.id });
    await db.insert(applications).values({
      helpRequestId: helpRequest!.id,
      applicantId: ids.coumbaThiam,
      message: help.application,
      status: "accepted",
      createdAt: atHour(help.day + 1, 10),
      decidedAt: atHour(help.day, 16),
    });
  }
}
