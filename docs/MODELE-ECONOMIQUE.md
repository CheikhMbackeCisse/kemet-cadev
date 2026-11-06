# Modèle économique

Ce document développe la section "Business model" de `docs/CONTEXTE.md`. Il
décrit comment Kemet pourrait se financer après la compétition. **Aucun
paiement n'est branché** : la page Kemet Pro (`/pro`) le dit en bandeau et
son bouton reste désactivé. **Tous les chiffres ci-dessous sont des
hypothèses** à vérifier auprès de vrais utilisateurs ; aucune étude de
marché n'a été menée.

## Le principe

On récompense l'utilité, jamais les vues ni les abonnés. Payer à la vue
pousse aux posts racoleurs et à la fraude. Tout ce qui est payant s'appuie
donc sur ce que la plateforme mesure déjà : l'aide donnée (registre de
points, `docs/adr/0011-points-et-niveaux.md`), les skills utiles, les
travaux publiés et les compétitions.

Ce qui reste gratuit, pour toujours : lire, écrire, poser ses questions à
@kemet dans le quota de son niveau, publier, et la vérification du parcours.
Un compte vérifié ne s'achète pas.

## Les quatre sources de revenus

### 1. Kemet Pro (devs)

Abonnement à petit prix en FCFA, payé par Wave ou Orange Money.

| Avantage | Ce qui existe déjà dans le code |
| --- | --- |
| Plus de quota pour @kemet | Quota par niveau, compté à la lecture (`apps/server/src/ai/quota.ts` : 30, 60 ou 150 questions par jour) |
| Statistiques de profil | Registre de points et réponses jugées utiles, déjà stockés |
| Mise en avant dans l'annuaire | "Ouvert aux opportunités", réservé à partir du niveau Artisan |
| Espaces privés plus grands | Espaces privés et invitations |

Hypothèses à tester :

- **H1, prix** : entre 1 000 et 2 500 FCFA par mois. À fixer après des
  entretiens, pas avant.
- **H2, conversion** : une petite part des membres actifs paie. Le modèle
  ne doit pas en dépendre pour couvrir l'hébergement.
- **H3, coût de l'assistant** : aujourd'hui, la chaîne de secours tourne
  sur des offres gratuites (Gemini, Groq, OpenRouter,
  `docs/adr/0027-chaine-de-secours-ia.md`). Un quota payant plus large
  suppose une offre payante ou des modèles ouverts hébergés : c'est le
  premier coût qui grandit avec Kemet Pro.

### 2. Récompenses en crédits Datacloud (Systalink)

Les gagnants de compétitions, les auteurs des skills les plus utiles et les
meilleurs testeurs reçoivent des crédits Datacloud. Pour Systalink, le coût
est faible et les devs prennent l'habitude d'héberger chez eux.

- Déjà en place : le bouton "Déployer sur Datacloud" sur la page d'un projet,
  avec un lien de parrainage configurable (`DATACLOUD_REFERRAL_URL`, masqué
  s'il est vide), et le classement des compétitions, calculé à la lecture.
- **H4** : un parrainage ou une commission sur les crédits convertis en
  abonnements payants. Le taux reste à négocier avec Systalink.

### 3. Recrutement (entreprises)

Publication de missions et accès à l'annuaire des talents. Plus tard, une
commission sur les missions payées par la plateforme.

- Déjà en place : profils publics avec niveau, parcours déclaré ou vérifié,
  travaux co-signés, "Ouvert aux opportunités".
- Ce qui manque : un compte entreprise, la publication de missions, et un
  annuaire des talents avec recherche par stack et par pays (cette recherche
  n'est prévue dans `docs/CONTEXTE.md` que pour les projets, et n'est pas
  construite).
- **H5** : un accès à l'annuaire facturé par mois ou par mission publiée.
  Le choix dépend de ce que les premières entreprises préfèrent.

### 4. Compétitions sponsorisées (opérateurs, banques, fintechs)

Une entreprise organise un défi pour repérer des talents, sur
l'infrastructure de Systalink.

- Déjà en place : tout le module Compétitions (inscription en équipe,
  soumission, vote public, jury de niveau Architecte, résultats sur le
  profil) et la validation d'une compétition par un administrateur avant sa
  publication (`docs/adr/0013-competitions.md`).
- Ce qui manque : un champ "sponsor" et une page de résultats exportable.
- **H6** : un forfait par compétition, qui couvre les crédits Datacloud
  offerts aux gagnants.

## Pistes pour plus tard

`docs/CONTEXTE.md` en cite deux autres, non détaillées ici : des espaces
privés pour les écoles et les entreprises sur abonnement, et des skills
premium vendus par les seniors avec une commission. Les deux demandent des
outils d'administration qui n'existent pas encore.

## Les coûts

| Poste | Aujourd'hui | Quand Kemet grandit |
| --- | --- | --- |
| Hébergement | Un serveur Datacloud à Dakar (2 vCPU, 4 Go) | Un second serveur, ou une base séparée |
| Assistant | Offres gratuites, quota par personne | Offre payante ou modèles ouverts sur les serveurs GPU de Systalink |
| Emails | Un serveur SMTP | Selon le volume d'inscriptions |
| Paiement | Aucun | Frais de Wave et Orange Money |

## Ce qu'il faudrait mesurer avant de facturer

1. Combien de membres atteignent leur quota quotidien de @kemet : c'est la
   demande réelle pour l'avantage principal de Kemet Pro.
2. Combien de réponses de @kemet sont jugées utiles, et avec quel skill : la
   base des récompenses aux auteurs.
3. Combien de travaux et de projets reçoivent un contact : la valeur de
   l'annuaire pour un recruteur.

Les deux premiers chiffres se lisent déjà en base (`assistant_invocations`,
`points_ledger`) ; le troisième demanderait de compter les conversations
d'équipe ouvertes depuis un travail.
