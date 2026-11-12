# Dossier de conception

Six schémas Mermaid, écrits le 06/11/2026 à partir du code et revérifiés le
12/11 (offres d'emploi, de stage et de mission comprises). Chaque nom de table, de route et de service qu'ils citent existe dans
le dépôt. GitHub affiche les schémas directement.

## [Cas d'utilisation](cas-d-utilisation.md)

Ce que peuvent faire un visiteur, un membre, un juré et un administrateur.
Les cas sont groupés par module : lecture, compte, salons, messagerie,
contenus, compétitions et modération.

## [Modèle de données](modele-de-donnees.md)

Les tables principales du schéma Drizzle et leurs relations. Aucun total
n'est stocké : points, niveaux, phases et non-lus se calculent à la lecture.
Les tables secondaires sont listées en tête de page.

## [Appel à Kocc](sequence-assistant.md)

Du message qui mentionne `@kocc` à la réponse diffusée par Socket.IO.
Montre le quota, la file d'attente, le choix du skill, le cache, la chaîne
Gemini, Groq, OpenRouter et la réponse enregistrée de secours.

## [Messagerie privée](sequence-messagerie.md)

Une demande de conversation, son acceptation et un blocage. Montre la
limite d'un message avant acceptation et les deux variantes : groupe et
équipe d'un travail.

## [Mise en relation des Travaux](sequence-travaux.md)

"Qui a travaillé sur ce sujet ?" : résultat par tags communs pour un
visiteur, sinon présélection plein texte et réponse JSON validée de la
chaîne. Montre pourquoi une suggestion hors présélection est rejetée.

## [Déploiement](deploiement.md)

Caddy, les quatre services, PostgreSQL, Valkey et les volumes sur un seul
serveur Datacloud. Montre aussi la publication des images, le déploiement
par SSH et les sauvegardes chiffrées.
