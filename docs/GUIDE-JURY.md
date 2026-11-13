# Guide du jury

**Adresse : https://kemetlabs.dev**

Kemet se visite sans compte. Les contenus visibles sont des données de
démonstration, signalées comme telles sur le site ; les comptes réels créés
depuis l'ouverture s'y ajoutent.

**Compte de démonstration** : transmis à part, avec le dépôt. Aucun mot de
passe n'est écrit dans ce dépôt.

## Parcours de cinq minutes

Sur téléphone de préférence, ou sur ordinateur avec une fenêtre étroite pour
l'étape 5.

### 1. Accueil (30 s)

Ouvrir `https://kemetlabs.dev`. À la première visite, l'accueil montre le
continent et ses capitales reliées, puis trois questions courtes avant
l'inscription. "Explorer sans compte" mène directement au fil.

À regarder : rien ne défile sur un écran de téléphone, le parcours tient en
une carte.

### 2. Le fil et une réponse de Kocc (1 min)

Le premier post du fil "Pour toi" est une question sur la vérification de
la signature d'un webhook Wave en Node.js. Sous le post, une personne a
appelé `@kocc` dans sa réponse : la réponse de l'assistant est dépliée,
avec en haut le skill qui l'a nourrie et son auteur ("D'après
wave-paiements, de ..."), et la mention "Réponse enregistrée".

À regarder : l'assistant ne répond que quand on l'appelle, il cite toujours
sa source, et un visiteur ne déclenche aucun appel au modèle. Avec le
compte de démonstration, écrire une réponse qui commence par `@kocc` sous
un post fait répondre le modèle en direct.

### 3. Un skill (45 s)

Ouvrir `/skills/wave-paiements`. Un skill est une fiche de connaissance
écrite par un membre : c'est elle que Kocc lit avant de répondre. La page
montre son contenu, ses avis, le nombre de fois où Kocc s'en est servi, et
un exemple de réponse.

### 4. Un travail et "Qui a travaillé sur ce sujet ?" (1 min)

Ouvrir `/travaux`, puis le travail sur la détection des maladies du manioc
(`/travaux/maladies-manioc-vision-mobile`). En haut, sans compte, trois
personnes qui ont publié un travail proche, trouvées par les tags et la
stack communs. Connecté, le bouton "Trouver qui a travaillé sur ce sujet"
demande à Kocc de choisir et de justifier chaque proposition, parmi une
présélection qu'il ne peut pas dépasser.

À regarder : les onglets Présentation, Discussion et Équipe, et "Écrire à
l'équipe en privé".

### 5. Un salon sur téléphone (1 min)

Ouvrir `/salons`. La colonne de gauche liste les espaces, la liste à côté
leurs salons. Ouvrir l'espace "Backend & API", puis le salon "général" : il
s'ouvre en plein écran, le retour se fait par la flèche ou en glissant
depuis le bord. Connecté, un message envoyé apparaît en direct chez les
autres membres du salon, sans recharger.

### 6. Confidentialité (30 s)

Ouvrir `/confidentialite`, lien en bas du menu. La page dit quelles
données sont gardées et pourquoi, ce qui part chez les fournisseurs d'IA et
lesquels, et comment exporter ou supprimer son compte. Les deux actions
existent dans les Paramètres.

## Pour aller plus loin

- `README.md` : architecture et organisation du dépôt.
- `docs/VISITE-DU-CODE.md` : les trajets d'un message, d'un appel à Kocc et
  d'une mise en relation, fichier par fichier.
- `docs/DECLARATION-IA.md` : comment l'IA a servi à construire Kemet, et
  comment elle sert dans le produit.
