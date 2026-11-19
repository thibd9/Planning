import { MOIS, addDays, ferie, fmtDateCourt, isoWeek, mondayOf, weekDates } from '../domain/time';
import type { AppData, ISODate, Person, Shift } from '../domain/types';
import { ABSENCE_LABEL, estPharmacien, nomGarde } from '../domain/types';
import { minutesTravail, ouverture } from './core';
import { semainesDuMois } from './echeance';

/**
 * La feuille à imprimer : une semaine sur une page, ou un mois semaine après semaine. Tout est calculé ici, en
 * millimètres, pour que l'aperçu à l'écran et le papier disent exactement la même chose : qui travaille, à quelle
 * heure, qui est absent, et si le planning est publié ou encore en brouillon.
 */
export type Periode = 'semaine' | 'mois';

export interface PosteImprime {
  start: number;
  end: number;
  pauseStart?: number;
  pauseEnd?: number;
  /** Les pauses courtes du poste. */
  pauses?: { start: number; end: number }[];
  /** La tâche, quand ce n'est pas le comptoir. */
  tache?: Shift['activite'];
}
export interface CaseImprimee {
  postes: PosteImprime[];
  /** « Congé », « Arrêt », « Formation », « Absent » : l'absence acceptée ce jour-là. */
  absence?: string;
  /** La classe de couleur de l'absence. */
  nature?: 'conge' | 'arret' | 'formation' | 'absence';
  garde?: string;
}
export interface JourImprime {
  date: ISODate;
  ferme: boolean;
  ferie?: string;
  /** En vue mois : ce jour appartient au mois voisin. */
  horsMois: boolean;
}
export interface LigneImprimee {
  personne: Person;
  cases: CaseImprimee[];
  /** Minutes de travail sur la semaine. */
  minutes: number;
  /** Hauteur de la ligne, en millimètres. */
  hauteur: number;
}
export interface GroupeImprime {
  titre: string;
  lignes: LigneImprimee[];
}
export interface BlocSemaine {
  monday: ISODate;
  semaine: number;
  jours: JourImprime[];
  groupes: GroupeImprime[];
  etat: 'publie' | 'brouillon' | 'vide' | 'non_publie';
  publieLe?: string;
  /** Ce bloc poursuit, sur une nouvelle page, une semaine trop longue pour une seule. */
  suite?: boolean;
}
export interface PageImprimee {
  blocs: BlocSemaine[];
}
export interface DocumentImprime {
  periode: Periode;
  titre: string;
  sousTitre: string;
  pages: PageImprimee[];
  /** Vrai si au moins une semaine montrée n'est pas publiée. */
  brouillon: boolean;
  /** Vrai si le document ne montre aucun poste. */
  vide: boolean;
}

/** La géométrie d'une page A4 en paysage, en millimètres. */
export const PAGE = { largeur: 297, hauteur: 210, marge: 10, entete: 19, pied: 13 } as const;
const UTILE = PAGE.hauteur - 2 * PAGE.marge - PAGE.entete - PAGE.pied;
const SEMAINE = { tete: 12, groupe: 5.5, ligneMin: 6.5, ligneMax: 12.5 } as const;
const MOISG = { titre: 6.5, tete: 6.5, ligne: 5, ligneDouble: 9, aere: 7, ecart: 4 } as const;

const GROUPES: { titre: string; test: (p: Person) => boolean }[] = [
  { titre: 'Pharmaciens', test: (p) => estPharmacien(p) && !p.externe },
  { titre: 'Préparateurs', test: (p) => p.qualification === 'preparateur' && !p.externe },
  { titre: 'Animateurs', test: (p) => p.qualification === 'animateur' && !p.externe },
  { titre: 'Apprentis', test: (p) => p.qualification === 'apprenti' && !p.externe },
  { titre: 'Étudiants', test: (p) => p.qualification === 'etudiant' && !p.externe },
  { titre: 'Rayonnistes', test: (p) => p.qualification === 'rayonniste' && !p.externe },
  { titre: 'Remplaçants', test: (p) => !!p.externe },
];

export interface OptionsImpression {
  periode: Periode;
  /** Un jour de la semaine, ou du mois, à imprimer. */
  repere: ISODate;
  /** Le titulaire voit ses brouillons ; l'équipe ne voit que ce qui est publié. */
  gestion: boolean;
  /** Qui imprime : son absence est nommée, celle des autres reste « Absent » pour l'équipe. */
  moi: string;
  /** N'imprimer que cette personne. */
  seulement?: string;
}

function blocDe(data: AppData, monday: ISODate, o: OptionsImpression, mois?: string): BlocSemaine {
  const etatSemaine = data.semaines[monday];
  const publie = etatSemaine?.statut === 'publie';
  const dates = weekDates(monday);
  const fin = addDays(monday, 6);
  // L'équipe ne lit que la version publiée, telle qu'elle a été envoyée.
  const postes = o.gestion ? data.shifts.filter((s) => s.date >= monday && s.date <= fin) : publie ? (etatSemaine?.snapshot ?? data.shifts.filter((s) => s.date >= monday && s.date <= fin)) : [];
  const jours: JourImprime[] = dates.map((date) => ({ date, ferme: ouverture(data.officine, date).length === 0, ...(ferie(date) ? { ferie: ferie(date) } : {}), horsMois: !!mois && !date.startsWith(mois) }));
  const personnes = data.personnes.filter((p) => (o.seulement ? p.id === o.seulement : !p.externe || postes.some((s) => s.personId === p.id)));
  const ligne = (p: Person): LigneImprimee => {
    let minutes = 0;
    let lignesMax = 1;
    const cases = dates.map((date): CaseImprimee => {
      const duJour = postes.filter((s) => s.personId === p.id && s.date === date).sort((a, b) => a.start - b.start);
      for (const s of duJour) minutes += minutesTravail(s);
      const absence = data.absences.find((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= date && date <= a.to);
      const garde = data.gardes.find((g) => g.personId === p.id && g.date === date && (o.gestion || p.id === o.moi));
      const nomme = o.gestion || p.id === o.moi;
      lignesMax = Math.max(lignesMax, duJour.length + (garde ? 1 : 0));
      return {
        postes: duJour.map((s) => ({ start: s.start, end: s.end, ...(s.pauseStart !== undefined && s.pauseEnd !== undefined ? { pauseStart: s.pauseStart, pauseEnd: s.pauseEnd } : {}), ...(s.pauses?.length ? { pauses: s.pauses } : {}), ...(s.activite && s.activite !== 'comptoir' ? { tache: s.activite } : {}) })),
        // Un poste encore affiché un jour d'absence acceptée : l'absence l'emporte, la personne ne sera pas là.
        ...(absence ? { absence: nomme || absence.type === 'formation' ? ABSENCE_LABEL[absence.type] : 'Absent', nature: !nomme && absence.type !== 'formation' ? ('absence' as const) : absence.type === 'conge' ? ('conge' as const) : absence.type === 'formation' ? ('formation' as const) : absence.type === 'autre' ? ('absence' as const) : ('arret' as const) } : {}),
        ...(garde ? { garde: nomGarde(garde) } : {}),
      };
    });
    return { personne: p, cases, minutes, hauteur: o.periode === 'mois' ? (lignesMax > 1 ? MOISG.ligneDouble : MOISG.ligne) : SEMAINE.ligneMin };
  };
  const groupes = GROUPES.map((g) => ({ titre: g.titre, lignes: personnes.filter(g.test).map(ligne) })).filter((g) => g.lignes.length);
  return {
    monday,
    semaine: isoWeek(monday),
    jours,
    groupes,
    etat: postes.length ? (publie ? 'publie' : 'brouillon') : o.gestion || publie ? 'vide' : 'non_publie',
    ...(publie && etatSemaine?.publishedAt ? { publieLe: etatSemaine.publishedAt } : {}),
  };
}

const lignesDe = (b: BlocSemaine): number => b.groupes.reduce((t, g) => t + g.lignes.length, 0);
const hauteurMois = (b: BlocSemaine): number => MOISG.titre + MOISG.tete + b.groupes.reduce((t, g) => t + g.lignes.reduce((x, l) => x + l.hauteur, 0), 0);

/** Coupe un bloc trop long en plusieurs, groupe par groupe puis ligne par ligne : aucune personne n'est perdue. */
function decouper(b: BlocSemaine, place: (lignes: number, groupes: number) => boolean): BlocSemaine[] {
  const out: BlocSemaine[] = [];
  let courant: GroupeImprime[] = [];
  let n = 0;
  const fermer = (): void => {
    if (courant.length) out.push({ ...b, groupes: courant, ...(out.length ? { suite: true } : {}) });
    courant = [];
    n = 0;
  };
  for (const g of b.groupes) {
    let reste = g.lignes;
    while (reste.length) {
      let k = 0;
      while (k < reste.length && place(n + k + 1, courant.length + 1)) k++;
      if (k === 0) {
        if (!n) k = 1;
        else {
          fermer();
          continue;
        }
      }
      courant.push({ titre: g.titre, lignes: reste.slice(0, k) });
      n += k;
      reste = reste.slice(k);
      if (reste.length) fermer();
    }
  }
  fermer();
  return out.length ? out : [b];
}

/** Le document prêt à imprimer : son titre, et ses pages. */
export function documentImpression(data: AppData, o: OptionsImpression): DocumentImprime {
  const pages: PageImprimee[] = [];
  let titre: string;
  let sousTitre: string;
  let blocs: BlocSemaine[];
  if (o.periode === 'semaine') {
    const monday = mondayOf(o.repere);
    const b = blocDe(data, monday, o);
    blocs = [b];
    titre = `Semaine ${b.semaine}`;
    sousTitre = `Du ${fmtDateCourt(monday)} au ${fmtDateCourt(addDays(monday, 6))} ${monday.slice(0, 4)}`;
    // Les lignes prennent toute la hauteur disponible, sans dépasser une taille confortable.
    const tient = (lignes: number, groupes: number): boolean => SEMAINE.tete + groupes * SEMAINE.groupe + lignes * SEMAINE.ligneMin <= UTILE;
    for (const morceau of decouper(b, tient)) {
      const n = lignesDe(morceau);
      const h = Math.max(SEMAINE.ligneMin, Math.min(SEMAINE.ligneMax, (UTILE - SEMAINE.tete - morceau.groupes.length * SEMAINE.groupe) / Math.max(n, 1)));
      pages.push({ blocs: [{ ...morceau, groupes: morceau.groupes.map((g) => ({ ...g, lignes: g.lignes.map((l) => ({ ...l, hauteur: Math.floor(h * 10) / 10 })) })) }] });
    }
  } else {
    const mois = o.repere.slice(0, 7);
    titre = `${MOIS[Number(mois.slice(5)) - 1].replace(/^./, (x) => x.toUpperCase())} ${mois.slice(0, 4)}`;
    sousTitre = 'Le mois, semaine après semaine';
    // Une semaine qui ne touche le mois que par des jours fermés (un dimanche, par exemple) n'apporte rien : elle est laissée de côté.
    blocs = semainesDuMois(mois)
      .map((monday) => blocDe(data, monday, o, mois))
      .filter((b) => b.jours.some((j) => !j.horsMois && !j.ferme));
    let page: BlocSemaine[] = [];
    let prise = 0;
    const tourner = (): void => {
      if (page.length) pages.push({ blocs: page });
      page = [];
      prise = 0;
    };
    for (const b of blocs) {
      // Une semaine plus haute qu'une page entière est coupée ; sinon elle ne se partage jamais entre deux pages.
      const morceaux = hauteurMois(b) > UTILE ? decouper(b, (lignes) => MOISG.titre + MOISG.tete + lignes * MOISG.ligneDouble <= UTILE) : [b];
      for (const m of morceaux) {
        const h = hauteurMois(m);
        if (page.length && prise + MOISG.ecart + h > UTILE) tourner();
        prise += (page.length ? MOISG.ecart : 0) + h;
        page.push(m);
      }
    }
    tourner();
    // La place qui reste sur une page est rendue aux lignes, dans la limite d'une hauteur confortable.
    for (const p of pages) {
      const lignes = p.blocs.reduce((t, b) => t + lignesDe(b), 0);
      const prise2 = p.blocs.reduce((t, b, i) => t + (i ? MOISG.ecart : 0) + hauteurMois(b), 0);
      const plus = Math.min(MOISG.aere - MOISG.ligne, Math.floor(((UTILE - 3 - prise2) / Math.max(lignes, 1)) * 10) / 10);
      if (plus > 0) p.blocs = p.blocs.map((b) => ({ ...b, groupes: b.groupes.map((g) => ({ ...g, lignes: g.lignes.map((l) => ({ ...l, hauteur: Math.round((l.hauteur + plus) * 10) / 10 })) })) }));
    }
  }
  return { periode: o.periode, titre, sousTitre, pages, brouillon: blocs.some((b) => b.etat === 'brouillon'), vide: blocs.every((b) => b.etat === 'vide' || b.etat === 'non_publie') };
}

/** « 8h30 » : l'heure au plus court, pour la vue mois. */
export const heureCourte = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
};
/** La géométrie de la vue mois, pour la feuille. */
export const GEOMETRIE = { semaine: SEMAINE, mois: MOISG, utile: UTILE } as const;
