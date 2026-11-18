import { addDays, dayIndex, mondayOf, uid } from '../domain/time';
import type { AppData, ISODate, Officine, ReglagePublication, Shift } from '../domain/types';
import { ouverture, shiftsSemaine } from './core';
import { generer } from './generate';

/**
 * Le planning se transmet au mois. Une échéance le rappelle ; passé cette échéance, Solvéa peut préparer
 * les semaines restées vides d'après les habitudes de la pharmacie. Il ne touche jamais une semaine
 * commencée à la main, et ne publie rien : le titulaire relit, corrige, puis publie.
 */
export const PUBLICATION_DEFAUT: ReglagePublication = { delai: 14, rappel: 7, relais: true };
export const reglagePublication = (o: Pick<Officine, 'publication'>): ReglagePublication => ({ ...PUBLICATION_DEFAUT, ...o.publication });

/** Combien de semaines publiées servent de référence pour retrouver les habitudes. */
export const SEMAINES_DE_REFERENCE = 8;

const moisSuivant = (date: ISODate): string => {
  const [a, m] = date.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const dernierJour = (mois: string): ISODate => {
  const [a, m] = mois.split('-').map(Number);
  return `${mois}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/** Les lundis des semaines qui touchent ce mois. */
export function semainesDuMois(mois: string): ISODate[] {
  const out: ISODate[] = [];
  for (let l = mondayOf(`${mois}-01`); l <= dernierJour(mois); l = addDays(l, 7)) out.push(l);
  return out;
}

export type EtatSemaine = 'publie' | 'brouillon' | 'vide';
export interface EtatPublication {
  /** Le mois à transmettre : le mois suivant. */
  mois: string;
  /** Dernier jour pour le publier. */
  echeance: ISODate;
  /** Premier jour du rappel. */
  rappelLe: ISODate;
  /** Jours restants avant l'échéance ; négatif une fois dépassée. */
  jours: number;
  semaines: { monday: ISODate; etat: EtatSemaine; auto: boolean }[];
  /** Semaines qui ne sont pas encore publiées. */
  restantes: number;
  /** Semaines sans aucun poste : celles que Solvéa peut préparer. */
  vides: number;
  /** Où l'on en est : tout est publié, rien ne presse, le rappel court, ou l'échéance est dépassée. */
  etat: 'publie' | 'tranquille' | 'rappel' | 'depasse';
}

/** Où en est la publication du mois suivant, à cette date. */
export function etatPublication(data: AppData, today: ISODate): EtatPublication {
  const r = reglagePublication(data.officine);
  const mois = moisSuivant(today);
  const echeance = addDays(`${mois}-01`, -r.delai);
  const rappelLe = addDays(echeance, -r.rappel);
  const semaines = semainesDuMois(mois)
    .filter((monday) => addDays(monday, 6) >= today)
    .map((monday) => {
      const s = data.semaines[monday];
      const etat: EtatSemaine = s?.statut === 'publie' ? 'publie' : shiftsSemaine(data, monday).length ? 'brouillon' : 'vide';
      return { monday, etat, auto: !!s?.auto && etat !== 'publie' };
    });
  const restantes = semaines.filter((s) => s.etat !== 'publie').length;
  const jours = dayIndex(echeance) - dayIndex(today);
  return { mois, echeance, rappelLe, jours, semaines, restantes, vides: semaines.filter((s) => s.etat === 'vide').length, etat: !restantes ? 'publie' : jours < 0 ? 'depasse' : today >= rappelLe ? 'rappel' : 'tranquille' };
}

/**
 * La semaine telle que la pharmacie a l'habitude de la faire : pour chaque personne et chaque jour, sa journée
 * la plus fréquente sur les dernières semaines publiées. Un jour travaillé moins d'une semaine sur deux reste
 * un repos ; un jour fermé ou une absence approuvée ne reçoit rien. Sans assez d'historique : aucune habitude.
 */
export function semaineHabituelle(data: AppData, monday: ISODate): Shift[] {
  const passees = Object.entries(data.semaines)
    .filter(([lundi, s]) => lundi < monday && s.statut === 'publie')
    .map(([lundi]) => lundi)
    .sort()
    .reverse()
    .slice(0, SEMAINES_DE_REFERENCE);
  if (passees.length < 2) return [];
  const forme = (l: Shift[]): string =>
    l
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((s) => `${s.start}-${s.end}`)
      .join('|');
  const out: Shift[] = [];
  for (const p of data.personnes.filter((x) => !x.externe)) {
    for (let j = 0; j < 7; j++) {
      const date = addDays(monday, j);
      if (!ouverture(data.officine, date).length) continue;
      if (data.absences.some((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= date && date <= a.to)) continue;
      // Ce que la personne a fait ce jour-là, semaine après semaine, de la plus récente à la plus ancienne.
      const journees = passees.map((lundi) => (data.semaines[lundi]?.snapshot ?? data.shifts).filter((s) => s.personId === p.id && s.date === addDays(lundi, j)));
      const travaillees = journees.filter((l) => l.length > 0);
      if (travaillees.length * 2 < passees.length) continue;
      const compte = new Map<string, number>();
      for (const l of travaillees) compte.set(forme(l), (compte.get(forme(l)) ?? 0) + 1);
      // À égalité, la forme la plus récente l'emporte : c'est la première rencontrée.
      const habituelle = [...compte.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const modele = travaillees.find((l) => forme(l) === habituelle) ?? [];
      for (const s of modele) {
        out.push({ ...s, id: uid('s'), date, explication: `Repris de vos habitudes : c’est sa journée la plus fréquente ce jour-là sur vos ${passees.length} dernières semaines publiées.` });
      }
    }
  }
  return out;
}

/**
 * Prépare les semaines du mois restées vides. D'abord d'après les habitudes ; sans historique suffisant,
 * d'après le calcul habituel (équité d'abord). Une semaine qui a déjà un poste n'est jamais touchée :
 * le planning fait à la main passe avant.
 */
export function preparerMois(data: AppData, today: ISODate, mois: string, at: string): { data: AppData; semaines: ISODate[]; habitudes: number } {
  let next = data;
  const faites: ISODate[] = [];
  let habitudes = 0;
  for (const monday of semainesDuMois(mois)) {
    if (addDays(monday, 6) < today || next.semaines[monday]?.statut === 'publie' || shiftsSemaine(next, monday).length) continue;
    const habituelle = semaineHabituelle(next, monday);
    const postes = habituelle.length ? habituelle : generer(next, monday, { variante: 'equite', graine: 7 }).shifts;
    if (!postes.length) continue;
    if (habituelle.length) habitudes++;
    next = { ...next, shifts: next.shifts.concat(postes), semaines: { ...next.semaines, [monday]: { statut: 'brouillon', auto: at } } };
    faites.push(monday);
  }
  return { data: next, semaines: faites, habitudes };
}
