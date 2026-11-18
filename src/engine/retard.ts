import { fmtDuree, fmtHeure, mondayOf } from '../domain/time';
import { estPharmacien } from '../domain/types';
import type { AppData, AvisRetard, ISODate, Minutes, Shift } from '../domain/types';

/** Les retards proposés d'un geste ; au-delà, on saisit la durée. */
export const RETARDS_RAPIDES = [5, 10, 15, 20, 30, 45, 60];
export const RETARD_MAX = 240;

/** « 15 min », « 1 h », « 1 h 30 » : une durée de retard, dite comme on la dit. */
export const dureeRetard = (minutes: number): string => (minutes < 60 ? `${minutes} min` : fmtDuree(minutes));

/** L'heure d'arrivée annoncée. */
export const arriveePrevue = (a: Pick<AvisRetard, 'start' | 'minutes'>): Minutes => a.start + a.minutes;

/**
 * Le poste qu'un avis de retard concerne : celui d'aujourd'hui qui n'est pas terminé, sinon le premier de demain.
 * Seuls les plannings publiés comptent, hors absence approuvée.
 */
export function posteAPrevenir(data: AppData, personId: string, today: ISODate, demain: ISODate, maintenant: Minutes): Shift | null {
  const publiee = (date: ISODate): boolean => data.semaines[mondayOf(date)]?.statut === 'publie';
  const absent = (date: ISODate): boolean => data.absences.some((a) => a.personId === personId && a.statut === 'approuvee' && a.from <= date && date <= a.to);
  const postes = (date: ISODate): Shift[] => (publiee(date) && !absent(date) ? data.shifts.filter((s) => s.personId === personId && s.date === date).sort((a, b) => a.start - b.start) : []);
  return postes(today).find((s) => s.end > maintenant) ?? postes(demain)[0] ?? null;
}

/** L'avis déjà donné pour ce poste, s'il y en a un. */
export const avisPour = (data: AppData, personId: string, poste: Pick<Shift, 'date' | 'start'>): AvisRetard | undefined =>
  (data.retards ?? []).find((a) => a.personId === personId && a.date === poste.date && a.start === poste.start);

/** Les avis de retard d'un jour, par personne : ce que le tableau de bord affiche à côté de l'équipe du jour. */
export const retardsDuJour = (data: AppData, date: ISODate): AvisRetard[] => (data.retards ?? []).filter((a) => a.date === date);

/** Les supérieurs à prévenir : les titulaires, et les personnes à qui la gestion a été confiée. */
export const superieurs = (data: Pick<AppData, 'personnes'>, personId: string): string[] =>
  data.personnes.filter((p) => !p.externe && p.id !== personId && (p.qualification === 'titulaire' || !!p.gestion)).map((p) => p.id);

/**
 * Ce que le retard change au comptoir tant qu'il dure : plus de pharmacien, ou plus personne.
 * Une aide à la décision pour le titulaire, calculée sur le planning du jour.
 */
export function effetsRetard(data: AppData, a: AvisRetard): string[] {
  const moi = data.personnes.find((p) => p.id === a.personId);
  if (!moi) return [];
  const fin = arriveePrevue(a);
  const enPoste = data.shifts.filter((s) => {
    if (s.date !== a.date || s.personId === a.personId || s.start > a.start || s.end < fin) return false;
    // Une pause qui tombe pendant le retard laisse le comptoir sans cette personne.
    return !(s.pauseStart !== undefined && s.pauseEnd !== undefined && s.pauseStart < fin && a.start < s.pauseEnd);
  });
  const tranche = `de ${fmtHeure(a.start)} à ${fmtHeure(fin)}`;
  if (!enPoste.length) return [`Personne d’autre n’est en poste ${tranche}.`];
  const pharmaciens = enPoste.filter((s) => {
    const p = data.personnes.find((x) => x.id === s.personId);
    return !!p && estPharmacien(p);
  });
  if (estPharmacien(moi) && !pharmaciens.length) return [`Aucun autre pharmacien n’est en poste ${tranche}.`];
  return [];
}
