import { valeurRegle } from '../domain/rules';
import { dayIndex, fmtDateCourt, joursOuvresEntre, weekDates } from '../domain/time';
import type { AppData, Changement, ISODate, Shift } from '../domain/types';
import { nomCourt } from '../domain/types';
import { decrireJournee, shiftsSemaine } from './core';
import { delaiGarde } from './gardes';
import type { Issue } from './validate';
import { validateWeek } from './validate';

const cle = (s: Shift): string => `${s.start}-${s.end}-${s.pauseStart ?? ''}-${s.pauseEnd ?? ''}-${s.activite}`;

/** Écarts entre la version publiée d'une semaine et son état actuel, personne par personne. */
export function changementsSemaine(data: AppData, monday: ISODate): Changement[] {
  const snapshot = data.semaines[monday]?.snapshot ?? [];
  const actuel = shiftsSemaine(data, monday);
  const out: Changement[] = [];
  for (const p of data.personnes) {
    for (const date of weekDates(monday)) {
      const a = snapshot.filter((s) => s.personId === p.id && s.date === date);
      const b = actuel.filter((s) => s.personId === p.id && s.date === date);
      if (a.map(cle).sort().join('|') === b.map(cle).sort().join('|')) continue;
      out.push({ personId: p.id, date, avant: decrireJournee(a), apres: decrireJournee(b) });
    }
  }
  return out;
}

export interface Delai {
  id: string;
  personId: string;
  message: string;
}

export interface ControlePublication {
  premiere: boolean;
  issues: Issue[];
  changements: Changement[];
  /** Délais de prévenance non tenus : l'accord du salarié doit être recueilli et tracé. */
  delais: Delai[];
}

/** Tout ce qu'il faut regarder avant de rendre un planning officiel. */
export function controlePublication(data: AppData, monday: ISODate, today: ISODate): ControlePublication {
  const semaine = data.semaines[monday];
  const premiere = !semaine || semaine.statut !== 'publie';
  const changements = premiere ? [] : changementsSemaine(data, monday);
  const delaiPartiel = valeurRegle(data.regles, 'delai.tempsPartiel', 7);
  const delais: Delai[] = [];
  const partiels = data.personnes.filter((p) => p.salarie && !p.externe && p.heuresHebdo < 35);

  if (premiere) {
    const restants = joursOuvresEntre(today, monday);
    if (restants < delaiPartiel) {
      for (const p of partiels) {
        if (!shiftsSemaine(data, monday).some((s) => s.personId === p.id)) continue;
        delais.push({
          id: `partiel|${p.id}`,
          personId: p.id,
          message: `${nomCourt(p)} (temps partiel) : horaires communiqués ${Math.max(0, restants)} jour${
            restants > 1 ? 's' : ''
          } ouvré${restants > 1 ? 's' : ''} avant la semaine, pour ${delaiPartiel} requis.`,
        });
      }
    }
  } else {
    for (const c of changements) {
      const p = partiels.find((x) => x.id === c.personId);
      if (!p || dayIndex(c.date) < dayIndex(today)) continue;
      const restants = joursOuvresEntre(today, c.date);
      if (restants < delaiPartiel) {
        delais.push({
          id: `partiel|${p.id}|${c.date}`,
          personId: p.id,
          message: `${nomCourt(p)} (temps partiel), ${fmtDateCourt(c.date)} : modification notifiée ${Math.max(
            0,
            restants,
          )} jour${restants > 1 ? 's' : ''} ouvré${restants > 1 ? 's' : ''} avant, pour ${delaiPartiel} requis.`,
        });
      }
    }
  }
  for (const g of data.gardes) {
    if (!g.personId || !weekDates(monday).includes(g.date) || g.communiqueLe) continue;
    const p = data.personnes.find((x) => x.id === g.personId);
    const d = delaiGarde(data, g, p, today);
    if (!d.ok && p) delais.push({ id: `garde|${g.id}`, personId: p.id, message: `Garde du ${fmtDateCourt(g.date)}, ${nomCourt(p)} : ${d.message}` });
  }
  return { premiere, issues: validateWeek(data, monday), changements, delais };
}
