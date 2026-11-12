import { Compass, Hash } from "lucide-react";
import { useState } from "react";
import { AssistantMessage } from "../components/assistant/AssistantMessage.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Checkbox } from "../components/ui/Checkbox.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Flag } from "../components/ui/Flag.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Input } from "../components/ui/Input.js";
import { LevelBadge, type Level } from "../components/ui/LevelBadge.js";
import { Menu } from "../components/ui/Menu.js";
import { Select } from "../components/ui/Select.js";
import { Sheet } from "../components/ui/Sheet.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { SpaceIcon, spaceTints } from "../components/ui/SpaceIcon.js";
import { Switch } from "../components/ui/Switch.js";
import { Tabs } from "../components/ui/Tabs.js";
import { Textarea } from "../components/ui/Textarea.js";
import { Tooltip } from "../components/ui/Tooltip.js";
import { UserName } from "../components/ui/UserName.js";
import { useToast } from "../components/ui/Toast.js";

const LEVELS: Level[] = ["apprenti", "artisan", "scribe", "architecte", "legende"];

// Noms des espaces du seed et deux espaces de technologie, pour juger toutes
// les icônes d'un coup.
const SPACE_BOARD = [
  "Data & Intelligence Artificielle",
  "Backend & API",
  "DevOps & Cloud Afrique",
  "Cybersécurité",
  "Jeux Vidéo Afrique",
  "Frontend & Design Systems",
  "Carrière & Freelance Tech",
  "Débuter en informatique",
  "Hackathons et concours",
  "CADEV 2026",
  "Startups et produit",
  "Développeurs de Lomé",
  "Discussions générales",
  "Flutter Afrique",
  "Python Dakar",
  "React Abidjan",
].map((name) => ({ id: name, name }));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border py-8 first:pt-0">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export function DevUiPage() {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [switched, setSwitched] = useState(false);
  const [tabValue, setTabValue] = useState("apercu");
  const [selectValue, setSelectValue] = useState("fastify");
  const [loading, setLoading] = useState(false);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-reading px-4 lg:px-0">
        <h1 className="text-xl font-bold text-text">Composants : /dev/ui</h1>
        <p className="mt-1 text-sm text-text-2">
          Chaque composant du système de design, dans ses états, et la coquille remplie de contenu
          factice pour juger la densité.
        </p>

        <Section title="Boutons">
          <Row>
            <Button variant="primary">Publier</Button>
            <Button variant="secondary">Annuler</Button>
            <Button variant="ghost">Ignorer</Button>
            <Button variant="danger">Supprimer</Button>
            <Button variant="primary" loading={loading} onClick={() => setLoading((v) => !v)}>
              Enregistrer
            </Button>
            <Button variant="primary" disabled>
              Désactivé
            </Button>
          </Row>
        </Section>

        <Section title="Boutons icône">
          <Row>
            <Tooltip label="Rechercher">
              <IconButton aria-label="Rechercher">
                <Compass className="size-4" aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <IconButton aria-label="Salon actif" active>
              <Hash className="size-4" aria-hidden="true" />
            </IconButton>
          </Row>
        </Section>

        <Section title="Champs">
          <div className="flex max-w-sm flex-col gap-3">
            <Input placeholder="Nom du salon" aria-label="Nom du salon" />
            <Textarea placeholder="Décris ton skill en une phrase" aria-label="Description" />
            <Select
              value={selectValue}
              onValueChange={setSelectValue}
              aria-label="Stack principale"
              options={[
                { value: "fastify", label: "Fastify" },
                { value: "react", label: "React" },
                { value: "drizzle", label: "Drizzle" },
              ]}
            />
          </div>
        </Section>

        <Section title="Choix">
          <Row>
            <label className="flex items-center gap-2 text-sm text-text">
              <Checkbox
                checked={checked}
                onCheckedChange={setChecked}
                aria-label="Notifier par courriel"
              />
              Notifier par courriel
            </label>
            <label className="flex items-center gap-2 text-sm text-text">
              <Switch
                checked={switched}
                onCheckedChange={setSwitched}
                aria-label="Mode hors ligne"
              />
              Mode hors ligne
            </label>
          </Row>
        </Section>

        <Section title="Badges et niveaux">
          <Row>
            <Badge tone="neutral">Astuce</Badge>
            <Badge tone="primary">À tester</Badge>
            <Badge tone="success">Vérifié</Badge>
            <Badge tone="danger">Signalé</Badge>
          </Row>
          <Row>
            {LEVELS.map((level) => (
              <LevelBadge key={level} level={level} />
            ))}
          </Row>
        </Section>

        <Section title="Avatars, drapeaux, noms d'utilisateur">
          <Row>
            <Avatar name="Fatou Diop" size={24} />
            <Avatar name="Fatou Diop" size={32} />
            <Avatar name="Fatou Diop" size={40} />
            <Flag countryCode="SN" />
            <Flag countryCode="CI" />
            <Flag countryCode="NG" />
          </Row>
          <Row>
            <UserName name="Fatou Diop" level="artisan" />
            <UserName name="Jean Kouassi" level="legende" />
          </Row>
        </Section>

        <Section title="Squelette, vide, erreur">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-4 w-64" />
            </div>
            <EmptyState
              message="Aucun salon pour l'instant. Crée le premier salon."
              action={{
                label: "Créer un salon",
                onClick: () => toast.show("Salon créé", "success"),
              }}
            />
            <ErrorState
              message="Le message n'est pas parti : connexion perdue. Réessaie."
              retry={{ label: "Réessayer", onClick: () => toast.show("Nouvelle tentative…") }}
            />
          </div>
        </Section>

        <Section title="Notifications, fenêtres, feuilles">
          <Row>
            <Button variant="secondary" onClick={() => toast.show("Publié")}>
              Déclencher un toast
            </Button>
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Ouvrir une fenêtre
            </Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Ouvrir une feuille
            </Button>
          </Row>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Quitter le salon ?"
            description="Tu ne recevras plus les messages de backend."
          >
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>
                Quitter
              </Button>
            </div>
          </Dialog>
          <Sheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            side="bottom"
            title="Options du message"
          >
            <div className="flex flex-col gap-1">
              <Button variant="ghost" className="justify-start">
                Copier le lien
              </Button>
              <Button variant="ghost" className="justify-start">
                Signaler
              </Button>
            </div>
          </Sheet>
        </Section>

        <Section title="Onglets et menu">
          <Tabs
            value={tabValue}
            onValueChange={setTabValue}
            items={[
              {
                value: "apercu",
                label: "Aperçu",
                content: <p className="text-sm text-text-2">Contenu de l'onglet Aperçu.</p>,
              },
              {
                value: "activite",
                label: "Activité",
                content: <p className="text-sm text-text-2">Contenu de l'onglet Activité.</p>,
              },
            ]}
          />
          <Menu
            trigger={<Button variant="secondary">Trier par</Button>}
            items={[
              { value: "recent", label: "Plus récent" },
              { value: "populaire", label: "Plus populaire" },
            ]}
            selectedValue="recent"
            onSelect={() => undefined}
          />
        </Section>

        <Section title="Icônes des espaces">
          <div id="space-icons" className="grid grid-cols-3 gap-4 sm:grid-cols-5">
            {SPACE_BOARD.map((space) => (
              <div key={space.id} className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-end gap-2">
                  <SpaceIcon
                    id={space.id}
                    name={space.name}
                    tint={spaceTints(SPACE_BOARD).get(space.id)}
                    className="size-12 rounded-card"
                  />
                  <SpaceIcon
                    id={space.id}
                    name={space.name}
                    tint={spaceTints(SPACE_BOARD).get(space.id)}
                    className="size-6 rounded-[6px]"
                  />
                </div>
                <span className="text-xs text-text-2">{space.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Bloc de réponse de l'assistant">
          <AssistantMessage
            content={
              <p>
                La recherche plein texte PostgreSQL sélectionne les skills par pertinence sur le nom
                et la description avant de passer le contenu intégral du skill retenu.
              </p>
            }
            skill={{
              skillName: "recherche-skills",
              skillHref: "#",
              authorName: "Cheikh Mbacke Cissé",
              authorHref: "#",
            }}
            readSummary="A lu le skill recherche-skills et les 2 derniers messages."
          />
        </Section>
      </div>

      <section className="border-t border-border px-4 py-8 lg:px-8">
        <h2 className="text-lg font-semibold text-text">Coquille remplie</h2>
        <p className="mt-3 text-sm text-text-2">
          Chargée dans une iframe, à sa vraie largeur : la barre d'onglets mobile et les feuilles de
          la coquille utilisent une position fixe au viewport, qui n'a de sens que pour une page
          entière.
        </p>
        <iframe
          src="/dev/ui/shell"
          title="Aperçu de la coquille de l'application"
          className="mt-4 h-[720px] w-full rounded-panel border border-border"
        />
      </section>
    </main>
  );
}
