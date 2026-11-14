import { workMediaContentPath, type WorkImage } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { useImageViewer } from "../media/ImageViewer.js";

export function WorkGallery({ images, title }: { images: WorkImage[]; title: string }) {
  const { openAt, viewer } = useImageViewer(
    images.map((image, index) => ({
      src: workMediaContentPath(image.id),
      alt: fr.works.galleryImageAlt(title, index + 1),
    })),
  );
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              onClick={(event) => openAt(index, event.currentTarget)}
              aria-label={fr.works.openImage(index + 1)}
              className="block w-full cursor-zoom-in overflow-hidden rounded-card border border-border hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src={workMediaContentPath(image.id)}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full bg-surface-2 object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {viewer}
    </>
  );
}
