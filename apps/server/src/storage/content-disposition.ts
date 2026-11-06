/**
 * En-tête `Content-Disposition` pour un nom de fichier choisi par un
 * utilisateur. Node refuse dans un en-tête tout caractère au-delà de `\xff` :
 * une apostrophe typographique dans le nom faisait échouer chaque
 * téléchargement. Nom de repli en ASCII, nom exact encodé en `filename*`.
 */
export function contentDisposition(kind: "inline" | "attachment", originalName: string): string {
  const asciiFallback = originalName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${kind}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;
}
