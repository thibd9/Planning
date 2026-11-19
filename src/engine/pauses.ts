import { fmtHeure } from '../domain/time';
import type { PauseCourte, Shift } from '../domain/types';
import { segmentsTravail } from './core';

/**
 * Deux sortes de pauses dans un poste. La pause déjeuner coupe le poste : elle n'est pas comptée dans le temps de
 * travail. Les pauses courtes (dix à vingt minutes) se lisent sur le planning, à l'écran comme sur le papier,
 * sans changer le décompte des heures.
 */
export const DUREES_PAUSE = [10, 15, 20] as const;
/** Une demi-journée d'au moins cette durée reçoit une pause courte quand on demande une proposition. */
export const SEGMENT_AVEC_PAUSE = 180;
export const PAUSES_MAX = 4;

type Horaire = Pick<Shift, 'start' | 'end' | 'pauseStart' | 'pauseEnd'>;

/** Une pause courte au milieu de chaque demi-journée assez longue, calée sur le quart d'heure. */
export function pausesProposees(s: Horaire, duree: number = 15): PauseCourte[] {
  return segmentsTravail(s)
    .filter((i) => i.end - i.start >= SEGMENT_AVEC_PAUSE)
    .map((i) => {
      const debut = Math.round(((i.start + i.end) / 2 - duree / 2) / 15) * 15;
      return { start: debut, end: debut + duree };
    });
}

/** Ne garde que les pauses qui tiennent dans le temps de travail, rangées, sans chevauchement. */
export function pausesValides(s: Horaire, pauses: PauseCourte[] | undefined): PauseCourte[] {
  const segments = segmentsTravail(s);
  const out: PauseCourte[] = [];
  for (const p of [...(pauses ?? [])].sort((a, b) => a.start - b.start)) {
    if (p.end <= p.start || p.end - p.start > 30) continue;
    if (!segments.some((i) => p.start >= i.start && p.end <= i.end)) continue;
    if (out.length && p.start < out[out.length - 1].end) continue;
    out.push({ start: p.start, end: p.end });
  }
  return out.slice(0, PAUSES_MAX);
}

/** Les pauses d'un poste, en mots : la pause déjeuner, puis les pauses courtes. */
export function decrirePauses(s: Horaire & { pauses?: PauseCourte[] }): { dejeuner: string | null; courtes: string | null } {
  const courtes = s.pauses ?? [];
  const durees = new Set(courtes.map((p) => p.end - p.start));
  return {
    dejeuner: s.pauseStart !== undefined && s.pauseEnd !== undefined ? `${fmtHeure(s.pauseStart)} – ${fmtHeure(s.pauseEnd)}` : null,
    courtes: courtes.length ? `${courtes.map((p) => fmtHeure(p.start)).join(', ')}${durees.size === 1 ? ` (${[...durees][0]} min)` : ''}` : null,
  };
}

/** « pause déjeuner de 12 h 30 à 13 h 30 · pauses courtes à 10 h 30, 16 h (15 min) », ou une chaîne vide. */
export function phrasePauses(s: Horaire & { pauses?: PauseCourte[] }): string {
  const d = decrirePauses(s);
  const n = s.pauses?.length ?? 0;
  return [d.dejeuner ? `pause déjeuner ${d.dejeuner}` : '', d.courtes ? `pause${n > 1 ? 's' : ''} courte${n > 1 ? 's' : ''} à ${d.courtes}` : ''].filter(Boolean).join(' · ');
}
