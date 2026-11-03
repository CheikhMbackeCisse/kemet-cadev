import { eq } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import {
  postAttachments,
  postFeedback,
  postReactions,
  postReplies,
  posts,
} from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { writeSeedPostImage } from "./post-image.js";
import { hoursAgo } from "./time.js";

// Les trois formats de post, des réponses dont une solution, des "Utile" et des partages.
export async function createFeedContent(db: DbOrTx, ids: DemoAccountIds): Promise<void> {
  const [
    fastifyPoolPost,
    flutterSyncQuestion,
    dockerCiTestPost,
    designSystemPost,
    airflowQuestion,
    fullStackPost,
    framePacingPost,
    walletSettlementPost,
    arabicNlpTestPost,
    firmwareBatteryQuestion,
    ,
    ,
    ,
    demoScreenshotPost,
  ] = await db
    .insert(posts)
    .values([
      {
        authorId: ids.aminaDiallo,
        format: "astuce",
        body:
          "Astuce Fastify + PostgreSQL : une seule instance de pool de connexions partagée entre toutes les routes, " +
          "jamais un pool par requête. Ça paraît évident mais c'est la cause la plus fréquente des 'too many clients' " +
          "qu'on voit sur les API qui montent en charge.\n\n" +
          "```typescript\n" +
          "const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });\n\n" +
          "app.decorate(\"db\", pool);\n" +
          "app.addHook(\"onClose\", async () => pool.end());\n" +
          "```",
        createdAt: hoursAgo(120),
      },
      {
        authorId: ids.kwameAsante,
        format: "question",
        body:
          "Quelqu'un a un pattern fiable pour la synchronisation hors-ligne sur Flutter ? Mon cache local part en " +
          "vrille dès qu'il y a un conflit d'écriture entre deux appareils du même utilisateur.",
        createdAt: hoursAgo(110),
      },
      {
        authorId: ids.fatimaBenali,
        format: "a_tester",
        body:
          "J'ai écrit un petit outil qui détecte les builds Docker qui vont timeout sur un runner GitHub Actions " +
          "avant qu'ils cassent toute la pipeline, en surveillant la mémoire des conteneurs pendant le build. " +
          "Qui veut le tester sur sa propre CI ?",
        testUrl: "https://github.com/fatima-benali/ci-docker-watchdog",
        testAsk:
          "Dites-moi s'il détecte vos faux timeouts sans faux positifs sur vos jobs les plus lourds.",
        createdAt: hoursAgo(95),
      },
      {
        authorId: ids.chidiOkafor,
        format: "astuce",
        body:
          "Pour un design system React avec thème clair/sombre fiable : ne jamais coder une couleur en dur dans un " +
          "composant, toujours une variable CSS. Le jour où le thème sombre arrive trois mois plus tard, c'est une " +
          "ligne à changer au lieu d'un audit complet.",
        createdAt: hoursAgo(80),
      },
      {
        authorId: ids.zaneleMokoena,
        format: "question",
        body:
          "Mes DAG Airflow plantent sans message clair depuis la semaine dernière. J'ai fini par comprendre que " +
          "c'est un worker qui sature en mémoire. Quelqu'un a une bonne pratique pour surveiller ça avant que " +
          "ça casse en prod plutôt qu'après ?",
        createdAt: hoursAgo(70),
      },
      {
        authorId: ids.yassineTrabelsi,
        body:
          "Cinq ans à faire du full-stack Node.js et Vue sur des projets e-commerce ouest-africains : la vraie " +
          "difficulté n'a jamais été le code, c'est la connexion instable des utilisateurs. Toute l'app doit " +
          "assumer qu'une requête peut échouer à mi-chemin.",
        createdAt: hoursAgo(60),
      },
      {
        authorId: ids.aissatouToure,
        format: "astuce",
        body:
          "Pour le frame pacing sur Unity en Android bas de gamme : viser un budget de frame fixe et dégrader la " +
          "qualité des particules avant de toucher à la résolution. Le joueur pardonne moins un flou soudain qu'un " +
          "ralentissement ponctuel.",
        createdAt: hoursAgo(45),
      },
      {
        authorId: ids.samuelMwangi,
        format: "astuce",
        body:
          "Sur un système de paiement mobile, résoudre les conflits d'écriture par horodatage serveur, jamais par " +
          "horodatage client : l'horloge d'un téléphone n'est jamais fiable à cent pour cent, surtout hors ligne.",
        createdAt: hoursAgo(40),
      },
      {
        authorId: ids.nadiaHassan,
        format: "a_tester",
        body:
          "Premier prototype d'un modèle de recommandation en arabe dialectal, entraîné sur très peu de données " +
          "annotées. Les résultats sont encore inégaux selon le dialecte. Je cherche des retours sur l'arabe du " +
          "Maghreb en particulier.",
        testUrl: "https://huggingface.co/nadia-hassan/darija-rec-proto",
        testAsk:
          "Testez avec des phrases dans votre dialecte et dites-moi où ça part n'importe où.",
        createdAt: hoursAgo(20),
      },
      {
        authorId: ids.jeanMarcMukendi,
        format: "question",
        body:
          "Firmware pour capteurs agricoles en zone rurale : je dois choisir entre mesurer plus souvent ou faire " +
          "durer la batterie plus d'un an sur une seule pile. Quelqu'un a déjà dû trancher ce genre de compromis " +
          "sur du matériel qu'on ne peut pas aller recharger facilement ?",
        createdAt: hoursAgo(8),
      },
      // Le fil est aussi un lieu de bonne humeur, pas seulement de technique.
      {
        authorId: ids.kwameAsante,
        body:
          "Trois heures sur un bug impossible. C'était une virgule. Une seule. Si vous galérez ce soir, " +
          "sachez que vous n'êtes pas seuls et que ce n'est probablement pas votre faute non plus.",
        createdAt: hoursAgo(34),
      },
      {
        authorId: ids.zaneleMokoena,
        format: "question",
        body:
          "Première semaine à mon premier poste de dev et j'ai l'impression de ne rien comprendre à la " +
          "base de code. C'est normal ou je devrais m'inquiéter ? Comment vous avez fait au début ?",
        createdAt: hoursAgo(28),
      },
      {
        authorId: ids.aissatouToure,
        body:
          "Merci à celles et ceux qui ont répondu à ma question sur le frame pacing la semaine dernière. " +
          "J'ai appliqué vos conseils, le jeu tourne enfin correctement sur l'entrée de gamme. " +
          "Cette communauté m'a fait gagner un mois.",
        createdAt: hoursAgo(26),
      },
      {
        authorId: ids.samuelMwangi,
        body:
          "On a enfin livré. Première capture de l'écran d'accueil, sur un vrai téléphone, avec de vraies " +
          "données. Six mois de travail. Je la partage ici parce que c'est ici qu'on m'a débloqué deux fois.",
        createdAt: hoursAgo(12),
      },
    ])
    .returning({ id: posts.id });

  await attachDemoImage(db, ids, demoScreenshotPost!.id);

  await db.insert(posts).values([
    {
      authorId: ids.chidiOkafor,
      sharedPostId: fastifyPoolPost!.id,
      body: "Ça va me servir directement sur notre API de paiement, on a eu exactement ce symptôme le mois dernier.",
      createdAt: hoursAgo(100),
    },
    {
      authorId: ids.kwameAsante,
      sharedPostId: arabicNlpTestPost!.id,
      body: "Pertinent même pour mon appli bancaire, qui doit gérer plusieurs langues et dialectes côté support client.",
      createdAt: hoursAgo(15),
    },
  ]);

  const [solutionReply] = await db
    .insert(postReplies)
    .values([
      {
        postId: flutterSyncQuestion!.id,
        authorId: ids.samuelMwangi,
        body:
          "On a eu le même souci côté paiement mobile : résoudre les conflits par horodatage serveur, jamais par " +
          "horodatage client, règle ça la plupart du temps.",
        createdAt: hoursAgo(108),
      },
    ])
    .returning({ id: postReplies.id });

  await db.insert(postReplies).values([
    {
      postId: flutterSyncQuestion!.id,
      authorId: ids.chidiOkafor,
      body: "Ça suppose que l'horloge serveur fait foi partout, donc attention si vous avez plusieurs régions avec des bases différentes.",
      createdAt: hoursAgo(105),
    },
    {
      postId: airflowQuestion!.id,
      authorId: ids.jeanMarcMukendi,
      body: "Même constat côté firmware : un composant qui sature silencieusement est pire qu'un qui plante bruyamment.",
      createdAt: hoursAgo(68),
    },
    {
      postId: airflowQuestion!.id,
      authorId: ids.fatimaBenali,
      body: "Poser des limites de mémoire explicites sur chaque worker (requests/limits côté Kubernetes) force l'erreur à devenir visible au lieu de se propager en silence.",
      createdAt: hoursAgo(65),
    },
    {
      postId: firmwareBatteryQuestion!.id,
      authorId: ids.aissatouToure,
      body: "Dans un jeu, on sacrifie d'abord les effets visuels pour tenir le budget. Vous pourriez sacrifier la précision de mesure plutôt que la fréquence, selon ce que vos agriculteurs tolèrent.",
      createdAt: hoursAgo(6),
    },
    {
      postId: firmwareBatteryQuestion!.id,
      authorId: ids.kwameAsante,
      body: "Sur mobile, le mode basse consommation réduit la fréquence des tâches de fond plutôt que de les couper : peut-être une piste, mesurer moins souvent la nuit par exemple.",
      createdAt: hoursAgo(5),
    },
  ]);

  await db
    .update(postReplies)
    .set({ isSolution: true })
    .where(eq(postReplies.id, solutionReply!.id));

  await db.insert(postReactions).values([
    { postId: fastifyPoolPost!.id, profileId: ids.kwameAsante },
    { postId: fastifyPoolPost!.id, profileId: ids.fatimaBenali },
    { postId: fastifyPoolPost!.id, profileId: ids.yassineTrabelsi },
    { postId: dockerCiTestPost!.id, profileId: ids.aminaDiallo },
    { postId: dockerCiTestPost!.id, profileId: ids.zaneleMokoena },
    { postId: designSystemPost!.id, profileId: ids.aminaDiallo },
    { postId: designSystemPost!.id, profileId: ids.nadiaHassan },
    { postId: flutterSyncQuestion!.id, profileId: ids.samuelMwangi },
    { postId: walletSettlementPost!.id, profileId: ids.aminaDiallo },
    { postId: walletSettlementPost!.id, profileId: ids.kwameAsante },
    { postId: arabicNlpTestPost!.id, profileId: ids.aminaDiallo },
    { postId: arabicNlpTestPost!.id, profileId: ids.chidiOkafor },
    { postId: framePacingPost!.id, profileId: ids.yassineTrabelsi },
    { postId: fullStackPost!.id, profileId: ids.fatimaBenali },
  ]);

  await db.insert(postFeedback).values([
    {
      postId: dockerCiTestPost!.id,
      authorId: ids.aminaDiallo,
      body: "Testé sur notre CI qui buildait 6 images : il a détecté le conteneur qui saturait avant le timeout, pas de faux positif sur les 5 autres.",
      createdAt: hoursAgo(90),
    },
    {
      postId: dockerCiTestPost!.id,
      authorId: ids.yassineTrabelsi,
      body: "Marche bien chez moi aussi, seul bémol : il faut lui donner le nom exact du service docker-compose, sinon il ignore le conteneur.",
      createdAt: hoursAgo(85),
    },
    {
      postId: arabicNlpTestPost!.id,
      authorId: ids.chidiOkafor,
      body: "Testé avec des phrases en arabe du Maghreb : correct sur le vocabulaire courant, perd pied sur l'argot très local.",
      createdAt: hoursAgo(12),
    },
    {
      postId: arabicNlpTestPost!.id,
      authorId: ids.kwameAsante,
      body: "Résultats solides sur des phrases courtes, plus incertain sur des messages longs avec plusieurs sujets.",
      createdAt: hoursAgo(10),
    },
  ]);
}

/**
 * Rattache une image de demonstration a un post. Le fichier est ecrit dans
 * `UPLOADS_DIR`, la meme racine que celle servie par la route
 * `GET /api/post-attachments/:id/content`.
 */
async function attachDemoImage(db: DbOrTx, ids: DemoAccountIds, postId: string): Promise<void> {
  const uploadsDir = process.env.UPLOADS_DIR;
  if (!uploadsDir) {
    console.warn("UPLOADS_DIR non definie : le post de demonstration reste sans image.");
    return;
  }

  const image = await writeSeedPostImage(uploadsDir, postId, "ecran-accueil.png");
  await db.insert(postAttachments).values({
    postId,
    authorId: ids.samuelMwangi,
    storageKey: image.storageKey,
    mimeType: image.mimeType,
    originalName: image.originalName,
    byteSize: image.byteSize,
  });
}
