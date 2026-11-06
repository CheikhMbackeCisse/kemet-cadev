import type { DbOrTx } from "../client.js";
import { skills } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";

export async function createDemoSkills(db: DbOrTx, ids: DemoAccountIds): Promise<void> {
  await db.insert(skills).values([
    {
      authorId: ids.coumbaThiam,
      slug: "wave-paiements",
      name: "wave-paiements",
      description: "Intégrer les paiements Wave dans une API Node.js : webhooks, statuts, remboursements.",
      content:
        "Utiliser ce skill pour toute question sur l'intégration de Wave (paiement mobile) côté serveur.\n\n" +
        "Points clés :\n" +
        "- Les webhooks Wave arrivent sans garantie d'ordre : toujours vérifier le statut actuel de la " +
        "transaction via l'API avant de considérer un paiement comme confirmé.\n" +
        "- Un remboursement partiel n'existe pas côté Wave : il faut rembourser en totalité puis relancer " +
        "un paiement pour la part restante.\n" +
        "- Toujours vérifier la signature du webhook avant de traiter son contenu.\n\n" +
        "Exemple de vérification de signature :\n" +
        "```ts\n" +
        "const expected = createHmac('sha256', secret).update(rawBody).digest('hex');\n" +
        "if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))) {\n" +
        "  throw new Error('signature invalide');\n" +
        "}\n" +
        "```",
      tags: ["wave", "paiement", "mobile money", "webhook"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.lynaBouzid,
      slug: "ci-docker-fiable",
      name: "ci-docker-fiable",
      description: "Rendre une CI GitHub Actions stable quand elle construit et démarre des images Docker.",
      content:
        "Utiliser ce skill pour une CI qui construit des images Docker et les fait démarrer pour des tests " +
        "d'intégration ou end-to-end.\n\n" +
        "Points clés :\n" +
        "- Toujours attendre un healthcheck explicite avant de lancer les tests, jamais un délai fixe : " +
        "le temps de démarrage varie selon la charge du runner.\n" +
        "- Mettre en cache les couches Docker entre les exécutions (buildx avec un cache GitHub Actions) " +
        "réduit le temps de CI de plusieurs minutes.\n" +
        "- Un service qui dépasse la mémoire allouée au runner échoue silencieusement : surveiller la " +
        "mémoire de chaque conteneur, pas seulement les journaux applicatifs.",
      tags: ["ci", "docker", "github actions", "tests"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.eboQuansah,
      slug: "flutter-sync-hors-ligne",
      name: "flutter-sync-hors-ligne",
      description: "Synchroniser un cache Flutter hors-ligne sans perdre d'écritures en cas de conflit.",
      content:
        "Utiliser ce skill pour une application Flutter qui doit fonctionner hors-ligne puis se resynchroniser.\n\n" +
        "Points clés :\n" +
        "- Résoudre les conflits d'écriture par horodatage serveur, jamais par horodatage client : l'horloge " +
        "d'un téléphone dérive, surtout après une longue période hors-ligne.\n" +
        "- Stocker une file d'opérations plutôt qu'un état final : rejouer la file à la reconnexion plutôt que " +
        "d'écraser l'état distant, pour pouvoir fusionner au lieu de perdre une écriture.\n" +
        "- Marquer chaque enregistrement local d'un statut `pending` / `synced` / `conflict` explicite : un " +
        "écran qui ne distingue pas ces trois états finit par cacher des pertes de données à l'utilisateur.",
      tags: ["flutter", "offline-first", "synchronisation", "mobile"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.dapoOyelaran,
      slug: "design-system-theme-sombre",
      name: "design-system-theme-sombre",
      description: "Ajouter un thème sombre à un design system React sans tout réécrire.",
      content:
        "Utiliser ce skill avant d'ajouter un thème (clair/sombre ou une marque blanche) à une interface React " +
        "existante.\n\n" +
        "Points clés :\n" +
        "- Ne jamais coder une couleur en dur dans un composant : toujours une variable CSS définie une fois " +
        "sur `:root` et redéfinie par thème.\n" +
        "- Tester le contraste des deux thèmes séparément, pas seulement le thème par défaut : une couleur " +
        "suffisamment contrastée en clair ne l'est pas forcément en sombre.\n" +
        "- Un composant qui lit `window.matchMedia` directement casse le choix manuel de thème de l'utilisateur : " +
        "centraliser la détection dans un seul endroit et exposer un contexte React.",
      tags: ["react", "design system", "thème", "accessibilité"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.kgomotsoMahlangu,
      slug: "airflow-workers-oom",
      name: "airflow-workers-oom",
      description: "Détecter un worker Airflow qui sature en mémoire avant que la DAG plante sans message clair.",
      content:
        "Utiliser ce skill quand des tâches Airflow échouent de façon intermittente sans erreur applicative claire.\n\n" +
        "Points clés :\n" +
        "- Surveiller la mémoire de chaque worker, pas seulement les logs de tâche : un worker qui sature (OOM) " +
        "est souvent tué par le système avant d'avoir pu écrire une erreur exploitable.\n" +
        "- Poser des limites de mémoire explicites par tâche (`requests`/`limits` côté Kubernetes) force " +
        "l'erreur à devenir visible et attribuable plutôt que de dégrader tout le cluster.\n" +
        "- Fractionner une tâche qui traite un gros volume en plusieurs tâches plus petites réduit le pic de " +
        "mémoire et limite le travail à rejouer en cas d'échec.",
      tags: ["airflow", "data engineering", "kubernetes", "observabilité"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.kipronoLangat,
      slug: "paiement-mobile-idempotence",
      name: "paiement-mobile-idempotence",
      description: "Rendre une API de paiement mobile idempotente face aux retransmissions réseau.",
      content:
        "Utiliser ce skill pour toute API qui déclenche un mouvement d'argent (paiement, transfert, remboursement).\n\n" +
        "Points clés :\n" +
        "- Exiger une clé d'idempotence fournie par le client sur chaque requête de paiement : un réseau mobile " +
        "qui retransmet une requête ne doit jamais déclencher un second mouvement d'argent.\n" +
        "- Ne jamais considérer un paiement confirmé sur la seule réception d'un webhook : revérifier le statut " +
        "via l'API avant de créditer un compte, les webhooks peuvent être rejoués ou arriver en double.\n" +
        "- Logguer chaque transition d'état avec son déclencheur : en cas de litige sur un paiement, c'est la " +
        "seule preuve exploitable.",
      tags: ["paiement mobile", "idempotence", "architecture", "fiabilité"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.ghizlaneAmrani,
      slug: "nlp-bas-ressource-arabe",
      name: "nlp-bas-ressource-arabe",
      description: "Entraîner un modèle NLP correct en arabe dialectal malgré le peu de corpus annotés.",
      content:
        "Utiliser ce skill pour un projet de traitement du langage naturel sur une langue ou un dialecte peu " +
        "couvert par les corpus publics.\n\n" +
        "Points clés :\n" +
        "- Partir d'un modèle multilingue pré-entraîné (plutôt que d'entraîner from scratch) et l'affiner sur le " +
        "peu de données disponibles : le transfert depuis l'arabe standard reste meilleur que rien.\n" +
        "- La translittération et le mélange de scripts (arabe/latin) dans les messages réels cassent beaucoup " +
        "de tokenizers standards : prévoir une étape de normalisation avant l'entraînement.\n" +
        "- Évaluer séparément par dialecte plutôt qu'avec un score global : un score moyen flatteur cache " +
        "souvent un dialecte entier mal couvert.",
      tags: ["nlp", "arabe", "bas-ressource", "machine learning"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.heritierKabeya,
      slug: "firmware-autonomie-batterie",
      name: "firmware-autonomie-batterie",
      description: "Arbitrer entre fréquence de mesure et autonomie batterie sur un capteur connecté isolé.",
      content:
        "Utiliser ce skill pour un firmware embarqué alimenté par pile, sans accès facile au rechargement.\n\n" +
        "Points clés :\n" +
        "- La vraie contrainte est quasiment toujours l'autonomie batterie, pas la puissance de calcul : " +
        "optimiser le temps passé hors veille avant d'optimiser le code lui-même.\n" +
        "- Réduire la fréquence de mesure avant de réduire la précision d'une mesure individuelle : une mesure " +
        "moins fréquente mais fiable vaut mieux qu'une mesure fréquente mais bruitée.\n" +
        "- Grouper les transmissions radio plutôt que d'envoyer à chaque mesure : l'émission radio domine très " +
        "largement la consommation sur ce type de matériel.",
      tags: ["firmware", "iot", "autonomie", "capteurs"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.ahouKouadio,
      slug: "frame-pacing-android-bas-de-gamme",
      name: "frame-pacing-android-bas-de-gamme",
      description: "Garder un jeu Unity fluide sur Android bas de gamme sans sacrifier la résolution en premier.",
      content:
        "Utiliser ce skill pour un jeu mobile qui doit rester jouable sur du matériel Android d'entrée de gamme.\n\n" +
        "Points clés :\n" +
        "- Viser un budget de frame fixe et dégrader la qualité des particules et des effets avant de toucher " +
        "à la résolution : le joueur pardonne moins un flou soudain qu'un ralentissement ponctuel.\n" +
        "- Profiler sur un vrai appareil bas de gamme, jamais seulement sur l'émulateur : l'émulateur masque " +
        "presque toujours les limites thermiques réelles du matériel.\n" +
        "- Précharger les assets lourds pendant les transitions plutôt qu'au moment où ils apparaissent à " +
        "l'écran : un freeze au mauvais moment coûte plus cher en perception qu'un chargement un peu plus long.",
      tags: ["unity", "jeux vidéo", "performance", "mobile"],
      visibility: "public",
      isDemo: true,
    },
    {
      authorId: ids.skanderJaziri,
      slug: "ux-reseau-instable",
      name: "ux-reseau-instable",
      description: "Concevoir une application web qui reste utilisable sur une connexion mobile instable.",
      content:
        "Utiliser ce skill pour une application destinée à des utilisateurs sur des connexions mobiles peu " +
        "fiables (coupures fréquentes, latence élevée).\n\n" +
        "Points clés :\n" +
        "- Chaque requête doit assumer qu'elle peut échouer à mi-chemin : une action critique (paiement, envoi) " +
        "a besoin d'une clé idempotente, pas seulement d'un indicateur de chargement.\n" +
        "- Mettre en file d'attente les actions de l'utilisateur plutôt que de les bloquer pendant une coupure : " +
        "un formulaire qui refuse toute saisie hors-ligne frustre plus qu'il ne protège.\n" +
        "- Afficher clairement l'état de connexion plutôt que de le cacher : un utilisateur qui sait qu'il est " +
        "hors-ligne comprend pourquoi une action est en attente.",
      tags: ["ux", "offline-first", "mobile", "fiabilité"],
      visibility: "public",
      isDemo: true,
    },
  ]);
}
