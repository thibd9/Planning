import { addDays, dayIndex, fmtHeure, mondayOf, weekDates, weekday } from '../domain/time';
import type { AppData, ISODate, Person } from '../domain/types';
import { estPharmacien } from '../domain/types';
import { estFermeture, estOuverture, minutesTravail } from './core';

export type CompteurCle = 'samedis' | 'fermetures' | 'gardes' | 'depannages' | 'changementsTardifs' | 'souhaitsRefuses';

export const COMPTEUR_LABEL: Record<CompteurCle, string> = {
  samedis: 'Samedis travaillés',
  fermetures: 'Fermetures en semaine',
  gardes: 'Gardes et astreintes',
  depannages: 'Dépannages assurés',
  changementsTardifs: 'Changements tardifs absorbés',
  souhaitsRefuses: 'Demandes refusées',
};

export interface LigneEquite {
  personId: string;
  /** Nombre réel d'occurrences sur la période. */
  reel: Record<CompteurCle, number>;
  /**
   * Part attendue : le total de l'équipe réparti au prorata du temps contractuel
   * et des semaines réellement travaillées, entre les personnes éligibles.
   */
  attendu: Record<CompteurCle, number | null>;
  semainesTravaillees: number;
  /** Le détail de ce qui est compté : chaque date, avec l'horaire quand il y en a un. Par ordre de date. */
  detail: Record<CompteurCle, FaitEquite[]>;
  /** Comment la part attendue est calculée ; `null` si la personne n'est pas concernée ou si rien ne se partage. */
  partage: Record<CompteurCle, PartageEquite | null>;
}

/** Un fait compté : un samedi travaillé, une fermeture, une garde… */
export interface FaitEquite {
  date: ISODate;
  precision?: string;
}

/** Le partage d'un compteur : le total de l'équipe, la part de la personne (de 0 à 1) et sur quoi elle repose. */
export interface PartageEquite {
  total: number;
  part: number;
  /** `contrat` : au prorata des heures du contrat et des semaines travaillées ; `egal` : à parts égales. */
  base: 'contrat' | 'egal';
  /** Nombre de personnes entre lesquelles on partage. */
  entre: number;
}

const CLES: CompteurCle[] = ['samedis', 'fermetures', 'gardes', 'depannages', 'changementsTardifs', 'souhaitsRefuses'];

/** Une personne est-elle éligible à ce type de créneau ? */
function eligible(data: AppData, p: Person, cle: CompteurCle): boolean {
  if (cle === 'gardes') return estPharmacien(p);
  if (cle === 'samedis') {
    // Une indisponibilité reconnue sur tous les samedis retire la personne du partage.
    return !data.besoins.some(
      (b) =>
        b.personId === p.id &&
        b.decision === 'acceptee' &&
        b.statut === 'reconnue' &&
        b.forme === 'indisponible' &&
        b.plageStart === undefined &&
        b.frequence === 1 &&
        b.jours.includes(5),
    );
  }
  return true;
}

/**
 * Mémoire d'équité sur une période. Plusieurs compteurs lisibles, jamais de note globale.
 * Les temps partiels sont comparés au prorata : on ne leur demande pas autant de samedis qu'à un temps plein.
 */
export function equite(data: AppData, from: ISODate, to: ISODate): LigneEquite[] {
  const lo = dayIndex(from);
  const hi = dayIndex(to);
  const personnes = data.personnes.filter((p) => !p.externe);
  const lignes = new Map<string, LigneEquite>();
  const semaines = new Map<string, Set<string>>();
  for (const p of personnes) {
    lignes.set(p.id, {
      personId: p.id,
      reel: { samedis: 0, fermetures: 0, gardes: 0, depannages: 0, changementsTardifs: 0, souhaitsRefuses: 0 },
      attendu: { samedis: 0, fermetures: 0, gardes: 0, depannages: 0, changementsTardifs: null, souhaitsRefuses: null },
      semainesTravaillees: 0,
      detail: { samedis: [], fermetures: [], gardes: [], depannages: [], changementsTardifs: [], souhaitsRefuses: [] },
      partage: { samedis: null, fermetures: null, gardes: null, depannages: null, changementsTardifs: null, souhaitsRefuses: null },
    });
    semaines.set(p.id, new Set());
  }

  const samedisVus = new Set<string>();
  for (const s of data.shifts) {
    const di = dayIndex(s.date);
    if (di < lo || di > hi) continue;
    const l = lignes.get(s.personId);
    if (!l) continue;
    semaines.get(s.personId)!.add(mondayOf(s.date));
    // Un poste repris au pied levé (absence couverte, remplacement) compte pour un dépannage.
    const horaire = `${fmtHeure(s.start)} – ${fmtHeure(s.end)}`;
    if (s.origine === 'reparation') {
      l.reel.depannages += 1;
      l.detail.depannages.push({ date: s.date, precision: horaire });
    }
    const wd = weekday(s.date);
    if (wd === 5) {
      const k = `${s.personId}|${s.date}`;
      if (!samedisVus.has(k)) {
        samedisVus.add(k);
        l.reel.samedis += 1;
        l.detail.samedis.push({ date: s.date, precision: horaire });
      }
    } else if (wd < 5 && estFermeture(data.officine, s)) {
      l.reel.fermetures += 1;
      l.detail.fermetures.push({ date: s.date, precision: `jusqu’à ${fmtHeure(s.end)}` });
    }
  }
  for (const g of data.gardes) {
    const di = dayIndex(g.date);
    if (di < lo || di > hi || !g.personId) continue;
    const l = lignes.get(g.personId);
    if (l) {
      l.reel.gardes += 1;
      l.detail.gardes.push({ date: g.date });
    }
  }
  for (const n of data.notifications) {
    const di = dayIndex(n.date);
    if (di < lo || di > hi || !n.tardif) continue;
    const l = lignes.get(n.personId);
    if (l) {
      l.reel.changementsTardifs += 1;
      l.detail.changementsTardifs.push({ date: n.date });
    }
  }
  for (const b of data.besoins) {
    if (b.decision !== 'refusee' || !b.decidedAt) continue;
    const di = dayIndex(b.decidedAt.slice(0, 10));
    if (di < lo || di > hi) continue;
    const l = lignes.get(b.personId);
    if (l) {
      l.reel.souhaitsRefuses += 1;
      l.detail.souhaitsRefuses.push({ date: b.decidedAt.slice(0, 10) });
    }
  }

  for (const p of personnes) lignes.get(p.id)!.semainesTravaillees = semaines.get(p.id)!.size;

  for (const cle of ['samedis', 'fermetures', 'gardes', 'depannages'] as const) {
    const eligibles = personnes.filter((p) => eligible(data, p, cle));
    const poids = (p: Person): number =>
      cle === 'gardes' ? 1 : p.heuresHebdo * Math.max(1, lignes.get(p.id)!.semainesTravaillees);
    const totalPoids = eligibles.reduce((t, p) => t + poids(p), 0);
    const total = eligibles.reduce((t, p) => t + lignes.get(p.id)!.reel[cle], 0);
    for (const p of personnes) {
      const concerne = eligibles.includes(p) && totalPoids > 0;
      lignes.get(p.id)!.attendu[cle] = concerne ? (total * poids(p)) / totalPoids : null;
      lignes.get(p.id)!.partage[cle] = concerne ? { total, part: poids(p) / totalPoids, base: cle === 'gardes' ? 'egal' : 'contrat', entre: eligibles.length } : null;
    }
  }
  for (const l of lignes.values()) for (const cle of CLES) l.detail[cle].sort((a, b) => a.date.localeCompare(b.date));
  return personnes.map((p) => lignes.get(p.id)!);
}

/** Écart type des écarts (réel − attendu) : plus il est faible, plus la répartition est équilibrée. */
export function ecartEquite(lignes: LigneEquite[], cle: CompteurCle): number {
  const ecarts = lignes.filter((l) => l.attendu[cle] !== null).map((l) => l.reel[cle] - (l.attendu[cle] as number));
  if (!ecarts.length) return 0;
  return Math.sqrt(ecarts.reduce((t, e) => t + e * e, 0) / ecarts.length);
}

export { CLES as COMPTEUR_CLES };

// ------------------------------------------------------------------ Fatigue

export interface Fatigue {
  personId: string;
  score: number;
  niveau: 'faible' | 'modérée' | 'élevée';
  /** Composantes lisibles du score : jamais une note opaque. */
  facteurs: { label: string; points: number }[];
}

/**
 * Indice de fatigue d'une semaine individuelle. C'est un repère d'organisation,
 * pas un avis médical : il additionne des enchaînements connus pour être éprouvants.
 */
export function fatigue(data: AppData, personId: string, monday: ISODate): Fatigue {
  const dates = weekDates(monday);
  const p = data.personnes.find((x) => x.id === personId);
  const facteurs: Fatigue['facteurs'] = [];
  const parJour = dates.map((d) => data.shifts.filter((s) => s.personId === personId && s.date === d));

  let enchainements = 0;
  for (let i = 0; i < 6; i++) {
    const soir = parJour[i].some((s) => estFermeture(data.officine, s));
    const matin = parJour[i + 1].some((s) => estOuverture(data.officine, s));
    if (soir && matin) enchainements++;
  }
  if (enchainements) {
    facteurs.push({
      label: `${enchainements} fermeture${enchainements > 1 ? 's' : ''} suivie${enchainements > 1 ? 's' : ''} d'une ouverture`,
      points: enchainements * 2,
    });
  }

  const joursTravailles = parJour.filter((l) => l.length).length;
  if (joursTravailles >= 6) facteurs.push({ label: `${joursTravailles} jours travaillés dans la semaine`, points: 2 });

  const longues = parJour.filter((l) => {
    if (!l.length) return false;
    return Math.max(...l.map((s) => s.end)) - Math.min(...l.map((s) => s.start)) >= 600;
  }).length;
  if (longues) {
    facteurs.push({ label: `${longues} journée${longues > 1 ? 's' : ''} de 10 h d'amplitude ou plus`, points: longues });
  }

  const lo = dayIndex(monday);
  const gardes = data.gardes.filter(
    (g) => g.personId === personId && dayIndex(g.date) >= lo - 1 && dayIndex(g.date) < lo + 7,
  );
  const nuits = gardes.filter((g) => g.type !== 'astreinte').length;
  if (nuits) facteurs.push({ label: `${nuits} garde${nuits > 1 ? 's' : ''} sur place`, points: nuits * 3 });
  const interventions = gardes
    .filter((g) => g.type === 'astreinte')
    .reduce((t, g) => t + g.interventions.length, 0);
  if (interventions) {
    facteurs.push({
      label: `${interventions} intervention${interventions > 1 ? 's' : ''} pendant une astreinte`,
      points: interventions,
    });
  }

  const minutes = parJour.flat().reduce((t, s) => t + minutesTravail(s), 0);
  if (p && p.salarie && minutes > 44 * 60) facteurs.push({ label: 'Plus de 44 h planifiées', points: 2 });
  else if (p && p.salarie && minutes > p.heuresHebdo * 60 * 1.1) {
    facteurs.push({ label: 'Plus de 10 % au-dessus du contrat', points: 1 });
  }

  const score = facteurs.reduce((t, f) => t + f.points, 0);
  return { personId, score, niveau: score >= 6 ? 'élevée' : score >= 3 ? 'modérée' : 'faible', facteurs };
}

/** Fenêtre glissante de N semaines terminée la veille du lundi donné. */
export function periodeAvant(monday: ISODate, semaines: number): { from: ISODate; to: ISODate } {
  return { from: addDays(monday, -7 * semaines), to: addDays(monday, -1) };
}
