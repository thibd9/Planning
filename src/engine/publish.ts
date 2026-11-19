import { valeurRegle } from '../domain/rules';
import { dayIndex, fmtDateCourt, joursOuvresEntre, mondayOf, weekDates } from '../domain/time';
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

/**
 * Une décision (absence approuvée, absence couverte, formation, remplacement, départ d'une personne…) change des
 * postes d'une semaine déjà publiée : la version publiée suit aussitôt, pour les seules journées que la décision a
 * touchées, et chaque personne dont la journée change en est prévenue. Tout le monde lit donc le même planning.
 * Les retouches faites à la main dans la grille restent, elles, un brouillon jusqu'à « Publier les modifications ».
 */
export function repercuter(avant: AppData, apres: AppData, today: ISODate, at: string): AppData {
  if (avant.shifts === apres.shifts) return apres;
  const parJour = (shifts: Shift[]): Map<string, Shift[]> => {
    const m = new Map<string, Shift[]>();
    for (const x of shifts) {
      const k = `${x.personId}|${x.date}`;
      const liste = m.get(k);
      if (liste) liste.push(x);
      else m.set(k, [x]);
    }
    return m;
  };
  const signature = (liste: Shift[] | undefined): string => (liste ?? []).map(cle).sort().join('|');
  const a = parJour(avant.shifts);
  const b = parJour(apres.shifts);
  // Les journées que la décision a réellement changées.
  const touchees = [...new Set([...a.keys(), ...b.keys()])].filter((k) => signature(a.get(k)) !== signature(b.get(k)));
  if (!touchees.length) return apres;
  const semaines = { ...apres.semaines };
  const notifications: AppData['notifications'] = [];
  const dejaPrevenus = new Set(apres.notifications.filter((n) => !avant.notifications.includes(n)).map((n) => `${n.personId}|${n.date}`));
  let change = false;
  for (const k of touchees) {
    const [personId, date] = k.split('|') as [string, ISODate];
    const monday = mondayOf(date);
    const semaine = semaines[monday];
    if (semaine?.statut !== 'publie' || !semaine.snapshot) continue;
    const publies = semaine.snapshot.filter((x) => x.personId === personId && x.date === date);
    const actuels = b.get(k) ?? [];
    if (signature(publies) === signature(actuels)) continue;
    semaines[monday] = { ...semaine, snapshot: semaine.snapshot.filter((x) => !(x.personId === personId && x.date === date)).concat(actuels.map((x) => ({ ...x }))) };
    change = true;
    // La personne absente ce jour-là a déjà reçu l'annonce de son absence ; une personne retirée de l'équipe n'a plus de compte.
    const absente = apres.absences.some((x) => x.personId === personId && x.statut === 'approuvee' && x.from <= date && date <= x.to);
    if (absente || dejaPrevenus.has(k) || !apres.personnes.some((p) => p.id === personId) || date < today) continue;
    notifications.push({ id: `n_${at}_${personId}_${date}`, personId, at, date, avant: decrireJournee(publies), apres: decrireJournee(actuels), tardif: dayIndex(date) - dayIndex(today) < 7 });
  }
  if (!change) return apres;
  return { ...apres, semaines, notifications: notifications.length ? [...notifications, ...apres.notifications] : apres.notifications };
}

export interface Delai {
  id: string;
  personId: string;
  /** Phrase complète, inscrite au journal. */
  message: string;
  /** L'essentiel, pour l'écran. */
  court: string;
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
          court: `prévenu ${Math.max(0, restants)} j avant, ${delaiPartiel} requis`,
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
          court: `${fmtDateCourt(c.date)} · prévenu ${Math.max(0, restants)} j avant, ${delaiPartiel} requis`,
        });
      }
    }
  }
  for (const g of data.gardes) {
    if (!g.personId || !weekDates(monday).includes(g.date) || g.communiqueLe) continue;
    const p = data.personnes.find((x) => x.id === g.personId);
    const d = delaiGarde(data, g, p, today);
    if (!d.ok && p) delais.push({ id: `garde|${g.id}`, personId: p.id, message: `Garde du ${fmtDateCourt(g.date)}, ${nomCourt(p)} : ${d.message}`, court: `garde du ${fmtDateCourt(g.date)}, prévenue trop tard` });
  }
  return { premiere, issues: validateWeek(data, monday), changements, delais };
}
