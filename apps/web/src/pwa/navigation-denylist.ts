// Le service worker sert index.html à toute navigation qu'il ne connaît pas.
// Une navigation vers le serveur doit lui échapper : retour d'un fournisseur
// OAuth (/api/auth/callback/google), lien de vérification d'email, fichier
// ouvert dans un nouvel onglet. Sans cette liste, la page de l'application
// remplace la réponse du serveur et aucune session n'est créée.
export const SERVER_NAVIGATION_DENYLIST: RegExp[] = [
  /^\/api\//,
  /^\/socket\.io\//,
  /^\/realtime\//,
];
