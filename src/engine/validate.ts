import { regleActive, valeurRegle } from '../domain/rules';
import {
  JOURS,
  absMin,
  addDays,
  dayIndex,
  fmtDuree,
  fmtHeure,
  fromDayIndex,
  overlaps,
  weekDates,
  weekday,
} from '../domain/time';
import type { AppData, ISODate, Person } from '../domain/types';
import { MISSION_COMPETENCE, MISSION_LABEL, estPharmacien, nomCourt } from '../domain/types';
import {
  besoinsDe,
  contreditBesoin,
  decrireBesoin,
  estAbsent,
  minutesTravail,
  occupations,
  ouverture,
  pharmacienSeulEnRendezVous,
  segmentsTravail,
  sousEffectifs,
  trousPharmacien,
} from './core';

export type Gravite = 'bloquant' | 'alerte' | 'info';

export interface Issue {
  id: string;
  regle: string;
  gravite: Gravite;
  personId?: string;
  date?: ISODate;
  start?: number;
  end?: number;
  message: string;
  detail?: string;
}

const jour = (date: ISODate): string => JOURS[weekday(date)];
const Jour = (date: ISODate): string => jour(date).charAt(0).toUpperCase() + jour(date).slice(1);

function instant(abs: number): string {
  const date = fromDayIndex(Math.floor(abs / 1440));
  return `${jour(date)} ${fmtHeure(abs % 1440)}`;
}

/**
 * Contrôle une semaine. Les règles de durée et de repos ne s'appliquent qu'aux salariés :
 * le titulaire est hors décompte.
 */
export function validateWeek(data: AppData, monday: ISODate): Issue[] {
  const issues: Issue[] = [];
  const dates = weekDates(monday);
  const R = data.regles;
  const add = (i: Omit<Issue, 'id'>): void => {
    issues.push({ ...i, id: `${i.regle}|${i.personId ?? ''}|${i.date ?? ''}|${i.start ?? ''}` });
  };

  const maxJour = valeurRegle(R, 'duree.quotidienne', 10) * 60;
  const maxAmplitude = valeurRegle(R, 'duree.amplitude', 12) * 60;
  const maxHebdo = valeurRegle(R, 'duree.hebdo', 46) * 60;
  const pauseMin = valeurRegle(R, 'duree.pause', 20);
  const reposJour = valeurRegle(R, 'repos.quotidien', 11) * 60;
  const reposHebdo = valeurRegle(R, 'repos.hebdo', 36) * 60;

  // ---- Présence pharmaceutique et effectif, jour par jour
  for (const date of dates) {
    if (regleActive(R, 'pharmacie.presence')) {
      for (const t of trousPharmacien(data, date)) {
        add({
          regle: 'pharmacie.presence',
          gravite: 'bloquant',
          date,
          start: t.start,
          end: t.end,
          message: `${Jour(date)}, de ${fmtHeure(t.start)} à ${fmtHeure(t.end)}, aucun pharmacien n'est planifié.`,
        });
      }
    }
    if (regleActive(R, 'pharmacie.rdv')) {
      for (const t of pharmacienSeulEnRendezVous(data, date)) {
        add({
          regle: 'pharmacie.rdv',
          gravite: 'alerte',
          date,
          start: t.start,
          end: t.end,
          message: `${Jour(date)}, entre ${fmtHeure(t.start)} et ${fmtHeure(t.end)}, votre seul pharmacien est en rendez-vous. Vérifiez la couverture du comptoir.`,
        });
      }
    }
    if (regleActive(R, 'equipe.effectif')) {
      for (const s of sousEffectifs(data, date)) {
        add({
          regle: 'equipe.effectif',
          gravite: 'alerte',
          date,
          start: s.start,
          end: s.end,
          message: `${Jour(date)}, de ${fmtHeure(s.start)} à ${fmtHeure(s.end)} : ${s.present} personne${
            s.present > 1 ? 's' : ''
          } au comptoir pour ${s.requis} attendue${s.requis > 1 ? 's' : ''}.`,
        });
      }
    }
  }

  // ---- Activités à compétence et salle
  if (regleActive(R, 'pharmacie.competence')) {
    const missions = data.missions.filter((m) => dates.includes(m.date));
    for (const m of missions) {
      const label = MISSION_LABEL[m.type];
      const quand = `${jour(m.date)} de ${fmtHeure(m.start)} à ${fmtHeure(m.end)}`;
      const p = data.personnes.find((x) => x.id === m.personId);
      if (!p) {
        add({
          regle: 'pharmacie.competence',
          gravite: 'alerte',
          date: m.date,
          start: m.start,
          end: m.end,
          message: `${label}, ${quand} : personne n'est affecté à ce créneau.`,
        });
        continue;
      }
      const requise = MISSION_COMPETENCE[m.type];
      if (requise && !p.competences.includes(requise)) {
        add({
          regle: 'pharmacie.competence',
          gravite: 'bloquant',
          personId: p.id,
          date: m.date,
          start: m.start,
          end: m.end,
          message: `${label}, ${quand} : ${nomCourt(p)} n'a pas la formation requise.`,
        });
      }
      const present = data.shifts
        .filter((s) => s.personId === p.id && s.date === m.date && s.activite !== 'formation')
        .flatMap(segmentsTravail)
        .some((i) => i.start <= m.start && m.end <= i.end);
      if (!present) {
        add({
          regle: 'pharmacie.competence',
          gravite: 'bloquant',
          personId: p.id,
          date: m.date,
          start: m.start,
          end: m.end,
          message: `${label}, ${quand} : ${nomCourt(p)} n'est pas en poste sur tout le créneau.`,
        });
      }
      if (m.salle) {
        const conflit = missions.find((o) => o.id < m.id && o.salle && o.date === m.date && overlaps(o, m));
        if (conflit) {
          add({
            regle: 'pharmacie.competence',
            gravite: 'bloquant',
            date: m.date,
            start: m.start,
            end: m.end,
            message: `La salle de confidentialité est réservée deux fois ${quand}.`,
          });
        }
      }
    }
  }

  // ---- Personne par personne
  for (const p of data.personnes) {
    const mine = data.shifts.filter((s) => s.personId === p.id && dates.includes(s.date));
    if (!mine.length && !data.gardes.some((g) => g.personId === p.id)) continue;

    for (const s of mine) {
      if (regleActive(R, 'equipe.absence') && estAbsent(data, p.id, s.date)) {
        add({
          regle: 'equipe.absence',
          gravite: 'bloquant',
          personId: p.id,
          date: s.date,
          start: s.start,
          end: s.end,
          message: `${nomCourt(p)} est en absence approuvée ${jour(s.date)} mais reste planifié(e).`,
        });
      }
      for (const b of besoinsDe(data, p.id, s.date)) {
        if (!contreditBesoin(b, s)) continue;
        if (b.statut === 'reconnue') {
          if (!regleActive(R, 'equipe.indisponibilite')) continue;
          add({
            regle: 'equipe.indisponibilite',
            gravite: 'bloquant',
            personId: p.id,
            date: s.date,
            start: s.start,
            end: s.end,
            message: `${Jour(s.date)}, le poste de ${nomCourt(p)} contredit une indisponibilité reconnue.`,
            detail: decrireBesoin(b),
          });
        } else {
          add({
            regle: 'souhait',
            gravite: 'info',
            personId: p.id,
            date: s.date,
            start: s.start,
            end: s.end,
            message: `${Jour(s.date)}, une préférence ${
              b.statut === 'prioritaire' ? 'prioritaire ' : ''
            }de ${nomCourt(p)} n'est pas satisfaite.`,
            detail: decrireBesoin(b),
          });
        }
      }
    }

    if (!p.salarie) continue;

    // Durées par jour
    for (const date of dates) {
      const duJour = mine.filter((s) => s.date === date);
      if (!duJour.length) continue;
      const total = duJour.reduce((t, s) => t + minutesTravail(s), 0);
      if (regleActive(R, 'duree.quotidienne') && total > maxJour) {
        add({
          regle: 'duree.quotidienne',
          gravite: 'bloquant',
          personId: p.id,
          date,
          message: `${nomCourt(p)} : ${fmtDuree(total)} de travail ${jour(date)}, pour ${fmtDuree(maxJour)} au plus.`,
        });
      }
      const debut = Math.min(...duJour.map((s) => s.start));
      const fin = Math.max(...duJour.map((s) => s.end));
      if (regleActive(R, 'duree.amplitude') && fin - debut > maxAmplitude) {
        add({
          regle: 'duree.amplitude',
          gravite: 'bloquant',
          personId: p.id,
          date,
          message: `${nomCourt(p)} : amplitude de ${fmtDuree(fin - debut)} ${jour(date)}, pour ${fmtDuree(
            maxAmplitude,
          )} au plus.`,
        });
      }
      if (regleActive(R, 'duree.pause')) {
        // Travail continu : segments du jour, fusionnés si la coupure est plus courte que la pause due.
        const segs = duJour.flatMap(segmentsTravail).sort((a, b) => a.start - b.start);
        let runStart = segs[0].start;
        let runEnd = segs[0].end;
        const check = (): void => {
          if (runEnd - runStart > 360) {
            add({
              regle: 'duree.pause',
              gravite: 'bloquant',
              personId: p.id,
              date,
              start: runStart,
              end: runEnd,
              message: `${nomCourt(p)} : ${fmtDuree(runEnd - runStart)} de travail continu ${jour(
                date,
              )} sans pause de ${pauseMin} minutes.`,
            });
          }
        };
        for (const seg of segs.slice(1)) {
          if (seg.start - runEnd < pauseMin) runEnd = Math.max(runEnd, seg.end);
          else {
            check();
            runStart = seg.start;
            runEnd = seg.end;
          }
        }
        check();
      }
    }

    // Durée hebdomadaire
    const totalSemaine = mine.reduce((t, s) => t + minutesTravail(s), 0);
    if (regleActive(R, 'duree.hebdo') && totalSemaine > maxHebdo) {
      add({
        regle: 'duree.hebdo',
        gravite: 'bloquant',
        personId: p.id,
        message: `${nomCourt(p)} : ${fmtDuree(totalSemaine)} planifiées cette semaine, pour ${fmtDuree(
          maxHebdo,
        )} au plus.`,
      });
    }

    // Seuils de confort choisis par l'officine : signalés, jamais bloquants.
    const confort = valeurRegle(R, 'equipe.heuresMax', 42) * 60;
    if (regleActive(R, 'equipe.heuresMax') && totalSemaine > confort && totalSemaine <= maxHebdo) {
      add({
        regle: 'equipe.heuresMax',
        gravite: 'alerte',
        personId: p.id,
        message: `${nomCourt(p)} : ${fmtDuree(totalSemaine)} cette semaine, au-dessus du plafond de l’officine (${fmtDuree(confort)}).`,
      });
    }
    const samedi = addDays(monday, 5);
    if (regleActive(R, 'equipe.samedisLibres') && mine.some((s) => s.date === samedi)) {
      const mois = samedi.slice(0, 7);
      const samedis: ISODate[] = [];
      for (let d = addDays(samedi, -28); d <= addDays(samedi, 28); d = addDays(d, 7)) if (d.slice(0, 7) === mois && ouverture(data.officine, d).length) samedis.push(d);
      const libres = samedis.filter((d) => !data.shifts.some((s) => s.personId === p.id && s.date === d)).length;
      const voulu = valeurRegle(R, 'equipe.samedisLibres', 1);
      if (samedis.length > 1 && libres < voulu) {
        add({
          regle: 'equipe.samedisLibres',
          gravite: 'alerte',
          personId: p.id,
          date: samedi,
          message: `${nomCourt(p)} travaille tous les samedis du mois : l’officine en garde ${voulu} libre${voulu > 1 ? 's' : ''}.`,
        });
      }
    }

    // Repos : on regarde aussi la veille et le lendemain de la semaine.
    const occ = occupations(data, p.id, addDays(monday, -7), addDays(monday, 13));
    const w0 = absMin(monday, 0);
    const w1 = w0 + 7 * 1440;
    if (regleActive(R, 'repos.quotidien')) {
      for (let i = 1; i < occ.length; i++) {
        const a = occ[i - 1];
        const b = occ[i];
        if (a.date === b.date) continue;
        if (b.start < w0 || b.start >= w1) continue;
        const gap = b.start - a.end;
        if (gap < reposJour) {
          add({
            regle: 'repos.quotidien',
            gravite: 'bloquant',
            personId: p.id,
            date: b.date,
            start: b.start % 1440,
            message: `${nomCourt(p)} : ${fmtDuree(Math.max(0, gap))} de repos entre ${instant(a.end)} et ${instant(
              b.start,
            )}, pour ${fmtDuree(reposJour)} requises.`,
            detail: a.nature === 'poste' ? undefined : `Précédé d'une ${a.label}.`,
          });
        }
      }
    }
    if (regleActive(R, 'repos.hebdo')) {
      const dansSemaine = occ.filter((o) => o.start < w1 && o.end > w0);
      if (dansSemaine.length) {
        let best = 0;
        const first = occ.indexOf(dansSemaine[0]);
        const last = occ.indexOf(dansSemaine[dansSemaine.length - 1]);
        for (let i = first; i <= last + 1; i++) {
          const prevEnd = i === 0 ? -Infinity : occ[i - 1].end;
          const nextStart = i >= occ.length ? Infinity : occ[i].start;
          best = Math.max(best, nextStart - prevEnd);
        }
        if (best < reposHebdo) {
          add({
            regle: 'repos.hebdo',
            gravite: 'bloquant',
            personId: p.id,
            message: `${nomCourt(p)} : le plus long repos de la semaine dure ${fmtDuree(best)}, pour ${fmtDuree(
              reposHebdo,
            )} requises.`,
          });
        }
      }
    }
  }

  const ordre: Record<Gravite, number> = { bloquant: 0, alerte: 1, info: 2 };
  return issues.sort(
    (a, b) =>
      ordre[a.gravite] - ordre[b.gravite] ||
      (a.date ?? '').localeCompare(b.date ?? '') ||
      (a.start ?? 0) - (b.start ?? 0),
  );
}

export const bloquants = (issues: Issue[]): Issue[] => issues.filter((i) => i.gravite === 'bloquant');

/** Contrôles portant sur l'équipe, indépendants d'une semaine. */
export function validateEquipe(data: AppData): Issue[] {
  const out: Issue[] = [];
  const R = data.regles;
  const partielMin = valeurRegle(R, 'contrat.partielMin', 16);
  for (const p of data.personnes) {
    if (p.externe || !p.salarie) continue;
    if (
      regleActive(R, 'contrat.partielMin') &&
      p.heuresHebdo < partielMin &&
      p.qualification !== 'etudiant' &&
      p.qualification !== 'apprenti'
    ) {
      out.push({
        id: `contrat.partielMin|${p.id}`,
        regle: 'contrat.partielMin',
        gravite: 'alerte',
        personId: p.id,
        message: `${nomCourt(p)} : contrat de ${p.heuresHebdo} h, sous le minimum de ${partielMin} h du temps partiel.`,
      });
    }
  }
  const quota = quotaAdjoints(data);
  if (regleActive(R, 'pharmacie.adjoints') && quota && quota.etpActuel < quota.etpRequis) {
    out.push({
      id: 'pharmacie.adjoints',
      regle: 'pharmacie.adjoints',
      gravite: 'alerte',
      message: `Adjoints : ${quota.etpActuel.toLocaleString('fr-FR')} équivalent temps plein pour ${quota.etpRequis} attendu${
        quota.etpRequis > 1 ? 's' : ''
      } au vu du chiffre d'affaires déclaré.`,
    });
  }
  return out;
}

export function quotaAdjoints(data: AppData): { etpRequis: number; etpActuel: number } | null {
  const ca = data.officine.caAnnuelHT;
  if (!ca) return null;
  const tranche = valeurRegle(data.regles, 'pharmacie.adjoints', 1_300_000);
  const etpRequis = Math.floor(ca / tranche);
  const etpActuel =
    Math.round(
      (data.personnes
        .filter((p: Person) => p.qualification === 'adjoint' && !p.externe)
        .reduce((t, p) => t + p.heuresHebdo, 0) /
        35) *
        100,
    ) / 100;
  return { etpRequis, etpActuel };
}

/** Pharmaciens de l'équipe, pour les messages de diagnostic. */
export const pharmaciensInternes = (data: AppData): Person[] =>
  data.personnes.filter((p) => estPharmacien(p) && !p.externe);

/** Jours de la semaine entre deux dates incluses, bornés à la semaine. */
export function joursCommuns(monday: ISODate, from: ISODate, to: ISODate): ISODate[] {
  return weekDates(monday).filter((d) => dayIndex(d) >= dayIndex(from) && dayIndex(d) <= dayIndex(to));
}
