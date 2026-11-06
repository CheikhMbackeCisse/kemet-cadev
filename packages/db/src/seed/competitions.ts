import type { DbOrTx } from "../client.js";
import { competitions, juryScores, submissions, teamMembers, teams, votes } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { chunk } from "./chunk.js";
import { EXAMPLE_COMPETITION_NOTE } from "./fun-competitions.js";
import type { DemoProjectIds } from "./projects.js";
import { seededShuffle } from "./filler-profiles.js";
import { daysAgo, daysFromNow } from "./time.js";

const EXAMPLE_PREFIX = `${EXAMPLE_COMPETITION_NOTE}\n\n`;

const VOTE_CHUNK_SIZE = 5000;

export async function createDemoCompetitions(
  db: DbOrTx,
  ids: DemoAccountIds,
  projectIds: DemoProjectIds,
  fillerProfileIds: string[],
): Promise<void> {
  // Compétition encore ouverte aux inscriptions : deux équipes se sont
  // déjà formées, aucune n'a encore soumis (la soumission n'ouvre qu'à la
  // clôture des inscriptions).
  const [hackathon] = await db
    .insert(competitions)
    .values({
      createdBy: ids.lynaBouzid,
      reviewedBy: ids.coumbaThiam,
      status: "published",
      slug: "hackathon-paiements-resilients",
      name: "Hackathon Paiements Résilients",
      pitch: "48 heures pour concevoir un système de paiement qui survit à une connexion instable.",
      description:
        EXAMPLE_PREFIX +
        "Les équipes conçoivent un flux de paiement qui reste correct face aux coupures réseau, aux " +
        "retransmissions et aux doubles clics. Le jury évalue la résilience autant que l'interface.",
      registrationClosesAt: daysFromNow(10),
      submissionClosesAt: daysFromNow(17),
      votingClosesAt: daysFromNow(24),
      createdAt: daysAgo(5),
    })
    .returning({ id: competitions.id });
  const hackathonId = hackathon!.id;

  const [waveGuard, kemetPay] = await db
    .insert(teams)
    .values([
      { competitionId: hackathonId, captainId: ids.lynaBouzid, name: "WaveGuard" },
      { competitionId: hackathonId, captainId: ids.heritierKabeya, name: "KemetPay" },
    ])
    .returning({ id: teams.id });

  await db.insert(teamMembers).values([
    { teamId: waveGuard!.id, competitionId: hackathonId, profileId: ids.lynaBouzid },
    { teamId: kemetPay!.id, competitionId: hackathonId, profileId: ids.heritierKabeya },
  ]);

  // Compétition en phase de vote : inscriptions et soumissions closes, le
  // public tranche encore entre les deux projets.
  const [aiChallenge] = await db
    .insert(competitions)
    .values({
      createdBy: ids.ghizlaneAmrani,
      reviewedBy: ids.coumbaThiam,
      status: "published",
      slug: "defi-ia-afrique",
      name: "Défi IA Afrique",
      pitch: "Des projets d'intelligence artificielle pensés pour des usages africains concrets.",
      description:
        EXAMPLE_PREFIX +
        "De la recommandation en langues locales à la détection d'anomalies sur des pipelines de données : " +
        "le jury et le public votent pour le projet qui répond le mieux à un vrai besoin du continent.\n\n" +
        "Chaque soumission documente comment lancer son évaluation en une commande, par exemple :\n\n" +
        "```bash\n" +
        "python -m evaluate --dataset data/test.jsonl --report report.md\n" +
        "```",
      registrationClosesAt: daysAgo(20),
      submissionClosesAt: daysAgo(10),
      votingClosesAt: daysFromNow(4),
      createdAt: daysAgo(35),
    })
    .returning({ id: competitions.id });
  const aiChallengeId = aiChallenge!.id;

  const [recoWave, dataGuard] = await db
    .insert(teams)
    .values([
      { competitionId: aiChallengeId, captainId: ids.ghizlaneAmrani, name: "RecoWave" },
      { competitionId: aiChallengeId, captainId: ids.kgomotsoMahlangu, name: "DataGuard" },
    ])
    .returning({ id: teams.id });

  await db.insert(teamMembers).values([
    { teamId: recoWave!.id, competitionId: aiChallengeId, profileId: ids.ghizlaneAmrani },
    { teamId: recoWave!.id, competitionId: aiChallengeId, profileId: ids.coumbaThiam },
    { teamId: dataGuard!.id, competitionId: aiChallengeId, profileId: ids.kgomotsoMahlangu },
    { teamId: dataGuard!.id, competitionId: aiChallengeId, profileId: ids.lynaBouzid },
  ]);

  const [recoWaveSubmission, dataGuardSubmission] = await db
    .insert(submissions)
    .values([
      {
        teamId: recoWave!.id,
        competitionId: aiChallengeId,
        projectId: projectIds.darijaNlpToolkit,
        authorId: ids.ghizlaneAmrani,
        title: "Darija NLP Toolkit",
        pitch: "Évaluer un modèle de recommandation en arabe dialectal dialecte par dialecte, pas en moyenne.",
        description:
          "Normalisation du mélange arabe/latin, transfert depuis un modèle multilingue pré-entraîné, " +
          "évaluation séparée par dialecte pour ne pas masquer une couverture faible.",
        repoUrl: "https://code.demo.kemetlabs.dev/ghizlane-amrani/darija-nlp-toolkit",
        demoUrl: null,
        createdAt: daysAgo(12),
      },
      {
        teamId: dataGuard!.id,
        competitionId: aiChallengeId,
        projectId: projectIds.dataPulse,
        authorId: ids.kgomotsoMahlangu,
        title: "DataPulse",
        pitch: "Détecter les anomalies mémoire d'un pipeline Airflow avant qu'une tâche échoue sans message clair.",
        description:
          "Remplace des seuils fixes par un modèle de détection d'anomalies pour réduire les faux positifs.\n\n" +
          "```python\n" +
          "from sklearn.ensemble import IsolationForest\n\n" +
          "features = memory_by_task[[\"rss_mb\", \"duration_s\"]]\n" +
          "model = IsolationForest(contamination=0.01, random_state=0).fit(features)\n" +
          "anomalies = memory_by_task[model.predict(features) == -1]\n" +
          "```",
        repoUrl: "https://code.demo.kemetlabs.dev/kgomotso-mahlangu/datapulse",
        demoUrl: null,
        createdAt: daysAgo(11),
      },
    ])
    .returning({ id: submissions.id });

  // Compétition close, résultats définitifs : trois équipes, vote public à
  // l'échelle de la communauté et notation du jury, réservée aux niveaux
  // Architecte et Légende (Coumba Thiam, voir mentoring.ts).
  const [miniChallenge] = await db
    .insert(competitions)
    .values({
      createdBy: ids.coumbaThiam,
      reviewedBy: ids.coumbaThiam,
      status: "published",
      slug: "cadev-mini-defi-produit",
      name: "CADEV Mini-Défi Produit",
      pitch: "Un mini-défi CADEV pour préparer la grande compétition : un produit fini en une semaine.",
      description:
        EXAMPLE_PREFIX +
        "Trois équipes, un produit, une semaine. Le jury note la qualité d'exécution, le public vote pour son préféré.",
      registrationClosesAt: daysAgo(60),
      submissionClosesAt: daysAgo(50),
      votingClosesAt: daysAgo(40),
      createdAt: daysAgo(75),
    })
    .returning({ id: competitions.id });
  const miniChallengeId = miniChallenge!.id;

  const [offliCrew, banlieueKit, saharaTeam] = await db
    .insert(teams)
    .values([
      { competitionId: miniChallengeId, captainId: ids.eboQuansah, name: "OffliCrew" },
      { competitionId: miniChallengeId, captainId: ids.dapoOyelaran, name: "BanlieueKit" },
      { competitionId: miniChallengeId, captainId: ids.ahouKouadio, name: "SaharaTeam" },
    ])
    .returning({ id: teams.id });

  await db.insert(teamMembers).values([
    { teamId: offliCrew!.id, competitionId: miniChallengeId, profileId: ids.eboQuansah },
    { teamId: offliCrew!.id, competitionId: miniChallengeId, profileId: ids.kipronoLangat },
    { teamId: banlieueKit!.id, competitionId: miniChallengeId, profileId: ids.dapoOyelaran },
    { teamId: banlieueKit!.id, competitionId: miniChallengeId, profileId: ids.skanderJaziri },
    { teamId: saharaTeam!.id, competitionId: miniChallengeId, profileId: ids.ahouKouadio },
    { teamId: saharaTeam!.id, competitionId: miniChallengeId, profileId: ids.heritierKabeya },
  ]);

  const [offliCrewSubmission, banlieueKitSubmission, saharaTeamSubmission] = await db
    .insert(submissions)
    .values([
      {
        teamId: offliCrew!.id,
        competitionId: miniChallengeId,
        projectId: projectIds.offliBank,
        authorId: ids.eboQuansah,
        title: "OffliBank",
        pitch: "Une application bancaire pleinement utilisable sans connexion, conflits résolus par horodatage serveur.",
        description: "File d'opérations locale, statuts explicites pending/synced/conflict, resynchronisation progressive.",
        repoUrl: "https://code.demo.kemetlabs.dev/ebo-quansah/offlibank",
        demoUrl: null,
        createdAt: daysAgo(52),
      },
      {
        teamId: banlieueKit!.id,
        competitionId: miniChallengeId,
        projectId: projectIds.kemetDesignKit,
        authorId: ids.dapoOyelaran,
        title: "Kemet Design Kit",
        pitch: "Un design system React accessible pour construire une interface mobile soignée en quelques jours.",
        description: "Composants Radix UI, variables CSS pour le thème, pensé pour aller vite sans sacrifier l'accessibilité.",
        repoUrl: "https://code.demo.kemetlabs.dev/dapo-oyelaran/kemet-design-kit",
        demoUrl: "https://kemet-design-kit.demo.kemetlabs.dev",
        createdAt: daysAgo(51),
      },
      {
        teamId: saharaTeam!.id,
        competitionId: miniChallengeId,
        projectId: projectIds.saharaRun,
        authorId: ids.ahouKouadio,
        title: "SaharaRoad",
        pitch: "Un jeu de course mobile fluide même sur de l'Android bas de gamme.",
        description: "Budget de frame fixe, dégradation progressive des particules, préchargement pendant les transitions.",
        repoUrl: "https://code.demo.kemetlabs.dev/ahou-kouadio/sahararoad",
        demoUrl: "https://sahararoad.demo.kemetlabs.dev",
        createdAt: daysAgo(50),
      },
    ])
    .returning({ id: submissions.id });

  await db.insert(juryScores).values([
    {
      competitionId: miniChallengeId,
      submissionId: offliCrewSubmission!.id,
      jurorId: ids.coumbaThiam,
      score: 17,
      comment: "Gestion des conflits convaincante, l'interface reste perfectible.",
      createdAt: daysAgo(41),
    },
    {
      competitionId: miniChallengeId,
      submissionId: banlieueKitSubmission!.id,
      jurorId: ids.coumbaThiam,
      score: 15,
      comment: "Composants propres et bien documentés, l'accessibilité au clavier n'est pas encore complète.",
      createdAt: daysAgo(41),
    },
    {
      competitionId: miniChallengeId,
      submissionId: saharaTeamSubmission!.id,
      jurorId: ids.coumbaThiam,
      score: 18,
      comment: "La fluidité sur matériel bas de gamme est nettement au-dessus du reste du lot.",
      createdAt: daysAgo(41),
    },
  ]);

  await castBulkVotes(db, aiChallengeId, [
    { submissionId: recoWaveSubmission!.id, count: 1380 },
    { submissionId: dataGuardSubmission!.id, count: 1020 },
  ], fillerProfileIds, "ai-challenge-votes");

  await castBulkVotes(db, miniChallengeId, [
    { submissionId: offliCrewSubmission!.id, count: 1450 },
    { submissionId: banlieueKitSubmission!.id, count: 980 },
    { submissionId: saharaTeamSubmission!.id, count: 770 },
  ], fillerProfileIds, "mini-challenge-votes");
}

async function castBulkVotes(
  db: DbOrTx,
  competitionId: string,
  allocations: { submissionId: string; count: number }[],
  fillerProfileIds: string[],
  shuffleSeed: string,
): Promise<void> {
  const totalVotes = allocations.reduce((sum, allocation) => sum + allocation.count, 0);
  const voters = seededShuffle(fillerProfileIds, shuffleSeed).slice(0, totalVotes);

  const rows: { competitionId: string; submissionId: string; voterId: string }[] = [];
  let cursor = 0;
  for (const allocation of allocations) {
    for (let i = 0; i < allocation.count; i += 1) {
      rows.push({ competitionId, submissionId: allocation.submissionId, voterId: voters[cursor]! });
      cursor += 1;
    }
  }

  for (const batch of chunk(rows, VOTE_CHUNK_SIZE)) {
    await db.insert(votes).values(batch);
  }
}
