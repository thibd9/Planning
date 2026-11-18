import { addDays, dayIndex, mondayOf, weekday } from '../domain/time';
import type { AppData, ISODate, Officine, Person, Shift, Souhait, SouhaitChoix } from '../domain/types';
import { contreditBesoin, besoinDeSouhait, effectifComptoir, effectifRequis, equipeInterne, estAbsent, minutesSemaine, ouverture } from './core';
import { generer } from './generate';
import { semainesDuMois } from './payroll';
import { bloquants, validateWeek } from './validate';

/**
 * Préférences du mois (modèle collaboratif).
 * Chacun dit, jour par jour, la forme d'horaire qu'il préfère. Le calcul les traite comme de simples
 * préférences : ils ne passent jamais devant une règle impérative ni devant l'effectif attendu.
 */

const MIDI = 13 * 60;

export const moisDe = (date: ISODate): string => date.slice(0, 7);

export function moisDecale(mois: string, n: number): string {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function datesDuMois(mois: string): ISODate[] {
  const [y, m] = mois.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${mois}-${String(i + 1).padStart(2, '0')}`);
}

export const estCollaboratif = (o: Pick<Officine, 'modele'>): boolean => (o.modele ?? 'collaboratif') === 'collaboratif';

/** Dernier jour pour poser ses préférences d'un mois : le N du mois précédent (20 par défaut). */
export function limiteSouhaits(officine: Pick<Officine, 'souhaitsLimite'>, mois: string): ISODate {
  const precedent = datesDuMois(moisDecale(mois, -1));
  const n = Math.min(Math.max(1, officine.souhaitsLimite ?? 20), precedent.length);
  return precedent[n - 1];
}

/** Jours restants avant la clôture ; négatif une fois la collecte fermée. */
export const joursRestants = (officine: Pick<Officine, 'souhaitsLimite'>, mois: string, today: ISODate): number =>
  dayIndex(limiteSouhaits(officine, mois)) - dayIndex(today);

/** Premier mois dont la collecte est encore ouverte. */
export function moisACollecter(officine: Pick<Officine, 'souhaitsLimite'>, today: ISODate): string {
  const suivant = moisDecale(moisDe(today), 1);
  return joursRestants(officine, suivant, today) >= 0 ? suivant : moisDecale(suivant, 1);
}

export const souhaitDe = (data: Pick<AppData, 'souhaits'>, personId: string, date: ISODate): SouhaitChoix | undefined =>
  data.souhaits?.find((s) => s.personId === personId && s.date === date)?.choix;

/** Forme d'un poste, avec les mêmes bornes que les couleurs du planning. */
export function formePoste(s: Pick<Shift, 'start' | 'end'>): Exclude<SouhaitChoix, 'repos'> {
  if (s.end <= 14 * 60 + 30) return 'matin';
  if (s.start >= 11 * 60 + 30) return 'soir';
  return 'journee';
}

export interface DemiJournee {
  present: number;
  requis: number;
  /** Personnes qui se sont positionnées sur cette demi-journée. */
  qui: string[];
}

function requisEntre(officine: Officine, date: ISODate, de: number, a: number): number {
  let r = 0;
  for (let t = de; t < a; t += 30) r = Math.max(r, effectifRequis(officine, date, t));
  return r;
}

/** Effectif annoncé par les préférences de l'équipe, matin et après-midi, face au seuil de l'officine. */
export function effectifSouhaite(data: Pick<AppData, 'souhaits' | 'personnes' | 'officine' | 'absences'>, date: ISODate): { matin: DemiJournee; soir: DemiJournee } | null {
  const plages = ouverture(data.officine, date);
  if (!plages.length) return null;
  const debut = Math.min(...plages.map((p) => p.start));
  const fin = Math.max(...plages.map((p) => p.end));
  const matin: DemiJournee = { present: 0, requis: debut < MIDI ? requisEntre(data.officine, date, debut, Math.min(MIDI, fin)) : 0, qui: [] };
  const soir: DemiJournee = { present: 0, requis: fin > MIDI ? requisEntre(data.officine, date, Math.max(MIDI, debut), fin) : 0, qui: [] };
  for (const p of equipeInterne(data)) {
    if (estAbsent(data, p.id, date)) continue;
    const c = souhaitDe(data, p.id, date);
    if (c === 'matin' || c === 'journee') matin.qui.push(p.id);
    if (c === 'soir' || c === 'journee') soir.qui.push(p.id);
  }
  matin.present = matin.qui.length;
  soir.present = soir.qui.length;
  return { matin, soir };
}

/**
 * « M'assister » : remplit les jours encore vides d'après les habitudes de la personne
 * (ses postes des huit dernières semaines). Les choix déjà posés ne sont pas touchés.
 */
export function proposerSouhaits(data: AppData, person: Person, mois: string, today: ISODate): Souhait[] {
  const lundi = mondayOf(today);
  const parJour: Record<number, Record<string, number>> = {};
  let semaines = 0;
  for (let w = 1; w <= 8; w++) {
    const monday = addDays(lundi, -7 * w);
    const postes = data.shifts.filter((s) => s.personId === person.id && s.date >= monday && s.date <= addDays(monday, 6) && s.activite !== 'formation');
    if (!postes.length) continue;
    semaines++;
    for (const s of postes) {
      const wd = weekday(s.date);
      parJour[wd] = parJour[wd] ?? {};
      const f = formePoste(s);
      parJour[wd][f] = (parJour[wd][f] ?? 0) + 1;
    }
  }
  const joursVoulus = Math.max(1, Math.min(6, Math.round(person.heuresHebdo / 7)));
  const out: Souhait[] = [];
  for (const date of datesDuMois(mois)) {
    if (!ouverture(data.officine, date).length || estAbsent(data, person.id, date)) continue;
    if (souhaitDe(data, person.id, date)) continue;
    const wd = weekday(date);
    let choix: SouhaitChoix;
    if (semaines) {
      const vus = Object.entries(parJour[wd] ?? {}).sort((a, b) => b[1] - a[1]);
      const total = vus.reduce((t, x) => t + x[1], 0);
      choix = total * 2 >= semaines ? (vus[0][0] as SouhaitChoix) : 'repos';
    } else {
      choix = wd < joursVoulus ? 'journee' : 'repos';
    }
    out.push({ personId: person.id, date, choix });
  }
  return out;
}

/** Qui a déjà posé au moins un souhait pour ce mois. */
export function reponses(data: Pick<AppData, 'souhaits' | 'personnes'>, mois: string): { repondu: string[]; attendus: string[] } {
  const equipe = equipeInterne(data).map((p) => p.id);
  const vus = new Set((data.souhaits ?? []).filter((s) => moisDe(s.date) === mois).map((s) => s.personId));
  return { repondu: equipe.filter((id) => vus.has(id)), attendus: equipe.filter((id) => !vus.has(id)) };
}

/** Un souhait est-il respecté par les postes du jour ? */
export function souhaitRespecte(s: Souhait, postes: Pick<Shift, 'start' | 'end'>[]): boolean {
  if (s.choix === 'repos') return postes.length === 0;
  if (!postes.length) return false;
  const b = besoinDeSouhait(s);
  return !b || !postes.some((p) => contreditBesoin(b, p));
}

/** Heures planifiées d'une personne sur les semaines d'un mois, face à son contrat (absences approuvées déduites). */
export function heuresMois(data: AppData, person: Person, mois: string): { minutes: number; cible: number } {
  let minutes = 0;
  let cible = 0;
  for (const monday of semainesDuMois(mois)) {
    minutes += minutesSemaine(data, person.id, monday);
    let absents = 0;
    for (let i = 0; i < 5; i++) if (estAbsent(data, person.id, addDays(monday, i))) absents++;
    cible += person.heuresHebdo * 60 * (1 - absents / 5);
  }
  return { minutes, cible: Math.round(cible) };
}

/**
 * Heures du mois, jour par jour : ce qui est planifié face au contrat.
 * Le contrat ne compte que les jours ouvrés des semaines déjà construites, absences approuvées déduites,
 * pour ne pas afficher un « retard » sur des semaines qui n'ont pas encore de planning.
 */
export function planifieMois(data: AppData, person: Person, mois: string): { minutes: number; cible: number; construit: boolean } {
  let minutes = 0;
  let cible = 0;
  let construit = false;
  for (const s of data.shifts) {
    if (s.personId === person.id && s.date.startsWith(mois)) minutes += s.end - s.start - ((s.pauseEnd ?? 0) - (s.pauseStart ?? 0));
  }
  for (const monday of semainesDuMois(mois)) {
    const fin = addDays(monday, 6);
    if (!data.shifts.some((s) => s.date >= monday && s.date <= fin)) continue;
    construit = true;
    for (let i = 0; i < 5; i++) {
      const d = addDays(monday, i);
      if (d.startsWith(mois) && !estAbsent(data, person.id, d)) cible += (person.heuresHebdo * 60) / 5;
    }
  }
  return { minutes, cible: Math.round(cible), construit };
}

/** Objectif d'équipe du jour : l'effectif au comptoir au moment le plus tendu, face au seuil de l'officine. */
export function objectifJour(data: Pick<AppData, 'shifts' | 'missions' | 'officine'>, date: ISODate): { present: number; requis: number } | null {
  let pire: { present: number; requis: number } | null = null;
  for (const o of ouverture(data.officine, date)) {
    for (let t = o.start; t < o.end; t += 30) {
      const requis = effectifRequis(data.officine, date, t);
      if (!requis) continue;
      const present = effectifComptoir(data, date, t);
      if (!pire || present - requis < pire.present - pire.requis) pire = { present, requis };
    }
  }
  return pire;
}

export interface Correction {
  data: AppData;
  /** Semaines recalculées (brouillons) et semaines laissées telles quelles (déjà publiées). */
  corrigees: ISODate[];
  publiees: ISODate[];
  /** Souhaits que le planning n'a pas pu suivre, en moyenne par personne. */
  ecartsParPersonne: number;
  souhaitsSuivis: number;
  souhaitsTotal: number;
  bloquants: number;
}

/**
 * Recalcule d'un coup les semaines non publiées d'un mois en suivant les préférences au plus près.
 * Les règles impératives et l'effectif passent toujours avant ; les semaines publiées ne bougent pas.
 */
export function corrigerMois(data: AppData, mois: string): Correction {
  let d = data;
  const corrigees: ISODate[] = [];
  const publiees: ISODate[] = [];
  let nb = 0;
  for (const monday of semainesDuMois(mois)) {
    if (d.semaines[monday]?.statut === 'publie') {
      publiees.push(monday);
      continue;
    }
    const res = generer(d, monday, { variante: 'souhaits', graine: 7 });
    const fin = addDays(monday, 6);
    d = { ...d, shifts: d.shifts.filter((s) => s.date < monday || s.date > fin).concat(res.shifts) };
    corrigees.push(monday);
    nb += bloquants(validateWeek(d, monday)).length;
  }
  let total = 0;
  let suivis = 0;
  for (const s of d.souhaits ?? []) {
    if (!corrigees.includes(mondayOf(s.date)) || estAbsent(d, s.personId, s.date)) continue;
    total++;
    if (souhaitRespecte(s, d.shifts.filter((x) => x.personId === s.personId && x.date === s.date))) suivis++;
  }
  const equipe = equipeInterne(d).length || 1;
  return { data: d, corrigees, publiees, ecartsParPersonne: (total - suivis) / equipe, souhaitsSuivis: suivis, souhaitsTotal: total, bloquants: nb };
}
