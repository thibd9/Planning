import { addDays, dayIndex } from '../domain/time';
import type { AppData, ISODate } from '../domain/types';

export interface Suivi {
  personId: string;
  retards: number;
  minutesRetard: number;
  departs: number;
  absencesImprevues: number;
  /** Jours d'absence approuvée, par nature, sur la période. */
  conges: number;
  arrets: number;
  formations: number;
  remplacementsAssures: number;
}

/**
 * Compteurs de présence d'une personne sur les douze derniers mois : des faits datés
 * (retards, départs, absences), jamais leur raison.
 */
export function suiviDe(data: Pick<AppData, 'ecarts' | 'absences' | 'remplacements'>, personId: string, today: ISODate, jours = 365): Suivi {
  const debut = addDays(today, -jours);
  const ecarts = (data.ecarts ?? []).filter((e) => e.personId === personId && e.date >= debut && e.date <= today);
  const compter = (type: 'conge' | 'maladie' | 'formation'): number =>
    data.absences
      .filter((a) => a.personId === personId && a.statut === 'approuvee' && a.type === type && a.to >= debut && a.from <= today)
      .reduce((t, a) => t + (dayIndex(a.to < today ? a.to : today) - dayIndex(a.from > debut ? a.from : debut) + 1), 0);
  const retards = ecarts.filter((e) => e.type === 'retard');
  return {
    personId,
    retards: retards.length,
    minutesRetard: retards.reduce((t, e) => t + (e.minutes ?? 0), 0),
    departs: ecarts.filter((e) => e.type === 'depart').length,
    absencesImprevues: ecarts.filter((e) => e.type === 'absence').length,
    conges: compter('conge'),
    arrets: compter('maladie'),
    formations: compter('formation'),
    remplacementsAssures: data.remplacements.filter((r) => r.statut === 'acceptee' && r.remplacantId === personId && r.date >= debut).length,
  };
}
