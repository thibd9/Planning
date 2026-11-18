import { addDays, dayIndex } from '../domain/time';
import type { Absence, AppData, ISODate } from '../domain/types';
import { equite } from './equity';

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

export type PointFortCle = 'ponctuel' | 'entraide' | 'volontaire' | 'part';
export interface PointFort {
  cle: PointFortCle;
  titre: string;
  detail: string;
}

/**
 * Ce qu'une personne apporte à l'équipe, d'après les faits des douze derniers mois : ponctualité, entraide,
 * part des contraintes. Ni note ni classement, et jamais un arrêt, un congé ou une absence : la santé et la
 * vie personnelle n'entrent pas en compte.
 */
export function pointsForts(data: AppData, personId: string, today: ISODate): PointFort[] {
  const debut = addDays(today, -365);
  const suivi = suiviDe(data, personId, today);
  const postes = data.shifts.filter((s) => s.personId === personId && s.date >= debut && s.date <= today);
  const points: PointFort[] = [];
  // La ponctualité ne se constate qu'avec assez de postes tenus.
  if (postes.length >= 20 && suivi.retards === 0 && suivi.departs === 0) points.push({ cle: 'ponctuel', titre: 'Toujours à l’heure', detail: 'Aucun retard ni départ anticipé noté en 12 mois' });
  const repris = Math.max(suivi.remplacementsAssures, postes.filter((s) => s.origine === 'reparation').length);
  if (repris >= 2) points.push({ cle: 'entraide', titre: 'Dépanne l’équipe', detail: `${repris} postes repris au pied levé en 12 mois` });
  const reponses = data.remplacements.filter((r) => r.date >= debut && r.volontaires.includes(personId)).length;
  if (reponses >= 2) points.push({ cle: 'volontaire', titre: 'Répond aux appels', detail: `S’est porté volontaire ${reponses} fois en 12 mois` });
  const ligne = equite(data, addDays(today, -84), today).find((l) => l.personId === personId);
  if (ligne) {
    const reel = ligne.reel.samedis + ligne.reel.fermetures;
    const attendu = (ligne.attendu.samedis ?? 0) + (ligne.attendu.fermetures ?? 0);
    if (ligne.attendu.samedis !== null && attendu >= 2 && reel >= attendu) points.push({ cle: 'part', titre: 'Prend sa part', detail: 'Samedis et fermetures : au moins sa part sur 3 mois' });
  }
  return points;
}

/** Une autre absence sur les mêmes dates : demandée elle aussi, ou déjà accordée. */
export interface AbsenceSimultanee {
  absence: Absence;
  /** Jours en commun avec la demande examinée. */
  jours: number;
  /** Reçue avant la demande examinée. */
  avant: boolean;
}

/**
 * Qui d'autre sera absent, ou demande à l'être, sur les dates d'une demande : pour ne jamais
 * répondre à une demande en oubliant l'autre. Les demandes sont rangées dans l'ordre où elles sont arrivées.
 */
export function absencesSimultanees(data: Pick<AppData, 'absences'>, a: Pick<Absence, 'id' | 'personId' | 'from' | 'to' | 'createdAt'>): { demandees: AbsenceSimultanee[]; accordees: AbsenceSimultanee[] } {
  const autres = data.absences
    .filter((x) => x.id !== a.id && x.personId !== a.personId && x.statut !== 'refusee' && x.from <= a.to && x.to >= a.from)
    .map((x) => ({ absence: x, jours: dayIndex(x.to < a.to ? x.to : a.to) - dayIndex(x.from > a.from ? x.from : a.from) + 1, avant: x.createdAt < a.createdAt }))
    .sort((x, y) => x.absence.createdAt.localeCompare(y.absence.createdAt));
  return { demandees: autres.filter((x) => x.absence.statut === 'demandee'), accordees: autres.filter((x) => x.absence.statut === 'approuvee') };
}
