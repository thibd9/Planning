import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { Vue } from '../store/ui';
import { useUi } from '../store/ui';

interface Etape {
  /** Élément mis en lumière (attribut data-tour). Sans cible, la carte est centrée. */
  cible?: string;
  vue?: Vue;
  titre: string;
  texte: string;
}

const ETAPES: Etape[] = [
  {
    titre: 'Bienvenue dans Solvéa',
    texte: 'Un tour d’une minute pour savoir où trouver chaque chose. Vous pourrez le relancer à tout moment avec le bouton « Tutoriel », en haut de l’écran.',
  },
  {
    cible: 'nav-tableau',
    vue: 'tableau',
    titre: 'Tableau de bord : la pharmacie en un écran',
    texte: 'Votre page d’accueil : l’équipe du jour, où en est le planning, les décisions en attente.',
  },
  {
    cible: 'nav-resoudre',
    vue: 'resoudre',
    titre: 'Résoudre : que décider aujourd’hui ?',
    texte: 'Absences à couvrir, remplacements, demandes de l’équipe, gardes à affecter, plannings à publier : tout ce qui attend une décision, du plus urgent au moins urgent.',
  },
  {
    cible: 'nav-construire',
    vue: 'construire',
    titre: 'Construire : la semaine de l’équipe',
    texte: 'Le planning, semaine par semaine. Tant qu’il est en brouillon, vous seul le voyez ; une fois publié, il devient la version officielle de l’équipe.',
  },
  {
    cible: 'proposer',
    vue: 'construire',
    titre: 'Faites-vous proposer un planning',
    texte: 'Solvéa calcule trois propositions comparables : équité, préférences, coût. Vous choisissez, vous ajustez, vous publiez. Rien n’est décidé sans vous.',
  },
  {
    cible: 'grille',
    vue: 'construire',
    titre: 'La grille',
    texte: 'Cliquez sur un « + » pour poser un poste, sur une tuile pour la modifier, ou faites-la glisser vers un autre jour. La ligne « Couverture » signale chaque jour où un pharmacien manque.',
  },
  {
    cible: 'controles',
    vue: 'construire',
    titre: 'Les contrôles',
    texte: 'Durées, repos, présence d’un pharmacien à la minute : les écarts s’affichent ici au fil de vos modifications. Quand c’est impossible, Solvéa vous dit pourquoi.',
  },
  {
    cible: 'nav-gardes',
    vue: 'gardes',
    titre: 'Gardes : de l’affectation à la paie',
    texte: 'Ajoutez vos gardes, confiez-les, déclarez les interventions. Solvéa protège le repos qui suit et prépare les variables pour le comptable.',
  },
  {
    cible: 'nav-equipe',
    vue: 'equipe',
    titre: 'Équipe : contrats et besoins',
    texte: 'Ajoutez des personnes, leurs compétences et leurs besoins d’horaires. Chaque fiche donne l’identifiant et le mot de passe provisoire à transmettre. Un besoin se décrit sans jamais demander sa raison.',
  },
  {
    cible: 'compte',
    titre: 'Votre compte, et celui de chacun',
    texte: 'En haut à droite : Mon compte, Paramètres, l’ajout d’une pharmacie et la déconnexion. Chaque membre de l’équipe se connecte à son propre espace, différent selon son rôle. Vous seul donnez l’accès à la gestion.',
  },
  {
    cible: 'aide',
    titre: 'C’est parti',
    texte: 'Le tutoriel reste disponible ici. Commencez par « Construire » pour préparer votre première semaine.',
  },
];

const CLE = 'releve.tutoriel.vu';

export function tutorielDejaVu(): boolean {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    return true;
  }
}

/** Tutoriel guidé : met en lumière un élément à la fois, avec une explication courte. */
export function Tour(): JSX.Element | null {
  const { tour, setTour, aller } = useUi();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const etape = tour !== null ? ETAPES[tour] : null;

  const fermer = useCallback((): void => {
    try {
      localStorage.setItem(CLE, '1');
    } catch {
      // Sans stockage, le tutoriel se relance simplement à la demande.
    }
    setTour(null);
  }, [setTour]);

  const mesurer = useCallback((): void => {
    if (!etape?.cible) return setRect(null);
    const el = document.querySelector<HTMLElement>(`[data-tour="${etape.cible}"]`);
    if (!el) return setRect(null);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setRect(el.getBoundingClientRect());
  }, [etape]);

  useEffect(() => {
    if (etape?.vue) aller(etape.vue);
  }, [etape, aller]);

  useLayoutEffect(() => {
    if (!etape) return;
    mesurer();
    const t = window.setTimeout(mesurer, 120);
    window.addEventListener('resize', mesurer);
    window.addEventListener('scroll', mesurer, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', mesurer);
      window.removeEventListener('scroll', mesurer, true);
    };
  }, [etape, mesurer]);

  useEffect(() => {
    if (tour === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') fermer();
      // Le focus reste dans la carte tant que le tutoriel est ouvert.
      if (e.key === 'Tab') {
        const f = Array.from(document.querySelectorAll<HTMLElement>('.tour-card button'));
        if (!f.length) return;
        const dans = f.includes(document.activeElement as HTMLElement);
        if (e.shiftKey && (!dans || document.activeElement === f[0])) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && (!dans || document.activeElement === f[f.length - 1])) {
          e.preventDefault();
          f[0].focus();
        }
      }
      if (e.key === 'ArrowRight') tour < ETAPES.length - 1 ? setTour(tour + 1) : fermer();
      if (e.key === 'ArrowLeft' && tour > 0) setTour(tour - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, setTour, fermer]);

  if (tour === null || !etape) return null;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const largeur = Math.min(400, W - 32);
  const marge = 8;
  const trou = rect
    ? { top: Math.max(4, rect.top - marge), left: Math.max(4, rect.left - marge), width: Math.min(W - 8, rect.width + marge * 2), height: Math.min(H - 8, rect.height + marge * 2) }
    : null;
  // Placement : à droite de la cible si la place existe, sinon dessous, sinon dessus, sinon centré.
  let top = H / 2 - 150;
  let left = W / 2 - largeur / 2;
  // De quel côté de la cible la carte se pose : sa flèche pointe vers ce qui est montré.
  let cote: 'droite' | 'bas' | 'haut' | 'centre' = 'centre';
  if (trou) {
    if (trou.left + trou.width + 26 + largeur < W) {
      left = trou.left + trou.width + 26;
      top = trou.top;
      cote = 'droite';
    } else if (trou.top + trou.height + 300 < H) {
      top = trou.top + trou.height + 24;
      left = trou.left;
      cote = 'bas';
    } else {
      top = trou.top - 300;
      left = trou.left;
      cote = 'haut';
    }
  }
  left = Math.max(16, Math.min(left, W - largeur - 16));
  top = Math.max(16, Math.min(top, H - 310));
  const dernier = tour === ETAPES.length - 1;

  return (
    <>
      <div className="tour-veil" onClick={fermer} aria-hidden="true" />
      <div key={tour} className={`tour-hole${trou ? '' : ' none'}`} style={trou ?? undefined} />
      <div key={`c${tour}`} className={`tour-card pos-${cote}`} role="dialog" aria-modal="true" aria-label={`Tutoriel, étape ${tour + 1} sur ${ETAPES.length}`} style={{ top, left, width: largeur }}>
        <div className="tour-tete">
          <span className="tour-n num" aria-hidden="true">
            {tour + 1}
          </span>
          <span className="grow">
            <span className="tour-etiquette">Tutoriel</span>
            <span className="tour-compte">
              Étape {tour + 1} sur {ETAPES.length}
            </span>
          </span>
          <button type="button" className="tour-fermer" onClick={fermer} aria-label="Fermer le tutoriel">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="tour-corps">
          <h2>{etape.titre}</h2>
          <p>{etape.texte}</p>
          <div className="tour-barre" aria-hidden="true">
            <i style={{ width: `${((tour + 1) / ETAPES.length) * 100}%` }} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            {tour > 0 ? (
              <button type="button" className="btn sm ghost" onClick={() => setTour(tour - 1)}>
                <ArrowLeft size={14} aria-hidden="true" /> Précédent
              </button>
            ) : (
              <button type="button" className="btn sm ghost" onClick={fermer}>
                Passer
              </button>
            )}
            <span className="grow" />
            <button type="button" className="btn primary tour-suite" autoFocus onClick={() => (dernier ? fermer() : setTour(tour + 1))}>
              {dernier ? 'C’est parti' : 'Suivant'} {dernier ? null : <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
