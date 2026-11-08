import { useEffect, useState } from "react";
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
  // Pendant le chargement de la configuration, la place des carrés est gardée :
  // la carte ne saute pas quand ils arrivent.
  if (enabled !== null && activeProviders.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Trois carrés côte à côte : le nom du fournisseur est l'étiquette accessible. */}
      <div className="flex h-12 justify-center gap-3">
        {activeProviders.map((provider) => (
          <button
            key={provider.id}
            type="button"
            aria-label={provider.label}
            title={provider.shortLabel}
            onClick={() => void signInWithSocialProvider(provider.id, callbackURL)}
            className="flex size-12 items-center justify-center rounded-control bg-white text-[#181717] transition-colors duration-150 hover:bg-auth-button-hover"
          >
            <SocialProviderIcon provider={provider.id} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-auth-text-muted">
        <span className="h-px flex-1 bg-white/20" />
        {fr.auth.orSeparator}
        <span className="h-px flex-1 bg-white/20" />
      </div>
    </div>
  );
}
