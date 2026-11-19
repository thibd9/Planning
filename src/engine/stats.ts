import { addDays, anciennete, dayIndex, fromDayIndex, mondayOf } from '../domain/time';
import type { AppData, CompetenceId, ISODate, Person, Qualification, TypeContrat } from '../domain/types';
import { COMPETENCE_FAMILLES, COMPETENCE_LABEL, CONTRAT_LABEL, contratDe } from '../domain/types';
import { equipeInterne, minutesSemaine } from './core';
import { equite } from './equity';
import { contratSemaine } from './heures';
import type { PointFort, PointFortCle } from './suivi';
import { pointsForts } from './suivi';

/**
 * Statistiques d'équipe : ce que les données déjà saisies disent de l'officine, sans rien inventer.
 * Quatre lectures : qui compose l'équipe, quelles compétences sont couvertes, quels points forts ont été
 * relevés, et quelques repères d'activité. Aucune note, aucun classement : les listes de personnes sont
 * toujours rendues par ordre alphabétique.
 */

/** Durée hebdomadaire d'un temps plein : sert à compter les équivalents temps plein. */
export const TEMPS_PLEIN = 35;

/** Les fonctions, dans l'ordre où l'écran « Équipe » les présente. */
const FONCTIONS: { cle: Qualification; un: string; plusieurs: string }[] = [
  { cle: 'titulaire', un: 'Titulaire', plusieurs: 'Titulaires' },
  { cle: 'adjoint', un: 'Pharmacien', plusieurs: 'Pharmaciens' },
  { cle: 'preparateur', un: 'Préparateur', plusieurs: 'Préparateurs' },
  { cle: 'animateur', un: 'Animateur', plusieurs: 'Animateurs' },
  { cle: 'apprenti', un: 'Apprenti', plusieurs: 'Apprentis' },
  { cle: 'etudiant', un: 'Étudiant', plusieurs: 'Étudiants' },
  { cle: 'rayonniste', un: 'Rayonniste', plusieurs: 'Rayonnistes' },
];

/** Les contrats, du plus durable au plus ponctuel. */
const CONTRATS: TypeContrat[] = ['non_salarie', 'cdi', 'cdd', 'apprentissage', 'professionnalisation', 'stage', 'remplacement'];

/** Les points forts, dans l'ordre où `pointsForts` les relève, avec leur intitulé. */
export const POINTS_FORTS: { cle: PointFortCle; titre: string }[] = [
  { cle: 'ponctuel', titre: 'Toujours à l’heure' },
  { cle: 'entraide', titre: 'Dépanne l’équipe' },
  { cle: 'volontaire', titre: 'Répond aux appels' },
  { cle: 'part', titre: 'Prend sa part' },
];

export interface EffectifFonction {
  qualification: Qualification;
  /** Au singulier ou au pluriel selon l'effectif : « Préparateurs ». */
  label: string;
  effectif: number;
  etp: number;
  personnes: string[];
}

export interface EffectifContrat {
  contrat: TypeContrat;
  label: string;
  effectif: number;
  personnes: string[];
}

export interface AncienneteEquipe {
  /** Personnes dont le jour d'entrée est renseigné (et déjà passé). */
  renseignees: number;
  /** Personnes de l'équipe sans jour d'entrée connu : elles ne comptent pas dans la moyenne. */
  manquantes: number;
  /** Ancienneté moyenne en jours ; `null` si aucun jour d'entrée n'est renseigné. */
  moyenneJours: number | null;
  /** Le jour d'entrée « moyen » : l'ancienneté moyenne se lit avec `anciennete(moyenneDepuis, today)`. */
  moyenneDepuis: ISODate | null;
  /** L'ancienneté moyenne en clair : « 3 ans et 4 mois ». */
  moyenne: string | null;
  /** Le détail, par ordre alphabétique. */
  parPersonne: { personId: string; entreeLe: ISODate; libelle: string }[];
}

export interface Composition {
  /** Nombre de personnes de l'équipe, remplaçants extérieurs exclus. */
  effectif: number;
  /** Remplaçants habituels, extérieurs à l'équipe : comptés à part. */
  externes: number;
  /** Équivalents temps plein : heures du contrat sur 35, plafonnées à 1 par personne. */
  etp: number;
  /** Salariés de l'équipe : tout le monde, sauf un titulaire qui exerce à son compte. */
  salaries: number;
  /** Salariés dont le contrat est inférieur à 35 heures. */
  tempsPartiels: number;
  /** Les fonctions présentes dans l'équipe, dans l'ordre de l'écran « Équipe ». */
  parFonction: EffectifFonction[];
  /** Les contrats présents dans l'équipe. */
  parContrat: EffectifContrat[];
  anciennete: AncienneteEquipe;
}

/** `absente` : personne ne la détient ; `fragile` : une seule personne ; `couverte` : au moins deux. */
export type EtatCompetence = 'absente' | 'fragile' | 'couverte';

export interface CompetenceCouverte {
  cle: CompetenceId;
  label: string;
  /** Personnes de l'équipe qui la détiennent, par ordre alphabétique. */
  detenteurs: string[];
  nombre: number;
  etat: EtatCompetence;
  /** Remplaçants habituels qui la détiennent aussi : un appui possible, hors équipe. */
  renforts: string[];
}

export interface CouvertureCompetences {
  familles: { titre: string; competences: CompetenceCouverte[]; couvertes: number }[];
  /** Nombre de compétences suivies. */
  total: number;
  /** Compétences détenues par au moins une personne. */
  couvertes: number;
  /** Compétences que personne ne détient dans l'équipe. */
  absentes: CompetenceCouverte[];
  /** Compétences détenues par une seule personne : son absence suffit à les perdre. */
  fragiles: CompetenceCouverte[];
}

export interface StatsPointsForts {
  /** Un total par nature de point fort, les quatre natures toujours présentes. */
  totaux: { cle: PointFortCle; titre: string; nombre: number; personnes: string[] }[];
  /** Chaque personne de l'équipe hors titulaires, par ordre alphabétique, avec ses points forts (parfois aucun). */
  parPersonne: { personId: string; points: PointFort[] }[];
  /** Personnes pour lesquelles au moins un point fort est relevé. */
  avecPoint: number;
  /** Nombre total de points forts relevés. */
  total: number;
}

export interface HeuresPersonne {
  personId: string;
  /** Minutes planifiées sur les semaines retenues. */
  planifie: number;
  /** Minutes dues au contrat sur les mêmes semaines, absences approuvées déduites. */
  contrat: number;
  ecart: number;
}

export type CompteurActivite = 'samedis' | 'fermetures' | 'gardes' | 'depannages';
export const COMPTEURS_ACTIVITE: CompteurActivite[] = ['samedis', 'fermetures', 'gardes', 'depannages'];

export interface StatsActivite {
  heures: {
    /** Les lundis des semaines retenues : les quatre dernières publiées, de la plus ancienne à la plus récente. */
    semaines: ISODate[];
    planifie: number;
    contrat: number;
    ecart: number;
    /** Les salariés, par ordre alphabétique. Un titulaire non salarié est hors décompte. */
    parPersonne: HeuresPersonne[];
  };
  /** La fenêtre des compteurs : douze mois jusqu'à aujourd'hui. `premierPoste` : le plus ancien poste connu dans la fenêtre. */
  periode: { from: ISODate; to: ISODate; premierPoste: ISODate | null };
  /** Samedis, fermetures, gardes et dépannages de chacun sur douze mois, par ordre alphabétique. */
  compteurs: ({ personId: string } & Record<CompteurActivite, number>)[];
  totaux: Record<CompteurActivite, number>;
  /** Gardes programmées après aujourd'hui, dont celles qui n'ont encore personne. */
  gardesAVenir: { total: number; sansPersonne: number };
  /** Demandes de remplacement des douze derniers mois. */
  remplacements: { demandes: number; pourvues: number; enCours: number };
}

export interface StatsEquipe {
  composition: Composition;
  competences: CouvertureCompetences;
  pointsForts: StatsPointsForts;
  activite: StatsActivite;
}

const alphabetique = (a: Person, b: Person): number => a.prenom.localeCompare(b.prenom, 'fr') || a.nom.localeCompare(b.nom, 'fr');
const arrondi = (n: number): number => Math.round(n * 100) / 100;
const etpDe = (p: Person): number => Math.min(1, Math.max(0, p.heuresHebdo) / TEMPS_PLEIN);
const estDate = (d: string | undefined): d is ISODate => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

function composition(data: AppData, internes: Person[], today: ISODate): Composition {
  const parFonction = FONCTIONS.map((f) => {
    const membres = internes.filter((p) => p.qualification === f.cle);
    return { qualification: f.cle, label: membres.length > 1 ? f.plusieurs : f.un, effectif: membres.length, etp: arrondi(membres.reduce((t, p) => t + etpDe(p), 0)), personnes: membres.map((p) => p.id) };
  }).filter((f) => f.effectif > 0);
  const parContrat = CONTRATS.map((c) => {
    const membres = internes.filter((p) => contratDe(p) === c);
    return { contrat: c, label: CONTRAT_LABEL[c], effectif: membres.length, personnes: membres.map((p) => p.id) };
  }).filter((c) => c.effectif > 0);

  // L'ancienneté ne se calcule que pour les personnes dont le jour d'entrée est saisi et passé.
  const entrees = internes.flatMap((p) => (estDate(p.entreeLe) && p.entreeLe <= today ? [{ personId: p.id, entreeLe: p.entreeLe, libelle: anciennete(p.entreeLe, today) }] : []));
  const moyenneJours = entrees.length ? entrees.reduce((t, e) => t + (dayIndex(today) - dayIndex(e.entreeLe)), 0) / entrees.length : null;
  const moyenneDepuis = moyenneJours === null ? null : fromDayIndex(dayIndex(today) - Math.round(moyenneJours));

  return {
    effectif: internes.length,
    externes: data.personnes.length - internes.length,
    etp: arrondi(internes.reduce((t, p) => t + etpDe(p), 0)),
    salaries: internes.filter((p) => p.salarie).length,
    tempsPartiels: internes.filter((p) => p.salarie && p.heuresHebdo < TEMPS_PLEIN).length,
    parFonction,
    parContrat,
    anciennete: {
      renseignees: entrees.length,
      manquantes: internes.length - entrees.length,
      moyenneJours,
      moyenneDepuis,
      moyenne: moyenneDepuis === null ? null : anciennete(moyenneDepuis, today),
      parPersonne: entrees,
    },
  };
}

function competences(data: AppData, internes: Person[]): CouvertureCompetences {
  const externes = data.personnes.filter((p) => p.externe).sort(alphabetique);
  const familles = COMPETENCE_FAMILLES.map((f) => {
    const liste = f.cles.map((cle): CompetenceCouverte => {
      const detenteurs = internes.filter((p) => p.competences.includes(cle)).map((p) => p.id);
      return {
        cle,
        label: COMPETENCE_LABEL[cle],
        detenteurs,
        nombre: detenteurs.length,
        etat: detenteurs.length === 0 ? 'absente' : detenteurs.length === 1 ? 'fragile' : 'couverte',
        renforts: externes.filter((p) => p.competences.includes(cle)).map((p) => p.id),
      };
    });
    return { titre: f.titre, competences: liste, couvertes: liste.filter((c) => c.nombre > 0).length };
  });
  const toutes = familles.flatMap((f) => f.competences);
  return {
    familles,
    total: toutes.length,
    couvertes: toutes.filter((c) => c.nombre > 0).length,
    absentes: toutes.filter((c) => c.etat === 'absente'),
    fragiles: toutes.filter((c) => c.etat === 'fragile'),
  };
}

function forts(data: AppData, internes: Person[], today: ISODate): StatsPointsForts {
  // Les titulaires n'y figurent pas : ce sont eux qui consultent la page.
  const parPersonne = internes.filter((p) => p.qualification !== 'titulaire').map((p) => ({ personId: p.id, points: pointsForts(data, p.id, today) }));
  const totaux = POINTS_FORTS.map(({ cle, titre }) => {
    const personnes = parPersonne.filter((x) => x.points.some((pt) => pt.cle === cle)).map((x) => x.personId);
    // L'intitulé relevé par `pointsForts` fait foi ; celui de la liste ne sert que si personne ne l'a.
    const releve = parPersonne.flatMap((x) => x.points).find((pt) => pt.cle === cle);
    return { cle, titre: releve?.titre ?? titre, nombre: personnes.length, personnes };
  });
  return {
    totaux,
    parPersonne,
    avecPoint: parPersonne.filter((x) => x.points.length > 0).length,
    total: parPersonne.reduce((t, x) => t + x.points.length, 0),
  };
}

function activite(data: AppData, internes: Person[], today: ISODate): StatsActivite {
  const lundi = mondayOf(today);
  // Comme le compteur d'heures : les semaines publiées, jusqu'à la semaine en cours comprise.
  const semaines = Object.entries(data.semaines)
    .filter(([monday, s]) => s.statut === 'publie' && monday <= lundi)
    .map(([monday]) => monday)
    .sort()
    .slice(-4);
  const heuresParPersonne = internes
    .filter((p) => p.salarie)
    .map((p): HeuresPersonne => {
      const planifie = semaines.reduce((t, m) => t + minutesSemaine(data, p.id, m), 0);
      const contrat = semaines.reduce((t, m) => t + contratSemaine(data, p, m), 0);
      return { personId: p.id, planifie, contrat, ecart: planifie - contrat };
    });
  const planifie = heuresParPersonne.reduce((t, h) => t + h.planifie, 0);
  const contrat = heuresParPersonne.reduce((t, h) => t + h.contrat, 0);

  // Samedis, fermetures, gardes et dépannages : la mémoire d'équité les compte déjà, on la relit sur douze mois.
  const from = addDays(today, -365);
  const lignes = new Map(equite(data, from, today).map((l) => [l.personId, l.reel]));
  const compteurs = internes.map((p) => {
    const reel = lignes.get(p.id);
    return { personId: p.id, samedis: reel?.samedis ?? 0, fermetures: reel?.fermetures ?? 0, gardes: reel?.gardes ?? 0, depannages: reel?.depannages ?? 0 };
  });
  const total = (cle: CompteurActivite): number => compteurs.reduce((t, c) => t + c[cle], 0);
  const ids = new Set(internes.map((p) => p.id));
  const postes = data.shifts.filter((s) => ids.has(s.personId) && s.date >= from && s.date <= today).map((s) => s.date);
  const premierPoste = postes.length ? postes.reduce((a, b) => (a < b ? a : b)) : null;

  const aVenir = data.gardes.filter((g) => g.date > today);
  // Les demandes créées depuis douze mois, y compris celles qui portent sur un poste à venir.
  const demandes = data.remplacements.filter((r) => r.creeLe.slice(0, 10) >= from && r.statut !== 'annulee');

  return {
    heures: { semaines, planifie, contrat, ecart: planifie - contrat, parPersonne: heuresParPersonne },
    periode: { from, to: today, premierPoste },
    compteurs,
    totaux: { samedis: total('samedis'), fermetures: total('fermetures'), gardes: total('gardes'), depannages: total('depannages') },
    gardesAVenir: { total: aVenir.length, sansPersonne: aVenir.filter((g) => !g.personId).length },
    remplacements: {
      demandes: demandes.length,
      pourvues: demandes.filter((r) => r.statut === 'acceptee').length,
      enCours: demandes.filter((r) => r.statut === 'ouverte').length,
    },
  };
}

/** Les statistiques de l'équipe à une date donnée. Fonction pure : elle ne lit que `data`. */
export function statsEquipe(data: AppData, today: ISODate): StatsEquipe {
  const internes = equipeInterne(data).slice().sort(alphabetique);
  return {
    composition: composition(data, internes, today),
    competences: competences(data, internes),
    pointsForts: forts(data, internes, today),
    activite: activite(data, internes, today),
  };
}
