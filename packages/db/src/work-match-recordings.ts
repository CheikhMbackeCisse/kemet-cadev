/**
 * Réponse de "Qui a travaillé sur ce sujet ?" écrite à l'avance pour un travail
 * de démonstration. Le serveur la rejoue quand les deux fournisseurs d'IA sont
 * saturés (ASSISTANT_RECORDED_ANSWERS), et l'affiche comme enregistrée.
 */
export interface WorkMatchRecording {
  subjectWorkSlug: string;
  suggestions: { handle: string; workSlug: string; justification: string }[];
}

export const OFFLINE_SYNC_MATCH_RECORDING: WorkMatchRecording = {
  subjectWorkSlug: "synchronisation-hors-ligne-banque-mobile",
  suggestions: [
    {
      handle: "skander-jaziri",
      workSlug: "stock-boutique-hors-ligne",
      justification:
        "Son application de stock pour boutiques de quartier enregistre les ventes hors ligne et les renvoie à la reconnexion, le même problème de file d'attente locale.",
    },
    {
      handle: "kiprono-langat",
      workSlug: "idempotence-paiements-mobile-money",
      justification:
        "Son article explique comment rejouer une opération de paiement sans la compter deux fois, ce que demande une resynchronisation après une coupure.",
    },
    {
      handle: "ghizlane-amrani",
      workSlug: "maladies-manioc-vision-mobile",
      justification:
        "Son mémoire fait tourner un modèle sur des téléphones sans réseau et synchronise les résultats plus tard, avec les mêmes contraintes de terrain.",
    },
  ],
};

export const WORK_MATCH_RECORDINGS: WorkMatchRecording[] = [OFFLINE_SYNC_MATCH_RECORDING];
