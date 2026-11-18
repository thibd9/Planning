import { addDays, dayIndex, duree, fmtHeure, intersect, mondayOf, subtract, uid } from '../domain/time';
import type { AppData, ISODate, Minutes, Shift } from '../domain/types';
import { estAbsent, minutesTravail, ouverture, sousEffectifs } from './core';
import { indisponibilites } from './diagnose';
import { validateWeek } from './validate';
import type { Issue } from './validate';

/**
 * Régulariser un compteur à un moment précis : le titulaire choisit le jour et l'horaire, ou laisse Solvéa proposer.
 * Rattraper ajoute des heures (prolonger un poste, l'avancer, ou venir un jour de repos) ;
 * récupérer en retire (partir plus tôt, arriver plus tard, ou une journée de repos).
 * Chaque créneau est contrôlé avec les mêmes règles que le planning : rien de bloquant n'est proposé.
 */

export type SensRegul = 'rattrapage' | 'recuperation';
export type FormeCreneau = 'prolonger' | 'avancer' | 'nouveau' | 'partir_tot' | 'arriver_tard' | 'repos';

export const FORME_LABEL: Record<FormeCreneau, string> = {
  prolonger: 'Prolonge sa journée',
  avancer: 'Commence plus tôt',
  nouveau: 'Vient un jour de repos',
  partir_tot: 'Part plus tôt',
  arriver_tard: 'Arrive plus tard',
  repos: 'Journée de repos',
};

/** La tranche ajoutée (rattrapage) ou retirée (récupération) du planning d'une personne. */
export interface Creneau {
  date: ISODate;
  start: Minutes;
  end: Minutes;
}

export interface Controle {
  /** Ce qui empêche de retenir ce créneau. */
  bloquants: string[];
  /** Ce qu'il faut savoir avant de le retenir. */
  alertes: string[];
  /** Ce qui plaide pour lui. */
  atouts: string[];
  forme: FormeCreneau | null;
  /** Minutes de travail réellement ajoutées ou retirées (pauses déduites). */
  minutes: number;
  /** Le planning de cette semaine est déjà communiqué à l'équipe. */
  publie: boolean;
  /** À moins de sept jours : l'accord de la personne est nécessaire. */
  tardif: boolean;
  /** Aucun poste n'est encore posé cette semaine-là. */
  aConstruire: boolean;
}

export interface Proposition extends Creneau {
  controle: Controle;
  score: number;
}

const duJour = (data: Pick<AppData, 'shifts'>, personId: string, date: ISODate): Shift[] =>
  data.shifts.filter((s) => s.personId === personId && s.date === date).sort((a, b) => a.start - b.start);

/** Le planning une fois le créneau appliqué, et la forme que prend le changement ; `null` s'il ne peut pas s'appliquer. */
export function appliquerCreneau(data: AppData, personId: string, c: Creneau, sens: SensRegul): { data: AppData; forme: FormeCreneau; raison?: undefined } | { data: null; forme: null; raison: string } {
  const postes = duJour(data, personId, c.date);
  const autres = data.shifts.filter((s) => !(s.personId === personId && s.date === c.date));
  const avec = (jour: Shift[], forme: FormeCreneau): { data: AppData; forme: FormeCreneau } => ({ data: { ...data, shifts: autres.concat(jour) }, forme });
  if (c.end <= c.start) return { data: null, forme: null, raison: 'L’heure de fin doit suivre l’heure de début.' };
  if (sens === 'rattrapage') {
    if (postes.some((s) => s.start < c.end && c.start < s.end)) return { data: null, forme: null, raison: 'Ce créneau chevauche un poste déjà prévu ce jour-là.' };
    const avant = postes.find((s) => s.end === c.start);
    const apres = postes.find((s) => s.start === c.end);
    const modifie = (s: Shift, patch: Partial<Shift>): Shift => ({ ...s, ...patch, origine: 'manuel', explication: 'Rattrapage d’heures.' });
    if (avant) return avec(postes.map((s) => (s === avant ? modifie(s, { end: c.end }) : s)), 'prolonger');
    if (apres) return avec(postes.map((s) => (s === apres ? modifie(s, { start: c.start }) : s)), 'avancer');
    const nouveau: Shift = { id: uid('s'), personId, date: c.date, start: c.start, end: c.end, activite: 'comptoir', origine: 'manuel', explication: 'Rattrapage d’heures.' };
    return avec(postes.concat(nouveau), 'nouveau');
  }
  const vise = postes.find((s) => s.start <= c.start && c.end <= s.end);
  if (!vise) return { data: null, forme: null, raison: postes.length ? 'Les heures à récupérer doivent tomber dans un poste prévu ce jour-là.' : 'Aucun poste n’est prévu ce jour-là : il n’y a rien à récupérer.' };
  const reste = postes.filter((s) => s !== vise);
  if (c.start === vise.start && c.end === vise.end) return avec(reste, 'repos');
  if (c.start !== vise.start && c.end !== vise.end) return { data: null, forme: null, raison: 'Retirez les heures au début ou à la fin du poste, pas au milieu.' };
  const debut = c.start === vise.start ? c.end : vise.start;
  const fin = c.start === vise.start ? vise.end : c.start;
  // La pause ne survit que si elle reste à l'intérieur du poste raccourci.
  const pause = vise.pauseStart !== undefined && vise.pauseEnd !== undefined && vise.pauseStart > debut && vise.pauseEnd < fin;
  const court: Shift = { ...vise, start: debut, end: fin, pauseStart: pause ? vise.pauseStart : undefined, pauseEnd: pause ? vise.pauseEnd : undefined, origine: 'manuel', explication: 'Récupération d’heures.' };
  return avec(reste.concat(court), c.start === vise.start ? 'arriver_tard' : 'partir_tot');
}

const cle = (i: Issue): string => `${i.regle}|${i.personId ?? ''}|${i.date ?? ''}|${i.start ?? ''}|${i.end ?? ''}`;
const travail = (data: Pick<AppData, 'shifts'>, personId: string, date: ISODate): number => duJour(data, personId, date).reduce((t, s) => t + minutesTravail(s), 0);

/** Contrôle un créneau : fermeture, absence, indisponibilité, puis toutes les règles du planning, avant et après. */
export function controlerCreneau(data: AppData, personId: string, c: Creneau, sens: SensRegul, today: ISODate, avant?: Issue[]): Controle {
  const monday = mondayOf(c.date);
  const p = data.personnes.find((x) => x.id === personId);
  const prenom = p?.prenom ?? 'La personne';
  const publie = data.semaines[monday]?.statut === 'publie';
  const jours = dayIndex(c.date) - dayIndex(today);
  const aConstruire = !publie && !data.shifts.some((s) => mondayOf(s.date) === monday);
  const base: Controle = { bloquants: [], alertes: [], atouts: [], forme: null, minutes: 0, publie, tardif: jours < 7, aConstruire };
  if (!p) return { ...base, bloquants: ['Personne introuvable.'] };
  if (jours < 1) return { ...base, bloquants: ['Choisissez un jour à venir : aujourd’hui et le passé ne se modifient pas ici.'] };
  const ouvert = ouverture(data.officine, c.date);
  if (sens === 'rattrapage') {
    if (!ouvert.length) return { ...base, bloquants: ['L’officine est fermée ce jour-là.'] };
    if (duree({ start: c.start, end: c.end }) > 0 && subtract([{ start: c.start, end: c.end }], ouvert).length) base.bloquants.push(`L’officine n’est ouverte que ${ouvert.map((o) => `de ${fmtHeure(o.start)} à ${fmtHeure(o.end)}`).join(' et ')} ce jour-là.`);
    if (estAbsent(data, personId, c.date)) base.bloquants.push(`${prenom} est en absence approuvée ce jour-là.`);
    else {
      const gene = indisponibilites(data, p, c.date).find((i) => intersect(i.plages, [{ start: c.start, end: c.end }]).length);
      if (gene) base.bloquants.push(`${prenom} n’est pas disponible à ces heures : ${gene.raison}.`);
    }
  }
  const res = appliquerCreneau(data, personId, c, sens);
  if (!res.data) return { ...base, bloquants: [...base.bloquants, res.raison] };
  const minutes = Math.abs(travail(res.data, personId, c.date) - travail(data, personId, c.date));
  const deja = new Set((avant ?? validateWeek(data, monday)).map(cle));
  const neufs = validateWeek(res.data, monday).filter((i) => !deja.has(cle(i)));
  for (const i of neufs) {
    if (i.gravite === 'bloquant') base.bloquants.push(i.message);
    else if (i.gravite === 'alerte') base.alertes.push(i.message);
  }
  if (sens === 'rattrapage') {
    const manque = intersect(sousEffectifs(data, c.date), [{ start: c.start, end: c.end }]).reduce((t, i) => t + duree(i), 0);
    if (manque > 0) base.atouts.push('Comble un manque au comptoir');
  } else if (!neufs.some((i) => i.regle === 'equipe.effectif' || i.regle === 'pharmacie.presence')) base.atouts.push('Le comptoir reste couvert');
  if (publie) base.alertes.unshift(base.tardif ? `Planning déjà communiqué, à moins de sept jours : il faut l’accord de ${prenom}.` : `Planning déjà communiqué : ${prenom} est prévenu du changement.`);
  else if (aConstruire) base.alertes.unshift('Semaine pas encore construite : au calcul, choisissez « Conserver les postes déjà posés ».');
  return { ...base, bloquants: [...new Set(base.bloquants)], alertes: [...new Set(base.alertes)], forme: res.forme, minutes };
}

/**
 * Les meilleurs créneaux des quatre prochaines semaines, un par jour au plus.
 * Rattrapage : d'abord là où le comptoir manque de monde, plutôt en prolongeant une journée, le plus tôt possible.
 * Récupération : là où l'effectif le permet, sans découvrir le comptoir ni le pharmacien.
 */
export function proposerCreneaux(data: AppData, personId: string, minutes: number, sens: SensRegul, today: ISODate, nombre = 3, horizon = 28): Proposition[] {
  const voulu = Math.max(30, Math.round(minutes / 30) * 30);
  const base = new Map<ISODate, Issue[]>();
  const controles = (monday: ISODate): Issue[] => {
    if (!base.has(monday)) base.set(monday, validateWeek(data, monday));
    return base.get(monday) as Issue[];
  };
  const parJour: Proposition[] = [];
  for (let j = 1; j <= horizon; j++) {
    const date = addDays(today, j);
    const monday = mondayOf(date);
    // On ne propose que dans un planning qui existe : une semaine vide se construira avec l'objectif d'heures corrigé.
    if (!data.shifts.some((s) => mondayOf(s.date) === monday)) continue;
    const ouvert = ouverture(data.officine, date);
    if (!ouvert.length || estAbsent(data, personId, date)) continue;
    const postes = duJour(data, personId, date);
    const candidats: Creneau[] = [];
    if (sens === 'rattrapage') {
      const dernier = postes[postes.length - 1];
      const premier = postes[0];
      if (dernier) {
        const o = ouvert.find((x) => x.start <= dernier.end && dernier.end < x.end);
        if (o) candidats.push({ date, start: dernier.end, end: Math.min(dernier.end + voulu, o.end) });
      }
      if (premier) {
        const o = ouvert.find((x) => x.start < premier.start && premier.start <= x.end);
        if (o) candidats.push({ date, start: Math.max(premier.start - voulu, o.start), end: premier.start });
      }
      if (!postes.length) {
        // Jour de repos : on vise la tranche où le comptoir manque le plus de monde, sinon l'ouverture. Six heures au plus, sans pause à prévoir.
        const court = Math.min(voulu, 360);
        const manques = sousEffectifs(data, date).sort((a, b) => duree(b) - duree(a));
        for (const depart of [manques[0]?.start, ouvert[0].start]) {
          if (depart === undefined) continue;
          const o = ouvert.find((x) => x.start <= depart && depart < x.end);
          if (!o) continue;
          const start = Math.max(o.start, Math.min(depart, o.end - court));
          candidats.push({ date, start, end: Math.min(start + court, o.end) });
        }
      }
    } else {
      for (const s of postes) {
        if (minutesTravail(s) <= voulu) candidats.push({ date, start: s.start, end: s.end });
        else {
          candidats.push({ date, start: s.end - voulu, end: s.end });
          candidats.push({ date, start: s.start, end: s.start + voulu });
        }
      }
    }
    let meilleur: Proposition | null = null;
    for (const c of candidats) {
      if (c.end - c.start < 30) continue;
      const controle = controlerCreneau(data, personId, c, sens, today, controles(monday));
      if (controle.bloquants.length || controle.minutes < 30) continue;
      const manque = sens === 'rattrapage' ? intersect(sousEffectifs(data, date), [c]).reduce((t, i) => t + duree(i), 0) : 0;
      const score =
        (Math.min(controle.minutes, voulu) / 30) * 2 +
        (manque / 30) * 6 -
        j * 0.4 -
        (controle.alertes.length - (controle.publie ? 1 : 0)) * 8 -
        (controle.publie ? (controle.tardif ? 12 : 3) : 0) +
        (controle.forme === 'prolonger' || controle.forme === 'partir_tot' ? 2 : controle.forme === 'nouveau' ? -4 : controle.forme === 'repos' ? 3 : 0);
      if (!meilleur || score > meilleur.score) meilleur = { ...c, controle, score };
    }
    if (meilleur) parJour.push(meilleur);
  }
  return parJour.sort((a, b) => b.score - a.score).slice(0, nombre);
}
