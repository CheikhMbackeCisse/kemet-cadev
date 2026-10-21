import { useEffect, useState } from "react";
import { Button } from "../ui/Button.js";
import {
  getAuthConfig,
  signInWithSocialProvider,
  type SocialProvider,
} from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";
import { SocialProviderIcon } from "./SocialProviderIcon.js";

const PROVIDERS: { id: SocialProvider; label: string; shortLabel: string }[] = [
  { id: "google", label: fr.auth.continueWithGoogle, shortLabel: fr.auth.providerGoogle },
  { id: "github", label: fr.auth.continueWithGithub, shortLabel: fr.auth.providerGithub },
  { id: "linkedin", label: fr.auth.continueWithLinkedin, shortLabel: fr.auth.providerLinkedin },
];

export interface SocialSignInButtonsProps {
  callbackURL: string;
}

export function SocialSignInButtons({ callbackURL }: SocialSignInButtonsProps) {
  const [enabled, setEnabled] = useState<Record<SocialProvider, boolean> | null>(null);

  useEffect(() => {
    getAuthConfig()
      .then((config) =>
        setEnabled({
          google: config.googleEnabled,
          github: config.githubEnabled,
          linkedin: config.linkedinEnabled,
        }),
      )
      .catch(() => setEnabled({ google: false, github: false, linkedin: false }));
  }, []);

  const activeProviders = PROVIDERS.filter((provider) => enabled?.[provider.id]);
  if (activeProviders.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Les trois fournisseurs tiennent sur une ligne des qu'il y a la place :
          le libelle long sert alors d'etiquette accessible, et seul le nom du
          fournisseur reste visible. */}
      <div className="grid gap-2 sm:grid-cols-3">
        {activeProviders.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="secondary"
            aria-label={provider.label}
            onClick={() => void signInWithSocialProvider(provider.id, callbackURL)}
          >
            <SocialProviderIcon provider={provider.id} />
            <span className="sm:hidden">{provider.label}</span>
            <span className="hidden sm:inline">{provider.shortLabel}</span>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-subtle">
        <span className="h-px flex-1 bg-border" />
        {fr.auth.orSeparator}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
