-- Espace système des discussions de travaux, au nom du profil fixe de
-- l'assistant (migration 0003) : il existe avant toute publication, aucun
-- compte ne peut prendre son slug, et il ne disparaît avec aucun profil.
INSERT INTO "spaces" ("id", "name", "slug", "visibility", "kind", "created_by")
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Discussions des travaux',
  'discussions-des-travaux',
  'public',
  'work_discussions',
  '00000000-0000-0000-0000-000000000001'
);
