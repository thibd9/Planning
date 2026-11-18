import { addDays, duree, fmtHeure, intersect, subtract } from '../domain/time';
import type { AppData, ISODate, Interval, RendezVous } from '../domain/types';
import { estAbsent, ouverture, segmentsTravail } from './core';

/**
 * Rendez-vous entre deux personnes de l'équipe : demandé dans la messagerie, accepté, déplacé ou décliné,
 * puis fixé dans l'agenda des deux. Solvéa propose des moments où les deux sont en poste en même temps.
 */

type Donnees = Pick<AppData, 'rendezVous'>;
const tri = (a: RendezVous, b: RendezVous): number => a.date.localeCompare(b.date) || a.start - b.start;

/** Tous les rendez-vous d'une personne, demandés par elle ou avec elle. */
export const rdvDe = (data: Donnees, personId: string): RendezVous[] => (data.rendezVous ?? []).filter((r) => r.de === personId || r.avec === personId).sort(tri);

/** Rendez-vous fixés d'une personne ; avec `date`, ceux de ce jour-là. */
export const rdvFixes = (data: Donnees, personId: string, date?: ISODate): RendezVous[] => rdvDe(data, personId).filter((r) => r.statut === 'fixe' && (!date || r.date === date));

/** Ce qui est encore devant : fixé ou en attente de réponse, à partir d'aujourd'hui. */
export const rdvAVenir = (data: Donnees, personId: string, today: ISODate): RendezVous[] => rdvDe(data, personId).filter((r) => (r.statut === 'fixe' || r.statut === 'propose') && r.date >= today);

/** Demandes auxquelles la personne doit répondre. */
export const rdvARepondre = (data: Donnees, personId: string, today: ISODate): RendezVous[] => rdvDe(data, personId).filter((r) => r.statut === 'propose' && r.attend === personId && r.date >= today);

/** L'autre personne du rendez-vous. */
export const autreDuRdv = (r: Pick<RendezVous, 'de' | 'avec'>, personId: string): string => (r.de === personId ? r.avec : r.de);

const postesDe = (data: Pick<AppData, 'shifts'>, personId: string, date: ISODate): Interval[] => data.shifts.filter((s) => s.personId === personId && s.date === date).flatMap(segmentsTravail);

export interface AvisRdv {
  /** Ce qui empêche de proposer ce moment. */
  bloquants: string[];
  /** Ce qu'il vaut mieux savoir avant de l'envoyer. */
  infos: string[];
}

/** Contrôle un moment de rendez-vous : jour passé, absence, autre rendez-vous au même moment ; puis ce qui est seulement à savoir. */
export function avisRdv(data: AppData, c: Pick<RendezVous, 'de' | 'avec' | 'date' | 'start' | 'end'> & { id?: string }, today: ISODate): AvisRdv {
  const avis: AvisRdv = { bloquants: [], infos: [] };
  if (c.date < today) avis.bloquants.push('Choisissez un jour à venir.');
  if (c.end <= c.start) avis.bloquants.push('L’heure de fin doit suivre l’heure de début.');
  if (c.de === c.avec) avis.bloquants.push('Choisissez une autre personne que vous.');
  if (avis.bloquants.length) return avis;
  const moment = { start: c.start, end: c.end };
  for (const id of [c.de, c.avec]) {
    const p = data.personnes.find((x) => x.id === id);
    if (!p) continue;
    if (estAbsent(data, id, c.date)) {
      avis.bloquants.push(`${p.prenom} est en absence approuvée ce jour-là.`);
      continue;
    }
    const pris = rdvFixes(data, id, c.date).find((r) => r.id !== c.id && r.start < c.end && c.start < r.end);
    if (pris) avis.bloquants.push(`${p.prenom} a déjà un rendez-vous de ${fmtHeure(pris.start)} à ${fmtHeure(pris.end)}.`);
    else if (subtract([moment], postesDe(data, id, c.date)).length) avis.infos.push(`${p.prenom} n’est pas en poste à ce moment-là.`);
  }
  const ouvert = ouverture(data.officine, c.date);
  if (!ouvert.length) avis.infos.push('L’officine est fermée ce jour-là.');
  else if (subtract([moment], ouvert).length) avis.infos.push('Ce moment déborde des heures d’ouverture.');
  return avis;
}

/**
 * Des moments où les deux personnes sont en poste en même temps, sur les trois prochaines semaines :
 * un par jour, plutôt en début d'après-midi, jamais sur un autre rendez-vous.
 */
export function proposerRdv(data: AppData, a: string, b: string, minutes: number, today: ISODate, nombre = 3): Pick<RendezVous, 'date' | 'start' | 'end'>[] {
  const out: Pick<RendezVous, 'date' | 'start' | 'end'>[] = [];
  for (let j = 1; j <= 21 && out.length < nombre; j++) {
    const date = addDays(today, j);
    if (estAbsent(data, a, date) || estAbsent(data, b, date)) continue;
    const pris = [...rdvFixes(data, a, date), ...rdvFixes(data, b, date)].map((r) => ({ start: r.start, end: r.end }));
    const communs = subtract(intersect(postesDe(data, a, date), postesDe(data, b, date)), pris).filter((i) => duree(i) >= minutes);
    if (!communs.length) continue;
    // Le début d'après-midi est le plus calme au comptoir : on y place le rendez-vous quand c'est possible.
    const calme = communs.find((i) => i.end - Math.max(i.start, 14 * 60) >= minutes);
    const start = calme ? Math.max(calme.start, 14 * 60) : communs[0].start;
    out.push({ date, start, end: start + minutes });
  }
  return out;
}
