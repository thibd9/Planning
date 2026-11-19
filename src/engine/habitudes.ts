import { addDays, uid } from '../domain/time';
import type { AppData, ISODate, Shift } from '../domain/types';
import { ouverture } from './core';

/** Combien de semaines publiées servent de référence pour retrouver les habitudes. */
export const SEMAINES_DE_REFERENCE = 8;

/**
 * La semaine telle que la pharmacie a l'habitude de la faire : pour chaque personne et chaque jour, sa journée
 * la plus fréquente sur les dernières semaines publiées. Un jour travaillé moins d'une semaine sur deux reste
 * un repos ; un jour fermé ou une absence approuvée ne reçoit rien. Sans assez d'historique : aucune habitude.
 */
export function semaineHabituelle(data: AppData, monday: ISODate): Shift[] {
  const passees = Object.entries(data.semaines)
    .filter(([lundi, s]) => lundi < monday && s.statut === 'publie')
    .map(([lundi]) => lundi)
    .sort()
    .reverse()
    .slice(0, SEMAINES_DE_REFERENCE);
  if (passees.length < 2) return [];
  const forme = (l: Shift[]): string =>
    l
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((s) => `${s.start}-${s.end}`)
      .join('|');
  const out: Shift[] = [];
  for (const p of data.personnes.filter((x) => !x.externe)) {
    for (let j = 0; j < 7; j++) {
      const date = addDays(monday, j);
      if (!ouverture(data.officine, date).length) continue;
      if (data.absences.some((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= date && date <= a.to)) continue;
      // Ce que la personne a fait ce jour-là, semaine après semaine, de la plus récente à la plus ancienne.
      const journees = passees.map((lundi) => (data.semaines[lundi]?.snapshot ?? data.shifts).filter((s) => s.personId === p.id && s.date === addDays(lundi, j)));
      const travaillees = journees.filter((l) => l.length > 0);
      if (travaillees.length * 2 < passees.length) continue;
      const compte = new Map<string, number>();
      for (const l of travaillees) compte.set(forme(l), (compte.get(forme(l)) ?? 0) + 1);
      // À égalité, la forme la plus récente l'emporte : c'est la première rencontrée.
      const habituelle = [...compte.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const modele = travaillees.find((l) => forme(l) === habituelle) ?? [];
      for (const s of modele) {
        out.push({ ...s, id: uid('s'), date, explication: `Repris de vos habitudes : c’est sa journée la plus fréquente ce jour-là sur vos ${passees.length} dernières semaines publiées.` });
      }
    }
  }
  return out;
}
