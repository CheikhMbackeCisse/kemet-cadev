import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";
import { Input } from "../ui/Input.js";

/**
 * Champ de l'identifiant avec le "@" écrit dedans, devant le texte : on voit
 * tout de suite que c'est l'adresse du profil. Le "@" ne fait pas partie de
 * la valeur.
 */
export const HandleInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function HandleInput({ className, ...props }, ref) {
    return (
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted max-md:text-md"
        >
          @
        </span>
        <Input
          ref={ref}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn("pl-7", className)}
          {...props}
        />
      </div>
    );
  },
);
