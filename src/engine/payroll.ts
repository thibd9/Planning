import { valeurRegle } from '../domain/rules';
import { addDays, dayIndex, fmtDecimal, mondayOf, weekDates } from '../domain/time';
import type { AppData, ISODate, Person } from '../domain/types';
import { ABSENCE_LABEL, QUALIFICATION_COURT, nomComplet } from '../domain/types';
import { minutesSemaine } from './core';
import { variablesGarde } from './gardes';

export interface Decompte {
  /** Minutes planifiées. */
  planifie: number;
  /** Minutes au-delà du contrat (heures complémentaires ou supplémentaires). */
  auDela: number;
  /** Heures supplémentaires majorées à 25 % (temps plein). */
  supp25: number;
  /** Heures supplémentaires majorées à 50 % (temps plein). */
  supp50: number;
  /** Heures complémentaires (temps partiel). */
  complementaires: number;
  /** Coût brut estimé de la semaine ; null si le taux n'est pas renseigné. */
  cout: number | null;
}

/**
 * Décompte indicatif d'une semaine, pour comparer des scénarios. Ce n'est pas un calcul de paie :
 * les majorations des heures complémentaires sont estimées à 10 % puis 25 %.
 */
export function decompteSemaine(data: Pick<AppData, 'regles'>, p: Person, minutes: number): Decompte {
  const contrat = p.heuresHebdo * 60;
  const vide: Decompte = { planifie: minutes, auDela: 0, supp25: 0, supp50: 0, complementaires: 0, cout: null };
  if (!p.salarie) return vide;
  const seuil50 = valeurRegle(data.regles, 'paie.heuresSupp', 43) * 60;
  const out: Decompte = { ...vide, auDela: Math.max(0, minutes - contrat) };
  let majore = 0;
  if (p.heuresHebdo >= 35) {
    out.supp25 = Math.max(0, Math.min(minutes, seuil50) - 35 * 60);
    out.supp50 = Math.max(0, minutes - seuil50);
    majore = out.supp25 * 1.25 + out.supp50 * 1.5;
  } else {
    out.complementaires = Math.max(0, Math.min(minutes, 35 * 60) - contrat);
    const dixieme = contrat / 10;
    majore = Math.min(out.complementaires, dixieme) * 1.1 + Math.max(0, out.complementaires - dixieme) * 1.25;
    out.supp25 = Math.max(0, minutes - 35 * 60);
    majore += out.supp25 * 1.25;
  }
  if (p.tauxHoraire !== null) {
    // Les heures du contrat sont dues même si le planning en prévoit moins.
    out.cout = (p.tauxHoraire * (contrat + majore)) / 60;
  }
  return out;
}

export function coutSemaine(data: AppData, monday: ISODate): number {
  let total = 0;
  for (const p of data.personnes) {
    const minutes = minutesSemaine(data, p.id, monday);
    if (p.externe) {
      total += ((p.tauxHoraire ?? 0) * minutes) / 60;
      continue;
    }
    total += decompteSemaine(data, p, minutes).cout ?? 0;
  }
  return total;
}

/** Lundis des semaines qui recoupent un mois (« AAAA-MM »). */
export function semainesDuMois(mois: string): ISODate[] {
  const first = `${mois}-01`;
  const [y, m] = mois.split('-').map(Number);
  const last = `${mois}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  const out: ISODate[] = [];
  for (let d = mondayOf(first); dayIndex(d) <= dayIndex(last); d = addDays(d, 7)) out.push(d);
  return out;
}

export interface LignePaie {
  person: Person;
  /** Heures planifiées dans le mois (jours du mois uniquement). */
  heuresMois: number;
  supp25: number;
  supp50: number;
  complementaires: number;
  joursAbsence: Record<string, number>;
  variablesGarde: { code: string; label: string; quantite: number; unite: string }[];
}

/**
 * Fiche navette du mois : heures PRÉVUES (non pointées) et variables de garde.
 * Les semaines à cheval sur deux mois sont décomptées en entier sur le mois de leur lundi
 * pour les heures supplémentaires - convention à confirmer avec le cabinet comptable.
 */
export function ficheNavette(data: AppData, mois: string): LignePaie[] {
  const semaines = semainesDuMois(mois);
  const lignes: LignePaie[] = [];
  for (const p of data.personnes) {
    if (!p.salarie || p.externe) continue;
    let heuresMois = 0;
    let supp25 = 0;
    let supp50 = 0;
    let complementaires = 0;
    for (const s of data.shifts) {
      if (s.personId === p.id && s.date.startsWith(mois)) {
        heuresMois += (s.end - s.start - ((s.pauseEnd ?? 0) - (s.pauseStart ?? 0))) / 60;
      }
    }
    for (const monday of semaines) {
      if (!monday.startsWith(mois)) continue;
      const d = decompteSemaine(data, p, minutesSemaine(data, p.id, monday));
      supp25 += d.supp25 / 60;
      supp50 += d.supp50 / 60;
      complementaires += d.complementaires / 60;
    }
    const joursAbsence: Record<string, number> = {};
    for (const a of data.absences) {
      if (a.personId !== p.id || a.statut !== 'approuvee') continue;
      for (let i = dayIndex(a.from); i <= dayIndex(a.to); i++) {
        const d = new Date(i * 86_400_000).toISOString().slice(0, 10);
        if (d.startsWith(mois)) joursAbsence[ABSENCE_LABEL[a.type]] = (joursAbsence[ABSENCE_LABEL[a.type]] ?? 0) + 1;
      }
    }
    const cumul = new Map<string, { code: string; label: string; quantite: number; unite: string }>();
    for (const g of data.gardes) {
      if (g.personId !== p.id) continue;
      for (const v of variablesGarde(data, g).variables) {
        if (v.mois !== mois) continue;
        const c = cumul.get(v.code);
        if (c) c.quantite += v.quantite;
        else cumul.set(v.code, { code: v.code, label: v.label, quantite: v.quantite, unite: v.unite });
      }
    }
    lignes.push({ person: p, heuresMois, supp25, supp50, complementaires, joursAbsence, variablesGarde: [...cumul.values()] });
  }
  return lignes;
}

const csv = (v: string | number): string => {
  const s = typeof v === 'number' ? fmtDecimal(v) : v;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Export CSV (séparateur point-virgule, lisible par Excel en français). */
export function ficheNavetteCSV(data: AppData, mois: string): string {
  const lignes = ficheNavette(data, mois);
  const rows: (string | number)[][] = [
    [`Fiche navette - ${data.officine.nom} - ${mois} - heures PRÉVUES, à rapprocher des heures réalisées`],
    ['Salarié', 'Fonction', 'Contrat hebdo (h)', 'Heures prévues', 'Heures compl.', 'Heures supp. 25 %', 'Heures supp. 50 %', 'Absences', 'Variable', 'Quantité', 'Unité'],
  ];
  for (const l of lignes) {
    const absences = Object.entries(l.joursAbsence)
      .map(([k, v]) => `${k} : ${v} j`)
      .join(', ');
    const base = [
      nomComplet(l.person),
      QUALIFICATION_COURT[l.person.qualification],
      l.person.heuresHebdo,
      l.heuresMois,
      l.complementaires,
      l.supp25,
      l.supp50,
      absences,
    ];
    if (!l.variablesGarde.length) rows.push([...base, '', '', '']);
    l.variablesGarde.forEach((v, i) => {
      rows.push([...(i === 0 ? base : base.map(() => '')), v.label, v.quantite, v.unite]);
    });
  }
  return '﻿' + rows.map((r) => r.map(csv).join(';')).join('\r\n');
}

/** Dates d'une semaine appartenant au mois. */
export const joursDuMois = (monday: ISODate, mois: string): ISODate[] =>
  weekDates(monday).filter((d) => d.startsWith(mois));
