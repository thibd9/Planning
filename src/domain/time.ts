import type { ISODate, Interval, Minutes } from './types';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Numéro de jour absolu (jours depuis 1970-01-01), indépendant du fuseau. */
export function dayIndex(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromDayIndex(idx: number): ISODate {
  const d = new Date(idx * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export const addDays = (date: ISODate, n: number): ISODate => fromDayIndex(dayIndex(date) + n);

/** 0 = lundi … 6 = dimanche. */
export function weekday(date: ISODate): number {
  return (((dayIndex(date) + 3) % 7) + 7) % 7;
}

export const mondayOf = (date: ISODate): ISODate => addDays(date, -weekday(date));

export const weekDates = (monday: ISODate): ISODate[] =>
  Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export function todayISO(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Minutes absolues (heure locale « naïve ») : sert à mesurer les repos entre deux postes. */
export const absMin = (date: ISODate, minute: Minutes): number => dayIndex(date) * 1440 + minute;

export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const JOURS_COURT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
export const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 8 h 30 », « 14 h ». */
export function fmtHeure(min: Minutes): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${pad(r)}`;
}

/** « 08:30 », pour les champs de saisie et les exports. */
export function fmtHHMM(min: Minutes): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function parseHHMM(s: string): Minutes | null {
  const m = /^(\d{1,2})[:h](\d{2})?$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

/** « 7 h 30 » pour une durée ; « 35 h » si ronde. */
export function fmtDuree(min: number): string {
  const sign = min < 0 ? '−' : '';
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60);
  const r = a % 60;
  return r === 0 ? `${sign}${h} h` : `${sign}${h} h ${pad(r)}`;
}

/** Heures décimales à la française : « 7,5 ». */
export function fmtDecimal(n: number, digits = 2): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtEuros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function fmtDateLong(date: ISODate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${JOURS[weekday(date)]} ${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${y}`;
}

export function fmtDateCourt(date: ISODate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${JOURS_COURT[weekday(date)]} ${d === 1 ? '1er' : d} ${MOIS[m - 1]}`;
}

export function fmtJourMois(date: ISODate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MOIS[m - 1]}`;
}

export function fmtSemaine(monday: ISODate): string {
  const end = addDays(monday, 6);
  const [, m1, d1] = monday.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  const debut = m1 === m2 ? `${d1 === 1 ? '1er' : d1}` : `${d1 === 1 ? '1er' : d1} ${MOIS[m1 - 1]}`;
  return `${debut} – ${d2} ${MOIS[m2 - 1]} ${y2}`;
}

export function fmtHorodatage(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} à ${fmtHeure(
    d.getHours() * 60 + d.getMinutes(),
  )}`;
}

/** Numéro de semaine ISO. */
export function isoWeek(date: ISODate): number {
  const thursday = dayIndex(date) - weekday(date) + 3;
  const year = Number(fromDayIndex(thursday).slice(0, 4));
  const jan4 = dayIndex(`${year}-01-04`);
  const week1Monday = jan4 - weekday(fromDayIndex(jan4));
  return Math.floor((thursday - week1Monday) / 7) + 1;
}

// ---------------------------------------------------------------- Intervalles

export const duree = (i: Interval): number => Math.max(0, i.end - i.start);

/** Union triée d'intervalles ; les intervalles vides sont ignorés. */
export function union(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ start: i.start, end: i.end });
  }
  return out;
}

/** base \ retraits. */
export function subtract(base: Interval[], retraits: Interval[]): Interval[] {
  const cuts = union(retraits);
  const out: Interval[] = [];
  for (const b of union(base)) {
    let cursor = b.start;
    for (const c of cuts) {
      if (c.end <= cursor) continue;
      if (c.start >= b.end) break;
      if (c.start > cursor) out.push({ start: cursor, end: Math.min(c.start, b.end) });
      cursor = Math.max(cursor, c.end);
      if (cursor >= b.end) break;
    }
    if (cursor < b.end) out.push({ start: cursor, end: b.end });
  }
  return out;
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of union(a)) {
    for (const y of union(b)) {
      const s = Math.max(x.start, y.start);
      const e = Math.min(x.end, y.end);
      if (e > s) out.push({ start: s, end: e });
    }
  }
  return out;
}

export const totalDuree = (list: Interval[]): number => union(list).reduce((s, i) => s + duree(i), 0);

export const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

// ------------------------------------------------------------- Jours fériés

function paques(year: number): ISODate {
  // Algorithme de Meeus / Jones / Butcher (calendrier grégorien).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const feriesCache = new Map<number, Map<ISODate, string>>();

/** Jours fériés légaux en France métropolitaine. */
export function joursFeries(year: number): Map<ISODate, string> {
  const cached = feriesCache.get(year);
  if (cached) return cached;
  const p = paques(year);
  const map = new Map<ISODate, string>([
    [`${year}-01-01`, "Jour de l'an"],
    [addDays(p, 1), 'Lundi de Pâques'],
    [`${year}-05-01`, 'Fête du Travail'],
    [`${year}-05-08`, 'Victoire 1945'],
    [addDays(p, 39), 'Ascension'],
    [addDays(p, 50), 'Lundi de Pentecôte'],
    [`${year}-07-14`, 'Fête nationale'],
    [`${year}-08-15`, 'Assomption'],
    [`${year}-11-01`, 'Toussaint'],
    [`${year}-11-11`, 'Armistice 1918'],
    [`${year}-12-25`, 'Noël'],
  ]);
  feriesCache.set(year, map);
  return map;
}

export const ferie = (date: ISODate): string | undefined =>
  joursFeries(Number(date.slice(0, 4))).get(date);

export const estPremierMai = (date: ISODate): boolean => date.endsWith('-05-01');

// -------------------------------------------------------- Changement d'heure

function dernierDimanche(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0)); // dernier jour du mois (month est 1-based)
  return last.getUTCDate() - last.getUTCDay();
}

/**
 * Décalage de Paris par rapport à UTC, en minutes, pour une heure locale donnée.
 * Heure d'été : du dernier dimanche de mars (2 h -> 3 h) au dernier dimanche d'octobre (3 h -> 2 h).
 */
export function decalageParis(date: ISODate, minute: Minutes): number {
  const [y, m, d] = date.split('-').map(Number);
  const local = Date.UTC(y, m - 1, d) / 60_000 + minute;
  const debutEte = Date.UTC(y, 2, dernierDimanche(y, 3)) / 60_000 + 120;
  const finEte = Date.UTC(y, 9, dernierDimanche(y, 10)) / 60_000 + 180;
  return local >= debutEte && local < finEte ? 120 : 60;
}

/**
 * Durée réellement écoulée entre deux instants locaux, changement d'heure compris.
 * Une garde de 20 h à 8 h dure 13 h la nuit du passage à l'heure d'hiver, 11 h au printemps.
 */
export function dureeReelle(d1: ISODate, m1: Minutes, d2: ISODate, m2: Minutes): number {
  const naive = absMin(d2, m2) - absMin(d1, m1);
  return naive - (decalageParis(d2, m2) - decalageParis(d1, m1));
}

/** Nombre de jours ouvrables (lundi à samedi, hors fériés) strictement entre deux dates. */
export function joursOuvrablesEntre(from: ISODate, to: ISODate): number {
  let n = 0;
  for (let i = dayIndex(from) + 1; i <= dayIndex(to); i++) {
    const d = fromDayIndex(i);
    if (weekday(d) !== 6 && !ferie(d)) n++;
  }
  return n;
}

/** Nombre de jours ouvrés (lundi à vendredi, hors fériés) strictement entre deux dates. */
export function joursOuvresEntre(from: ISODate, to: ISODate): number {
  let n = 0;
  for (let i = dayIndex(from) + 1; i <= dayIndex(to); i++) {
    const d = fromDayIndex(i);
    if (weekday(d) < 5 && !ferie(d)) n++;
  }
  return n;
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
