import { addDays, dayIndex, mondayOf } from '../domain/time';
import type { Absence, AppData, Besoin, Garde, ISODate, Trou } from '../domain/types';
import { shiftsSemaine } from './core';
import type { ReposGarde } from './gardes';
import { congesIncompatibles, reposApresGarde } from './gardes';
import { changementsSemaine } from './publish';

export interface PublicationEnAttente {
  monday: ISODate;
  type: 'a_publier' | 'modifications';
  nombre: number;
  /** Jours avant le début de la semaine. */
  jours: number;
}

/** Tout ce que le responsable doit décider aujourd'hui, par ordre d'urgence. */
export interface Decisions {
  trous: Trou[];
  absences: Absence[];
  besoins: Besoin[];
  gardesAAffecter: Garde[];
  gardesRepos: { garde: Garde; repos: ReposGarde }[];
  gardesAbsence: Garde[];
  gardesAValider: Garde[];
  publications: PublicationEnAttente[];
  remplacements: AppData['remplacements'];
  /** Décisions d'un titulaire secondaire qui attendent l'accord du titulaire principal. */
  accords: AppData['accords'];
  total: number;
}

export function decisions(data: AppData, today: ISODate): Decisions {
  const t = dayIndex(today);
  const trous = data.trous
    .filter((x) => x.statut === 'ouvert' && dayIndex(x.shift.date) >= t)
    .sort((a, b) => a.shift.date.localeCompare(b.shift.date));
  const absences = data.absences.filter((a) => a.statut === 'demandee').sort((a, b) => a.from.localeCompare(b.from));
  const besoins = data.besoins.filter((b) => b.decision === 'en_attente');
  const futures = data.gardes.filter((g) => dayIndex(g.date) >= t);
  const gardesAAffecter = futures.filter((g) => !g.personId);
  const gardesRepos: Decisions['gardesRepos'] = [];
  for (const g of data.gardes) {
    if (!g.personId || dayIndex(g.date) < t - 2) continue;
    const repos = reposApresGarde(data, g);
    if (repos && repos.conflits.length) gardesRepos.push({ garde: g, repos });
  }
  const gardesAbsence = futures.filter((g) => congesIncompatibles(data, g));
  const gardesAValider = data.gardes.filter((g) => {
    if (!g.personId || g.valideLe || dayIndex(g.date) >= t) return false;
    return data.personnes.find((p) => p.id === g.personId)?.salarie ?? false;
  });

  const publications: PublicationEnAttente[] = [];
  const lundi = mondayOf(today);
  for (let w = 0; w <= 3; w++) {
    const monday = addDays(lundi, 7 * w);
    const jours = dayIndex(monday) - t;
    if (data.semaines[monday]?.statut === 'publie') {
      const n = changementsSemaine(data, monday).length;
      if (n) publications.push({ monday, type: 'modifications', nombre: n, jours });
    } else if (w >= 1 && w <= 2 && data.personnes.some((p) => !p.externe)) {
      publications.push({ monday, type: 'a_publier', nombre: shiftsSemaine(data, monday).length, jours });
    }
  }
  const remplacements = (data.remplacements ?? []).filter((r) => r.statut === 'ouverte' && dayIndex(r.date) >= t);
  const accords = data.accords ?? [];
  const total =
    accords.length +
    remplacements.length +
    trous.length +
    absences.length +
    besoins.length +
    gardesAAffecter.length +
    gardesRepos.length +
    gardesAbsence.length +
    gardesAValider.length +
    publications.length;
  return { trous, absences, besoins, gardesAAffecter, gardesRepos, gardesAbsence, gardesAValider, publications, remplacements, accords, total };
}
