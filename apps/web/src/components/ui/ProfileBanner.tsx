// Décorative : le nom et l'avatar juste en dessous portent l'information.
export function ProfileBanner({ src }: { src: string | null }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className="aspect-[4/1] max-h-40 w-full rounded-card bg-surface-2 object-cover"
    />
  );
}
