import type { ReactNode } from "react";

/** Une partie d'un long formulaire, dans sa carte, avec son titre. */
export function FormSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-4 flex-col gap-3 rounded-card border border-border p-3 lg:p-5"
    >
      <h2 id={`${id}-title`} className="text-md font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Deux champs courts côte à côte à partir de 1024 px, l'un sous l'autre avant. */
export function FormPair({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{children}</div>;
}
