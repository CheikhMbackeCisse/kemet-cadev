# 0019 — Dégradé et halos autorisés sur les écrans de compte

Date : 20/10/2026

## Contexte

Les écrans de compte (connexion, inscription, mot de passe oublié,
réinitialisation) étaient jusqu'ici des formulaires posés sur le fond uni de
l'application. Ils fonctionnaient mais ne ressemblaient à rien : c'est le
premier écran qu'un membre du jury CADEV voit s'il arrive par un lien de
connexion.

J'ai choisi de reprendre la page de connexion de Systalink : carte blanche
centrée, boutons sociaux en haut, séparateur « ou », champs email et mot de
passe, le tout posé sur un fond de marque plein écran. Ce fond est construit sur
un dégradé bleu et des halos lumineux colorés.

La permission de copie visuelle de l'ADR 0018 autorise déjà à reprendre
l'apparence d'un autre produit. Mais le principe 6 de `DESIGN.md` et la règle 6
des règles de contribution excluaient explicitement la liste « Ce qui est interdit » de cette
permission, et cette liste nomme les dégradés décoratifs et les halos lumineux.
Reprendre la page telle quelle aurait donc contredit une règle écrite.

## Décision

L'interdit sur les dégradés et les halos est levé, **pour les seuls écrans de
compte**. Autorisation donnée explicitement le 20/10/2026, après
examen de la contradiction.

Le périmètre est volontairement étroit :

- Le dégradé et les halos vivent uniquement dans le fond, derrière une carte
  opaque qui porte le formulaire.
- Le contenu de la carte (champs, boutons, textes, séparateur) reste composé de
  composants Kemet ordinaires, sans dégradé ni halo.
- Le reste de la liste « Ce qui est interdit » continue de s'appliquer sur ces
  écrans comme ailleurs : pas d'emoji en guise d'icône, pas de libellés en
  majuscules espacées, pas d'animation d'apparition, pas de police hors Plus
  Jakarta Sans et Geist Mono.
- Aucun autre écran du produit n'hérite de cette exception. Un dégradé qui
  apparaîtrait sur le fil, un salon, un profil ou une page projet reste un
  défaut à corriger.

Les couleurs du fond sortent des tokens de marque existants (`--primary` et les
variables de fond des deux thèmes), pas de valeurs écrites en dur, pour que
l'écran reste correct en thème clair comme en thème sombre.

## Conséquences

- `DESIGN.md` porte l'exception dans la section « Ce qui est interdit », pour
  qu'on ne la retrouve pas seulement dans un ADR.
- Le fond est un composant unique partagé par les quatre écrans de compte
  (`apps/web/src/components/auth/AuthBackground.tsx`), pour qu'il n'y ait qu'un
  endroit à corriger et qu'on ne puisse pas le réutiliser par copier-coller
  ailleurs sans s'en rendre compte.
- Une relecture d'interface qui signale un dégradé hors des écrans de compte
  reste un signalement valable : l'exception ne vaut pas blanc-seing.
