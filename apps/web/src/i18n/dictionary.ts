import type { french } from "./fr.js";

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;

/** Forme des textes de l'interface : chaque langue a toutes les clés du français. */
export type Dictionary = Widen<typeof french>;
