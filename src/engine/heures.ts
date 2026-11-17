import { addDays, mondayOf } from '../domain/time';
import type { AppData, ISODate, Person, Regularisation } from '../domain/types';
import { equipeInterne, estAbsent, minutesSemaine } from './core';

/**
 * Compteur d'heures : ce qui a été planifié et publié, face au contrat, semaine après semaine.
 * Un solde positif se paie ou se récupère ; un solde négatif se rattrape ou se solde.
 * Le compteur ne remplace pas le bulletin de paie : il sert à décider, la paie applique la convention.
 */

const SEUIL = 60;
const PLAFOND = 8 * 60;

export interface Solde {
  personId: string;
  /** Minutes dues au contrat sur les semaines publiées (absences approuvées déduites). */
  contrat: number;
  realise: number;
  /** Régularisations déjà comptées (paiement, solde, récupération ou rattrapage à venir). */
  regularise: number;
  solde: number;
  /** Récupérations et rattrapages planifiés sur une semaine à venir. */
  prevues: Regularisation[];
}

/** Contrat d'une semaine, absences approuvées déduites (un cinquième par jour ouvré d'absence). */
export function contratSemaine(data: Pick<AppData, 'absences'>, p: Person, monday: ISODate): number {
  let absents = 0;
  for (let i = 0; i < 5; i++) if (estAbsent(data, p.id, addDays(monday, i))) absents++;
  return Math.round(p.heuresHebdo * 60 * (1 - absents / 5));
}

/** Objectif d'heures d'une semaine : le contrat, corrigé des récupérations et rattrapages planifiés cette semaine-là. */
export function cibleSemaine(data: Pick<AppData, 'regularisations'>, p: Person, monday: ISODate): number {
  const ajust = (data.regularisations ?? []).filter((r) => r.personId === p.id && r.semaine === monday).reduce((t, r) => t + r.minutes, 0);
  return Math.max(0, p.heuresHebdo * 60 + ajust);
}

export function soldeHeures(data: AppData, p: Person, today: ISODate): Solde {
  const lundi = mondayOf(today);
  let contrat = 0;
  let realise = 0;
  for (const [monday, s] of Object.entries(data.semaines)) {
    if (s.statut !== 'publie' || monday > lundi) continue;
    contrat += contratSemaine(data, p, monday);
    realise += minutesSemaine(data, p.id, monday);
  }
  const mes = (data.regularisations ?? []).filter((r) => r.personId === p.id);
  // Une récupération dont la semaine est arrivée se lit déjà dans les heures réalisées : elle n'est plus comptée à part.
  const comptees = mes.filter((r) => !r.semaine || r.semaine > lundi);
  const regularise = comptees.reduce((t, r) => t + r.minutes, 0);
  return { personId: p.id, contrat, realise, regularise, solde: realise - contrat + regularise, prevues: comptees.filter((r) => r.semaine) };
}

/** Compteurs de tous les salariés ; le titulaire non salarié est hors décompte. */
export const soldes = (data: AppData, today: ISODate): Solde[] => equipeInterne(data).filter((p) => p.salarie).map((p) => soldeHeures(data, p, today));

export const aRegulariser = (data: AppData, today: ISODate): Solde[] => soldes(data, today).filter((s) => Math.abs(s.solde) >= SEUIL);

/** Première semaine à venir qui n'est pas encore publiée : c'est là qu'une récupération peut se planifier. */
export function semaineLibre(data: Pick<AppData, 'semaines'>, today: ISODate): ISODate {
  let m = addDays(mondayOf(today), 7);
  while (data.semaines[m]?.statut === 'publie') m = addDays(m, 7);
  return m;
}

/**
 * Régularisation automatique : chaque solde d'au moins une heure est résorbé sur la première semaine non publiée,
 * par demi-heures, sans dépasser huit heures d'écart au contrat sur cette semaine.
 */
export function proposerRegularisations(data: AppData, today: ISODate): Omit<Regularisation, 'id' | 'at'>[] {
  const semaine = semaineLibre(data, today);
  return aRegulariser(data, today).map((s) => {
    const borne = Math.max(-PLAFOND, Math.min(PLAFOND, s.solde));
    const minutes = -Math.round(borne / 30) * 30;
    return { personId: s.personId, minutes, type: minutes < 0 ? ('recuperation' as const) : ('rattrapage' as const), semaine, auto: true };
  });
}
