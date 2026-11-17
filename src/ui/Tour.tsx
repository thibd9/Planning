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
    titre: 'Bienvenue dans Relève',
    texte: 'Un tour d’une minute pour savoir où trouver chaque chose. Vous pourrez le relancer à tout moment avec le bouton « Tutoriel », en haut de l’écran.',
  },
  {
    cible: 'nav-resoudre',
    vue: 'resoudre',
    titre: 'Résoudre : que décider aujourd’hui ?',
    texte: 'Votre page d’accueil. Absences à couvrir, demandes de l’équipe, gardes à affecter, plannings à publier : tout ce qui attend une décision, du plus urgent au moins urgent.',
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
    texte: 'Relève calcule trois propositions comparables : équité, souhaits, coût. Vous choisissez, vous ajustez, vous publiez. Rien n’est décidé sans vous.',
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
    texte: 'Durées, repos, présence d’un pharmacien à la minute : les écarts s’affichent ici au fil de vos modifications. Quand c’est impossible, Relève vous dit pourquoi.',
  },
  {
    cible: 'nav-gardes',
    vue: 'gardes',
    titre: 'Gardes : de l’affectation à la paie',
    texte: 'Ajoutez vos gardes, confiez-les, déclarez les interventions. Relève protège le repos qui suit et prépare les variables pour le comptable.',
  },
  {
    cible: 'nav-equipe',
    vue: 'equipe',
    titre: 'Équipe : contrats et besoins',
    texte: 'Ajoutez des personnes, leurs compétences et leurs besoins d’horaires. Un besoin se décrit sans jamais demander sa raison.',
  },
  {
    cible: 'compte',
    titre: 'Votre compte, et celui de chacun',
    texte: 'Ici : votre thème de couleur, votre code d’accès et la déconnexion. Chaque membre de l’équipe se connecte à son propre espace, différent selon son rôle. Vous seul donnez l’accès à la gestion.',
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
  const largeur = Math.min(380, W - 32);
  const marge = 8;
  const trou = rect
    ? { top: Math.max(4, rect.top - marge), left: Math.max(4, rect.left - marge), width: Math.min(W - 8, rect.width + marge * 2), height: Math.min(H - 8, rect.height + marge * 2) }
    : null;
  // Placement : à droite de la cible si la place existe, sinon dessous, sinon dessus, sinon centré.
  let top = H / 2 - 130;
  let left = W / 2 - largeur / 2;
  if (trou) {
    if (trou.left + trou.width + 20 + largeur < W) {
      left = trou.left + trou.width + 20;
      top = trou.top;
    } else if (trou.top + trou.height + 260 < H) {
      top = trou.top + trou.height + 18;
      left = trou.left;
    } else {
      top = trou.top - 250;
      left = trou.left;
    }
  }
  left = Math.max(16, Math.min(left, W - largeur - 16));
  top = Math.max(16, Math.min(top, H - 270));
  const dernier = tour === ETAPES.length - 1;

  return (
    <>
      <div className="tour-veil" onClick={fermer} aria-hidden="true" />
      <div className={`tour-hole${trou ? '' : ' none'}`} style={trou ?? undefined} />
      <div className="tour-card" role="dialog" aria-modal="true" aria-label={`Tutoriel, étape ${tour + 1} sur ${ETAPES.length}`} style={{ top, left, width: largeur }}>
        <div className="row">
          <span className="eyebrow grow">
            Tutoriel · {tour + 1} / {ETAPES.length}
          </span>
          <button type="button" className="btn ghost icon" style={{ width: 30, height: 30 }} onClick={fermer} aria-label="Fermer le tutoriel">
            <X size={16} />
          </button>
        </div>
        <h2>{etape.titre}</h2>
        <p>{etape.texte}</p>
        <div className="row" style={{ marginTop: 4 }}>
          <span className="tour-dots grow" aria-hidden="true">
            {ETAPES.map((_, i) => (
              <i key={i} className={i === tour ? 'on' : ''} />
            ))}
          </span>
          {tour > 0 ? (
            <button type="button" className="btn sm" onClick={() => setTour(tour - 1)}>
              <ArrowLeft size={14} /> Précédent
            </button>
          ) : (
            <button type="button" className="btn sm ghost" onClick={fermer}>
              Passer
            </button>
          )}
          <button type="button" className="btn sm primary" autoFocus onClick={() => (dernier ? fermer() : setTour(tour + 1))}>
            {dernier ? 'Terminer' : 'Suivant'} {dernier ? null : <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </>
  );
}
