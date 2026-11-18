import {
  absMin,
  addDays,
  dayIndex,
  ferie,
  fmtHeure,
  mondayOf,
  subtract,
  union,
  weekday,
} from '../domain/time';
import type { AppData, Besoin, Garde, ISODate, Interval, Mission, Officine, Person, Shift, Souhait } from '../domain/types';
import { estPharmacien } from '../domain/types';

/** Segments réellement travaillés d'un poste : le poste moins sa pause. */
export function segmentsTravail(s: Pick<Shift, 'start' | 'end' | 'pauseStart' | 'pauseEnd'>): Interval[] {
  const base = [{ start: s.start, end: s.end }];
  if (s.pauseStart === undefined || s.pauseEnd === undefined) return base;
  return subtract(base, [{ start: s.pauseStart, end: s.pauseEnd }]);
}

export function minutesTravail(s: Pick<Shift, 'start' | 'end' | 'pauseStart' | 'pauseEnd'>): number {
  return segmentsTravail(s).reduce((t, i) => t + (i.end - i.start), 0);
}

/** Plages d'ouverture d'une date ; vide si l'officine ferme les jours fériés. */
export function ouverture(officine: Officine, date: ISODate): Interval[] {
  if (officine.fermeJoursFeries && ferie(date)) return [];
  return officine.horaires[weekday(date)] ?? [];
}

export function fermetureDuJour(officine: Officine, date: ISODate): number | null {
  const o = ouverture(officine, date);
  return o.length ? o[o.length - 1].end : null;
}

export function ouvertureDuJour(officine: Officine, date: ISODate): number | null {
  const o = ouverture(officine, date);
  return o.length ? o[0].start : null;
}

/** Un poste « ferme » s'il se termine à la fermeture de l'officine. */
export function estFermeture(officine: Officine, s: Pick<Shift, 'date' | 'end'>): boolean {
  const f = fermetureDuJour(officine, s.date);
  return f !== null && s.end >= f;
}

export function estOuverture(officine: Officine, s: Pick<Shift, 'date' | 'start'>): boolean {
  const o = ouvertureDuJour(officine, s.date);
  return o !== null && s.start <= o;
}

// ------------------------------------------------------------------ Gardes

export function gardeDuree(g: Pick<Garde, 'start' | 'end'>): number {
  return g.end > g.start ? g.end - g.start : g.end + 1440 - g.start;
}

export function gardeAbs(g: Pick<Garde, 'date' | 'start' | 'end'>): Interval {
  const start = absMin(g.date, g.start);
  return { start, end: start + gardeDuree(g) };
}

export function gardeFinDate(g: Pick<Garde, 'date' | 'start' | 'end'>): ISODate {
  return g.end > g.start ? g.date : addDays(g.date, 1);
}

// ------------------------------------------------------------- Occupations

export interface Occupation extends Interval {
  /** Journée de rattachement : sert à distinguer une coupure d'un repos entre deux journées. */
  date: ISODate;
  nature: 'poste' | 'garde' | 'intervention';
  label: string;
}

/**
 * Périodes pendant lesquelles une personne n'est pas en repos, en minutes absolues.
 * Une astreinte à domicile sans intervention n'interrompt pas le repos ; ses interventions, si.
 */
export function occupations(data: AppData, personId: string, from: ISODate, to: ISODate): Occupation[] {
  const lo = dayIndex(from);
  const hi = dayIndex(to);
  const out: Occupation[] = [];
  for (const s of data.shifts) {
    if (s.personId !== personId) continue;
    const di = dayIndex(s.date);
    if (di < lo || di > hi) continue;
    for (const seg of segmentsTravail(s)) {
      out.push({
        start: absMin(s.date, seg.start),
        end: absMin(s.date, seg.end),
        date: s.date,
        nature: 'poste',
        label: `poste ${fmtHeure(s.start)} – ${fmtHeure(s.end)}`,
      });
    }
  }
  for (const g of data.gardes) {
    if (g.personId !== personId) continue;
    const di = dayIndex(g.date);
    if (di < lo - 1 || di > hi) continue;
    const abs = gardeAbs(g);
    if (g.type === 'astreinte') {
      for (const it of g.interventions) {
        out.push({
          start: abs.start + it.offset,
          end: abs.start + it.offset + it.duree,
          date: g.date,
          nature: 'intervention',
          label: 'intervention pendant une astreinte',
        });
      }
    } else {
      out.push({ ...abs, date: g.date, nature: 'garde', label: `garde ${fmtHeure(g.start)} – ${fmtHeure(g.end)}` });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------- Absences et besoins

export function estAbsent(data: Pick<AppData, 'absences'>, personId: string, date: ISODate): boolean {
  return data.absences.some(
    (a) => a.personId === personId && a.statut === 'approuvee' && a.from <= date && date <= a.to,
  );
}

/** Le besoin s'applique-t-il à cette date (période, jour, parité de semaine) ? */
export function besoinApplicable(b: Besoin, date: ISODate): boolean {
  if (b.decision !== 'acceptee') return false;
  if (b.from && date < b.from) return false;
  if (b.to && date > b.to) return false;
  if (!b.jours.includes(weekday(date))) return false;
  if (b.frequence === 2) {
    const ref = b.semaineRef ?? b.from ?? '2026-01-05';
    const weeks = Math.round((dayIndex(mondayOf(date)) - dayIndex(mondayOf(ref))) / 7);
    if (((weeks % 2) + 2) % 2 !== 0) return false;
  }
  return true;
}

/** Un poste contredit-il ce besoin ? (le besoin est supposé applicable à la date du poste) */
export function contreditBesoin(b: Besoin, s: Pick<Shift, 'start' | 'end'>): boolean {
  switch (b.forme) {
    case 'indisponible':
      if (b.plageStart === undefined || b.plageEnd === undefined) return true;
      return s.start < b.plageEnd && b.plageStart < s.end;
    case 'finir_avant':
      return b.heure !== undefined && s.end > b.heure;
    case 'commencer_apres':
      return b.heure !== undefined && s.start < b.heure;
  }
}

/** Un souhait du mois vu comme une simple préférence : « matin » = finir tôt, « après-midi » = commencer tard, « repos » = ne pas venir. */
export function besoinDeSouhait(s: Souhait): Besoin | null {
  if (s.choix === 'journee') return null;
  const base = { id: `souhait:${s.personId}:${s.date}`, personId: s.personId, jours: [weekday(s.date)], frequence: 1 as const, from: s.date, to: s.date, statut: 'preference' as const, horsPlafond: false, decision: 'acceptee' as const, createdAt: s.date };
  if (s.choix === 'repos') return { ...base, forme: 'indisponible' };
  return s.choix === 'matin' ? { ...base, forme: 'finir_avant', heure: 14 * 60 + 30 } : { ...base, forme: 'commencer_apres', heure: 11 * 60 + 30 };
}

export function besoinsDe(data: Pick<AppData, 'besoins' | 'souhaits'>, personId: string, date: ISODate): Besoin[] {
  const liste = data.besoins.filter((b) => b.personId === personId && besoinApplicable(b, date));
  const souhait = data.souhaits?.find((s) => s.personId === personId && s.date === date);
  const b = souhait ? besoinDeSouhait(souhait) : null;
  return b ? liste.concat(b) : liste;
}

export function decrireBesoin(b: Besoin): string {
  const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const quand =
    b.jours.length === 7
      ? 'tous les jours'
      : b.jours
          .slice()
          .sort((x, y) => x - y)
          .map((j) => jours[j])
          .join(', ');
  const rythme = b.frequence === 2 ? ' (une semaine sur deux)' : '';
  switch (b.forme) {
    case 'indisponible':
      return b.plageStart !== undefined && b.plageEnd !== undefined
        ? `Indisponible de ${fmtHeure(b.plageStart)} à ${fmtHeure(b.plageEnd)} — ${quand}${rythme}`
        : `Indisponible — ${quand}${rythme}`;
    case 'finir_avant':
      return `Finir avant ${fmtHeure(b.heure ?? 0)} — ${quand}${rythme}`;
    case 'commencer_apres':
      return `Commencer après ${fmtHeure(b.heure ?? 0)} — ${quand}${rythme}`;
  }
}

// ---------------------------------------------------------------- Présence

export const equipeInterne = (data: Pick<AppData, 'personnes'>): Person[] =>
  data.personnes.filter((p) => !p.externe);

export function shiftsDuJour(data: Pick<AppData, 'shifts'>, date: ISODate): Shift[] {
  return data.shifts.filter((s) => s.date === date);
}

/** Présence physique dans l'officine : un poste en formation extérieure ne compte pas. */
const surPlace = (s: Shift): boolean => s.activite !== 'formation';

/**
 * Intervalles où au moins un pharmacien est présent dans l'officine. Titulaires et adjoints sont pharmaciens.
 * Un titulaire reste sur place et responsable pendant sa pause : tant qu'il est en poste, il ne manque
 * aucun pharmacien. La pause d'un adjoint salarié, elle, est un temps où il n'est plus à disposition.
 */
export function presencePharmaciens(data: Pick<AppData, 'shifts' | 'personnes'>, date: ISODate): Interval[] {
  const pharmaciens = new Map(data.personnes.filter(estPharmacien).map((p) => [p.id, p.qualification]));
  const segs: Interval[] = [];
  for (const s of data.shifts) {
    const qualification = pharmaciens.get(s.personId);
    if (s.date !== date || !qualification || !surPlace(s)) continue;
    if (qualification === 'titulaire') segs.push({ start: s.start, end: s.end });
    else segs.push(...segmentsTravail(s));
  }
  return union(segs);
}

/** Plages d'ouverture sans aucun pharmacien planifié. */
export function trousPharmacien(data: Pick<AppData, 'shifts' | 'personnes' | 'officine'>, date: ISODate): Interval[] {
  return subtract(ouverture(data.officine, date), presencePharmaciens(data, date));
}

/** Une plage sans pharmacien, et pourquoi : la pause d'un pharmacien, son départ, son arrivée. */
export interface TrouExplique extends Interval {
  raison: string;
}

/**
 * Les plages d'ouverture sans pharmacien, expliquées. Titulaires et adjoints sont tous pharmaciens :
 * `aucun` dit qu'aucun d'eux n'a de poste ce jour-là ; sinon chaque plage dit ce qui la crée.
 */
export function trousPharmacienExpliques(data: Pick<AppData, 'shifts' | 'personnes' | 'officine'>, date: ISODate): { aucun: boolean; trous: TrouExplique[] } {
  const pharmaciens = new Map(data.personnes.filter(estPharmacien).map((p) => [p.id, p.prenom]));
  const postes = data.shifts.filter((s) => s.date === date && pharmaciens.has(s.personId) && surPlace(s));
  /** « de Caroline », « d’Igor ». */
  const de = (s: Shift): string => {
    const prenom = pharmaciens.get(s.personId);
    return !prenom ? 'd’un pharmacien' : /^[aeiouyhàâéèêîôûAEIOUYHÀÂÉÈÊÎÔÛ]/.test(prenom) ? `d’${prenom}` : `de ${prenom}`;
  };
  const trous = trousPharmacien(data, date).map((t) => {
    const enPause = postes.find((s) => s.pauseStart !== undefined && s.pauseEnd !== undefined && s.pauseStart <= t.start && s.pauseEnd >= t.end);
    if (enPause) return { ...t, raison: `pause ${de(enPause)}` };
    const avant = postes.filter((s) => s.end <= t.start).sort((a, b) => b.end - a.end)[0];
    const apres = postes.filter((s) => s.start >= t.end).sort((a, b) => a.start - b.start)[0];
    if (avant && !apres) return { ...t, raison: `après le départ ${de(avant)}` };
    if (apres && !avant) return { ...t, raison: `avant l’arrivée ${de(apres)}` };
    return { ...t, raison: avant && apres ? 'entre deux postes' : '' };
  });
  return { aucun: postes.length === 0, trous };
}

function missionsDe(missions: Mission[], personId: string, date: ISODate): Interval[] {
  return missions
    .filter((m) => m.personId === personId && m.date === date)
    .map((m) => ({ start: m.start, end: m.end }));
}

/** Plages où tous les pharmaciens présents sont pris par une activité à rendez-vous. */
export function pharmacienSeulEnRendezVous(
  data: Pick<AppData, 'shifts' | 'personnes' | 'missions' | 'officine'>,
  date: ISODate,
): Interval[] {
  const pharmaciens = data.personnes.filter(estPharmacien);
  const libres: Interval[] = [];
  for (const p of pharmaciens) {
    const presence = data.shifts
      .filter((s) => s.date === date && s.personId === p.id && surPlace(s))
      .flatMap(segmentsTravail);
    libres.push(...subtract(presence, missionsDe(data.missions, p.id, date)));
  }
  const present = presencePharmaciens(data, date);
  const couvertMaisOccupe = subtract(present, libres);
  const o = ouverture(data.officine, date);
  return couvertMaisOccupe.flatMap((i) =>
    o.map((x) => ({ start: Math.max(i.start, x.start), end: Math.min(i.end, x.end) })).filter((x) => x.end > x.start),
  );
}

/** Nombre de personnes disponibles au comptoir à une minute donnée. */
export function effectifComptoir(
  data: Pick<AppData, 'shifts' | 'missions'>,
  date: ISODate,
  minute: number,
): number {
  let n = 0;
  for (const s of data.shifts) {
    if (s.date !== date || s.activite !== 'comptoir') continue;
    if (!segmentsTravail(s).some((i) => i.start <= minute && minute < i.end)) continue;
    const pris = data.missions.some(
      (m) => m.personId === s.personId && m.date === date && m.start <= minute && minute < m.end,
    );
    if (!pris) n++;
  }
  return n;
}

export interface SousEffectif extends Interval {
  present: number;
  requis: number;
}

/** Tranches où l'effectif au comptoir est inférieur au seuil de l'officine, par pas de 30 minutes. */
export function sousEffectifs(
  data: Pick<AppData, 'shifts' | 'missions' | 'officine'>,
  date: ISODate,
): SousEffectif[] {
  const wd = weekday(date);
  const out: SousEffectif[] = [];
  for (const o of ouverture(data.officine, date)) {
    for (let t = o.start; t < o.end; t += 30) {
      let requis = 0;
      for (const b of data.officine.effectifs) {
        if (b.jours.includes(wd) && b.start <= t && t < b.end) requis = Math.max(requis, b.minEquipe);
      }
      if (requis === 0) continue;
      const present = effectifComptoir(data, date, t);
      if (present >= requis) continue;
      const end = Math.min(t + 30, o.end);
      const last = out[out.length - 1];
      if (last && last.end === t && last.present === present && last.requis === requis) last.end = end;
      else out.push({ start: t, end, present, requis });
    }
  }
  return out;
}

/** Effectif requis à une minute donnée (0 hors ouverture). */
export function effectifRequis(officine: Officine, date: ISODate, minute: number): number {
  if (!ouverture(officine, date).some((o) => o.start <= minute && minute < o.end)) return 0;
  const wd = weekday(date);
  let requis = 0;
  for (const b of officine.effectifs) {
    if (b.jours.includes(wd) && b.start <= minute && minute < b.end) requis = Math.max(requis, b.minEquipe);
  }
  return requis;
}

/** Minutes planifiées d'une personne sur une semaine. */
export function minutesSemaine(data: Pick<AppData, 'shifts'>, personId: string, monday: ISODate): number {
  const lo = dayIndex(monday);
  let t = 0;
  for (const s of data.shifts) {
    if (s.personId !== personId) continue;
    const di = dayIndex(s.date);
    if (di >= lo && di < lo + 7) t += minutesTravail(s);
  }
  return t;
}

export function shiftsSemaine(data: Pick<AppData, 'shifts'>, monday: ISODate): Shift[] {
  const lo = dayIndex(monday);
  return data.shifts.filter((s) => {
    const di = dayIndex(s.date);
    return di >= lo && di < lo + 7;
  });
}

export function decrireShift(s: Pick<Shift, 'start' | 'end' | 'pauseStart' | 'pauseEnd'> | undefined): string {
  if (!s) return 'Repos';
  const pause =
    s.pauseStart !== undefined && s.pauseEnd !== undefined
      ? ` (pause ${fmtHeure(s.pauseStart)} – ${fmtHeure(s.pauseEnd)})`
      : '';
  return `${fmtHeure(s.start)} – ${fmtHeure(s.end)}${pause}`;
}

export function decrireJournee(shifts: Shift[]): string {
  if (!shifts.length) return 'Repos';
  return shifts
    .slice()
    .sort((a, b) => a.start - b.start)
    .map(decrireShift)
    .join(' + ');
}
