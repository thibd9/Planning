import { valeurRegle } from '../domain/rules';
import { JOURS, absMin, addDays, dayIndex, uid, weekDates, weekday } from '../domain/time';
import type { AppData, ISODate, Interval, Person, PosteType, Shift } from '../domain/types';
import { estPharmacien, nomCourt } from '../domain/types';
import {
  besoinsDe,
  contreditBesoin,
  effectifRequis,
  equipeInterne,
  estAbsent,
  estFermeture,
  estOuverture,
  minutesSemaine,
  minutesTravail,
  occupations,
  ouverture,
  segmentsTravail,
  shiftsSemaine,
} from './core';
import type { Blocage } from './diagnose';
import { diagnosticPrealable, diagnosticResultat } from './diagnose';
import { ecartEquite, equite, fatigue, periodeAvant } from './equity';
import { coutSemaine, decompteSemaine } from './payroll';
import { validateWeek } from './validate';

export type Variante = 'equite' | 'souhaits' | 'cout';

export const VARIANTE_LABEL: Record<Variante, { titre: string; phrase: string }> = {
  equite: { titre: 'Équité d’abord', phrase: 'Répartit samedis et fermetures selon l’historique de chacun.' },
  souhaits: { titre: 'Souhaits d’abord', phrase: 'Satisfait le plus de préférences possible.' },
  cout: { titre: 'Coût d’abord', phrase: 'Évite les heures au-delà des contrats.' },
};

export interface GenOptions {
  variante: Variante;
  graine?: number;
  /** Conserver les postes déjà posés et ne compléter que le reste. */
  conserver?: boolean;
  iterations?: number;
}

export interface Indicateurs {
  bloquants: number;
  /** Minutes d'ouverture sous l'effectif attendu. */
  sousEffectif: number;
  /** Part des souhaits (préférences acceptées) satisfaits, de 0 à 1 ; null s'il n'y en a aucun. */
  souhaits: number | null;
  souhaitsTotal: number;
  /** Écart type (réel − attendu) des samedis sur 8 semaines, semaine comprise. */
  ecartSamedis: number;
  ecartFermetures: number;
  coutEstime: number;
  /** Minutes planifiées au-delà des contrats. */
  auDela: number;
  fatigueElevee: number;
}

export interface GenResult {
  variante: Variante;
  /** Tous les postes de la semaine (conservés compris). */
  shifts: Shift[];
  indicateurs: Indicateurs;
  blocages: Blocage[];
}

interface Poids {
  sous: number;
  sur: number;
  prioritaire: number;
  preference: number;
  samedi: number;
  fermeture: number;
  etalement: number;
  fatigue: number;
  confort: number;
  /** Coût d'un jour travaillé : à heures égales, moins de jours mais mieux remplis. */
  jour: number;
}

const POIDS: Record<Variante, Poids> = {
  equite: { sous: 3, sur: 4, prioritaire: 25, preference: 6, samedi: 22, fermeture: 6, etalement: 4, fatigue: 6, confort: 0.05, jour: 3 },
  souhaits: { sous: 3, sur: 4, prioritaire: 90, preference: 35, samedi: 12, fermeture: 2, etalement: 1.5, fatigue: 5, confort: 0.05, jour: 3 },
  cout: { sous: 2, sur: 40, prioritaire: 25, preference: 6, samedi: 12, fermeture: 2, etalement: 1.5, fatigue: 5, confort: 0, jour: 3 },
};

const PAS = 15;
const SLOTS = 1440 / PAS;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Option {
  poste: PosteType | null;
  start: number;
  end: number;
  minutes: number;
  slots: number[];
  ferme: boolean;
  ouvre: boolean;
}

const slotsDe = (segs: Interval[]): number[] => {
  const out: number[] = [];
  for (const s of segs) for (let t = Math.floor(s.start / PAS); t < Math.ceil(s.end / PAS); t++) out.push(t);
  return out;
};

/**
 * Propose un planning pour la semaine.
 *
 * Le calcul classe les solutions sur trois niveaux qui ne se compensent jamais :
 * 1. règles impératives (durées, repos, présence d'un pharmacien, absences, indisponibilités reconnues) ;
 * 2. effectif attendu au comptoir ;
 * 3. objectifs souples (contrats, souhaits, équité, fatigue, coût).
 * Une bonne préférence ne rachète donc jamais la violation d'une règle impérative.
 */
export function generer(data: AppData, monday: ISODate, opts: GenOptions): GenResult {
  const W = POIDS[opts.variante];
  const rand = mulberry32(opts.graine ?? 1);
  const personnes = equipeInterne(data);
  const dates = weekDates(monday).filter((d) => ouverture(data.officine, d).length > 0);
  const existants = shiftsSemaine(data, monday);
  const fixes = opts.conserver ? existants : existants.filter((s) => data.personnes.find((p) => p.id === s.personId)?.externe);
  const base: AppData = { ...data, shifts: data.shifts.filter((s) => !existants.includes(s)).concat(fixes) };
  const prealable = diagnosticPrealable(base, monday);

  const R = data.regles;
  const maxHebdo = valeurRegle(R, 'duree.hebdo', 46) * 60;
  const reposJour = valeurRegle(R, 'repos.quotidien', 11) * 60;
  const reposHebdo = valeurRegle(R, 'repos.hebdo', 36) * 60;
  const w0 = absMin(monday, 0);

  // ---- Options par jour
  const options: Option[][] = dates.map((date) => {
    const wd = weekday(date);
    const list: Option[] = [{ poste: null, start: 0, end: 0, minutes: 0, slots: [], ferme: false, ouvre: false }];
    for (const poste of data.officine.postes) {
      if (!poste.jours.includes(wd)) continue;
      list.push({
        poste,
        start: poste.start,
        end: poste.end,
        minutes: minutesTravail(poste),
        slots: slotsDe(segmentsTravail(poste)),
        ferme: estFermeture(data.officine, { date, end: poste.end }),
        ouvre: estOuverture(data.officine, { date, start: poste.start }),
      });
    }
    return list;
  });

  // ---- Besoins par créneau
  const requis: Int16Array[] = dates.map((date) => {
    const a = new Int16Array(SLOTS).fill(-1); // -1 : fermé
    for (const o of ouverture(data.officine, date)) {
      for (let t = Math.floor(o.start / PAS); t < Math.ceil(o.end / PAS); t++) {
        a[t] = effectifRequis(data.officine, date, t * PAS);
      }
    }
    return a;
  });

  // ---- Postes fixes : présence déjà acquise
  const basePharma = dates.map(() => new Int16Array(SLOTS));
  const baseEquipe = dates.map(() => new Int16Array(SLOTS));
  const estPh = new Map(data.personnes.map((p) => [p.id, estPharmacien(p)]));
  for (const s of fixes) {
    const d = dates.indexOf(s.date);
    if (d < 0 || s.activite === 'formation') continue;
    for (const t of slotsDe(segmentsTravail(s))) {
      if (estPh.get(s.personId)) basePharma[d][t]++;
      if (s.activite === 'comptoir') baseEquipe[d][t]++;
    }
  }

  // ---- Historique d'équité avant la semaine (8 semaines)
  const hist = equite(base, periodeAvant(monday, 8).from, addDays(monday, -1));
  const biais = (personId: string, cle: 'samedis' | 'fermetures'): number => {
    const l = hist.find((x) => x.personId === personId);
    if (!l || l.attendu[cle] === null) return 0;
    return Math.max(-2, Math.min(4, l.reel[cle] - (l.attendu[cle] as number)));
  };

  // ---- Variables : une option par personne et par jour
  const P = personnes.length;
  const D = dates.length;
  const fixeJour: (Shift[] | null)[][] = personnes.map((p) =>
    dates.map((date) => {
      const l = fixes.filter((s) => s.personId === p.id && s.date === date);
      return l.length ? l : null;
    }),
  );
  const occFixes = personnes.map((p) => occupations(base, p.id, addDays(monday, -7), addDays(monday, 13)));
  const permis: number[][][] = personnes.map((p, pi) =>
    dates.map((date, d) => {
      if (fixeJour[pi][d]) return [0];
      if (estAbsent(data, p.id, date)) return [0];
      const reconnus = besoinsDe(data, p.id, date).filter((b) => b.statut === 'reconnue');
      const ok = [0];
      options[d].forEach((o, oi) => {
        if (oi === 0) return;
        if (reconnus.some((b) => contreditBesoin(b, o))) return;
        if (p.salarie) {
          const a = absMin(date, o.start);
          const b = absMin(date, o.end);
          // Chevauchement ou repos insuffisant avec une garde ou un poste hors de la semaine.
          const conflit = occFixes[pi].some((x) => {
            if (x.start < b && a < x.end) return true;
            if (x.date === date) return false;
            const dansSemaine = x.nature === 'poste' && x.start >= w0 && x.start < w0 + 7 * 1440;
            if (dansSemaine) return false; // traité par le coût de la personne
            return (x.end <= a && a - x.end < reposJour) || (x.start >= b && x.start - b < reposJour);
          });
          if (conflit) return;
        }
        ok.push(oi);
      });
      // Un rendez-vous déjà confié à la personne impose un poste qui le couvre en entier.
      const rdv = data.missions.filter((m) => m.personId === p.id && m.date === date);
      if (rdv.length) {
        const couvrants = ok.filter(
          (oi) =>
            oi !== 0 &&
            rdv.every((m) => segmentsTravail(options[d][oi].poste as PosteType).some((x) => x.start <= m.start && m.end <= x.end)),
        );
        if (couvrants.length) return couvrants;
      }
      return ok;
    }),
  );
  const penalitePref: number[][][] = personnes.map((p, pi) =>
    dates.map((date, d) => {
      const souples = besoinsDe(data, p.id, date).filter((b) => b.statut !== 'reconnue');
      return options[d].map((o, oi) => {
        if (oi === 0 || !permis[pi][d].includes(oi)) return 0;
        let t = 0;
        for (const b of souples) {
          if (contreditBesoin(b, o)) t += b.statut === 'prioritaire' ? W.prioritaire : W.preference;
        }
        return t;
      });
    }),
  );
  const minutesFixes = personnes.map((p) => fixes.filter((s) => s.personId === p.id).reduce((t, s) => t + minutesTravail(s), 0));
  const choix: number[][] = personnes.map((_, pi) => dates.map((_, d) => permis[pi][d][0]));

  const span = (pi: number, d: number): { start: number; end: number; ferme: boolean; ouvre: boolean } | null => {
    const f = fixeJour[pi][d];
    if (f) {
      const start = Math.min(...f.map((s) => s.start));
      const end = Math.max(...f.map((s) => s.end));
      return {
        start,
        end,
        ferme: estFermeture(data.officine, { date: dates[d], end }),
        ouvre: estOuverture(data.officine, { date: dates[d], start }),
      };
    }
    const o = options[d][choix[pi][d]];
    return o.poste ? o : null;
  };

  const HARD = 1e7;
  const MED = 1e3;

  function coutPersonne(pi: number): number {
    const p = personnes[pi];
    let hard = 0;
    let soft = 0;
    let minutes = minutesFixes[pi];
    let fermetures = 0;
    let joursTravailles = 0;
    let prev: ReturnType<typeof span> = null;
    let prevD = -2;
    const mine: Interval[] = [];
    for (let d = 0; d < D; d++) {
      const s = span(pi, d);
      if (!s) continue;
      joursTravailles++;
      const oi = choix[pi][d];
      if (!fixeJour[pi][d]) {
        minutes += options[d][oi].minutes;
        soft += penalitePref[pi][d][oi];
      }
      const wd = weekday(dates[d]);
      if (wd === 5) soft += W.samedi * Math.max(0.2, 1 + 0.5 * biais(p.id, 'samedis'));
      else if (s.ferme) {
        fermetures++;
        soft += W.fermeture * Math.max(0.2, 1 + 0.5 * biais(p.id, 'fermetures'));
      }
      const a = absMin(dates[d], s.start);
      const b = absMin(dates[d], s.end);
      mine.push({ start: a, end: b });
      if (prev && dayIndex(dates[d]) - dayIndex(dates[prevD]) === 1) {
        const gap = a - absMin(dates[prevD], prev.end);
        if (p.salarie && gap < reposJour) hard += 1;
        if (prev.ferme && s.ouvre) soft += W.fatigue;
      }
      prev = s;
      prevD = d;
    }
    soft += W.jour * joursTravailles;
    if (joursTravailles >= 6) soft += W.fatigue * 6;
    // Étalement des fermetures, au prorata du temps de travail.
    const charge = fermetures * (35 / Math.max(8, p.heuresHebdo));
    soft += W.etalement * charge * charge;

    const contrat = p.heuresHebdo * 60;
    const ecart = (minutes - contrat) / 60;
    // Un petit écart au contrat coûte peu, un gros écart coûte très cher : personne n'est laissé loin de son contrat.
    const e = Math.abs(ecart);
    soft += (ecart < 0 || !p.salarie ? W.sous : W.sur) * e + 2 * e * e;

    if (p.salarie) {
      if (minutes > maxHebdo) hard += Math.ceil((minutes - maxHebdo) / PAS);
      // Repos hebdomadaire : plus long intervalle sans occupation autour de la semaine.
      if (mine.length) {
        const w1 = w0 + 7 * 1440;
        const all = occFixes[pi]
          .filter((x) => !(x.nature === 'poste' && x.start >= w0 && x.start < w1))
          .map((x) => ({ start: x.start, end: x.end }))
          .concat(mine)
          .sort((x, y) => x.start - y.start);
        let best = 0;
        let prevEnd = -Infinity;
        for (let i = 0; i <= all.length; i++) {
          const nextStart = i === all.length ? Infinity : all[i].start;
          if (nextStart > w0 && prevEnd < w1) best = Math.max(best, nextStart - prevEnd);
          if (i < all.length) prevEnd = Math.max(prevEnd, all[i].end);
        }
        if (best < reposHebdo) hard += 1;
      }
    }
    return hard * HARD + soft;
  }

  const pharma = new Int16Array(SLOTS);
  const equipe = new Int16Array(SLOTS);
  function coutJour(d: number): number {
    pharma.set(basePharma[d]);
    equipe.set(baseEquipe[d]);
    for (let pi = 0; pi < P; pi++) {
      const oi = choix[pi][d];
      if (oi === 0) continue;
      const ph = estPh.get(personnes[pi].id);
      for (const t of options[d][oi].slots) {
        equipe[t]++;
        if (ph) pharma[t]++;
      }
    }
    let hard = 0;
    let med = 0;
    let soft = 0;
    const req = requis[d];
    for (let t = 0; t < SLOTS; t++) {
      if (req[t] < 0) continue;
      if (pharma[t] === 0) hard++;
      if (equipe[t] < req[t]) med += req[t] - equipe[t];
      if (equipe[t] < req[t] + 1) soft += W.confort * (req[t] + 1 - equipe[t]);
    }
    return hard * HARD + med * MED + soft;
  }

  const cP = personnes.map((_, pi) => coutPersonne(pi));
  const cJ = dates.map((_, d) => coutJour(d));
  let total = cP.reduce((a, b) => a + b, 0) + cJ.reduce((a, b) => a + b, 0);

  // ---- Recuit simulé sur trois mouvements : changer un poste, échanger entre deux personnes, échanger deux jours.
  const N = P && D ? (opts.iterations ?? 40000) : 0;
  let best = total;
  let bestChoix = choix.map((r) => r.slice());
  const T0 = 40;
  const T1 = 0.05;
  for (let it = 0; it < N; it++) {
    const T = T0 * Math.pow(T1 / T0, it / N);
    const move = rand();
    const pi = Math.floor(rand() * P);
    const d = Math.floor(rand() * D);
    const undo: [number, number, number][] = [];
    const set = (p: number, dd: number, v: number): void => {
      undo.push([p, dd, choix[p][dd]]);
      choix[p][dd] = v;
    };
    if (move < 0.6) {
      const ok = permis[pi][d];
      if (ok.length < 2) continue;
      const v = ok[Math.floor(rand() * ok.length)];
      if (v === choix[pi][d]) continue;
      set(pi, d, v);
    } else if (move < 0.85) {
      const pj = Math.floor(rand() * P);
      if (pj === pi) continue;
      const a = choix[pi][d];
      const b = choix[pj][d];
      if (a === b || !permis[pi][d].includes(b) || !permis[pj][d].includes(a)) continue;
      set(pi, d, b);
      set(pj, d, a);
    } else {
      const e = Math.floor(rand() * D);
      if (e === d) continue;
      const a = options[d][choix[pi][d]].poste;
      const b = options[e][choix[pi][e]].poste;
      const versE = a ? options[e].findIndex((o) => o.poste?.id === a.id) : 0;
      const versD = b ? options[d].findIndex((o) => o.poste?.id === b.id) : 0;
      if (versE < 0 || versD < 0 || !permis[pi][e].includes(versE) || !permis[pi][d].includes(versD)) continue;
      if (versD === choix[pi][d] && versE === choix[pi][e]) continue;
      set(pi, d, versD);
      set(pi, e, versE);
    }
    const ps = [...new Set(undo.map((u) => u[0]))];
    const ds = [...new Set(undo.map((u) => u[1]))];
    let delta = 0;
    const np = ps.map((p) => coutPersonne(p));
    const nd = ds.map((dd) => coutJour(dd));
    ps.forEach((p, i) => (delta += np[i] - cP[p]));
    ds.forEach((dd, i) => (delta += nd[i] - cJ[dd]));
    if (delta <= 0 || rand() < Math.exp(-delta / T)) {
      ps.forEach((p, i) => (cP[p] = np[i]));
      ds.forEach((dd, i) => (cJ[dd] = nd[i]));
      total += delta;
      if (total < best - 1e-9) {
        best = total;
        bestChoix = choix.map((r) => r.slice());
      }
    } else {
      for (const [p, dd, v] of undo.reverse()) choix[p][dd] = v;
    }
  }
  bestChoix.forEach((r, pi) => r.forEach((v, d) => (choix[pi][d] = v)));

  // ---- Descente finale : plus aucun changement simple n'améliore le planning.
  let ameliore = N > 0;
  let tours = 0;
  while (ameliore && tours++ < 6) {
    ameliore = false;
    for (let pi = 0; pi < P; pi++) {
      for (let d = 0; d < D; d++) {
        const avant = choix[pi][d];
        let meilleur = avant;
        let cout = coutPersonne(pi) + coutJour(d);
        for (const v of permis[pi][d]) {
          if (v === avant) continue;
          choix[pi][d] = v;
          const c = coutPersonne(pi) + coutJour(d);
          if (c < cout - 1e-9) {
            cout = c;
            meilleur = v;
          }
        }
        choix[pi][d] = meilleur;
        if (meilleur !== avant) ameliore = true;
      }
    }
  }

  // ---- Résultat
  const nouveaux: Shift[] = [];
  personnes.forEach((p, pi) => {
    dates.forEach((date, d) => {
      const o = options[d][choix[pi][d]];
      if (!o.poste) return;
      nouveaux.push({
        id: uid('s'),
        personId: p.id,
        date,
        start: o.poste.start,
        end: o.poste.end,
        pauseStart: o.poste.pauseStart,
        pauseEnd: o.poste.pauseEnd,
        activite: 'comptoir',
        origine: 'genere',
      });
    });
  });
  const shifts = [...fixes, ...nouveaux];
  const resultat: AppData = { ...base, shifts: base.shifts.filter((s) => !fixes.includes(s)).concat(shifts) };
  expliquer(resultat, nouveaux, hist);

  return {
    variante: opts.variante,
    shifts,
    indicateurs: indicateurs(resultat, monday),
    blocages: diagnosticResultat(resultat, monday, prealable),
  };
}

/** Indicateurs lisibles d'une semaine, pour comparer des variantes côte à côte. */
export function indicateurs(data: AppData, monday: ISODate): Indicateurs {
  const issues = validateWeek(data, monday);
  const dates = weekDates(monday).filter((d) => ouverture(data.officine, d).length > 0);
  let total = 0;
  let satisfaits = 0;
  for (const p of equipeInterne(data)) {
    for (const date of dates) {
      if (estAbsent(data, p.id, date)) continue;
      const duJour = data.shifts.filter((s) => s.personId === p.id && s.date === date);
      for (const b of besoinsDe(data, p.id, date)) {
        if (b.statut === 'reconnue') continue;
        total++;
        if (!duJour.some((s) => contreditBesoin(b, s))) satisfaits++;
      }
    }
  }
  const lignes = equite(data, addDays(monday, -49), addDays(monday, 6));
  let auDela = 0;
  let fatigueElevee = 0;
  for (const p of equipeInterne(data)) {
    auDela += decompteSemaine(data, p, minutesSemaine(data, p.id, monday)).auDela;
    if (fatigue(data, p.id, monday).niveau === 'élevée') fatigueElevee++;
  }
  return {
    bloquants: issues.filter((i) => i.gravite === 'bloquant').length,
    sousEffectif: issues
      .filter((i) => i.regle === 'equipe.effectif')
      .reduce((t, i) => t + ((i.end ?? 0) - (i.start ?? 0)), 0),
    souhaits: total ? satisfaits / total : null,
    souhaitsTotal: total,
    ecartSamedis: ecartEquite(lignes, 'samedis'),
    ecartFermetures: ecartEquite(lignes, 'fermetures'),
    coutEstime: coutSemaine(data, monday),
    auDela,
    fatigueElevee,
  };
}

/**
 * Rédige, pour chaque affectation qui peut être contestée (samedi, fermeture),
 * une phrase fondée sur des faits vérifiables : compteurs passés et disponibilités du jour.
 */
function expliquer(data: AppData, nouveaux: Shift[], hist: ReturnType<typeof equite>): void {
  const personnes = equipeInterne(data);
  const parId = new Map(personnes.map((p) => [p.id, p]));
  const reel = (id: string, cle: 'samedis' | 'fermetures'): number => hist.find((l) => l.personId === id)?.reel[cle] ?? 0;
  const fois = (n: number): string => (n === 0 ? 'aucune fois' : n === 1 ? 'une fois' : `${n} fois`);

  for (const s of nouveaux) {
    const p = parId.get(s.personId);
    if (!p) continue;
    const wd = weekday(s.date);
    const memeRole = (q: Person): boolean => estPharmacien(q) === estPharmacien(p) && q.id !== p.id;
    const disponibles = personnes.filter(
      (q) =>
        memeRole(q) &&
        !estAbsent(data, q.id, s.date) &&
        !besoinsDe(data, q.id, s.date).some((b) => b.statut === 'reconnue' && contreditBesoin(b, s)),
    );
    const empeches = personnes.filter((q) => memeRole(q) && !disponibles.includes(q));
    const role = estPharmacien(p) ? 'pharmacien' : 'collègue';

    if (wd === 5 || estFermeture(data.officine, s)) {
      const cle = wd === 5 ? 'samedis' : 'fermetures';
      const verbe = wd === 5 ? 'travaille ce samedi' : `ferme ${JOURS[wd]}`;
      const passe = wd === 5 ? 'travaillé' : 'fermé';
      const moi = reel(p.id, cle);
      const plusCharges = disponibles
        .filter((q) => reel(q.id, cle) > moi && !nouveaux.some((x) => x.personId === q.id && x.date === s.date && (wd === 5 || estFermeture(data.officine, x))))
        .sort((a, b) => reel(b.id, cle) - reel(a.id, cle));
      if (!disponibles.length && empeches.length) {
        s.explication = `${nomCourt(p)} ${verbe} : aucun autre ${role} n'est disponible ce jour-là.`;
      } else if (plusCharges.length) {
        const q = plusCharges[0];
        s.explication = `${nomCourt(p)} ${verbe} car ${nomCourt(q)} a déjà ${passe} ${fois(reel(q.id, cle))} ${
          wd === 5 ? 'le samedi ' : ''
        }sur les 8 dernières semaines (${nomCourt(p)} : ${fois(moi)}).`;
      } else {
        const bilan = wd === 5 ? `${moi} samedi${moi > 1 ? 's' : ''} travaillé${moi > 1 ? 's' : ''}` : `a fermé ${fois(moi)}`;
        const raison = !estPharmacien(p)
          ? "pour tenir l'effectif attendu"
          : wd === 5
            ? "pour garantir la présence d'un pharmacien ce samedi"
            : "pour garantir la présence d'un pharmacien jusqu'à la fermeture";
        s.explication = `${nomCourt(p)} ${verbe} ${raison} (${bilan} sur les 8 dernières semaines).`;
      }
      continue;
    }
    if (estPharmacien(p) && !disponibles.length && empeches.length) {
      s.explication = `${nomCourt(p)} est le seul pharmacien disponible ${JOURS[wd]}.`;
    }
  }
}

/** Trois variantes comparables : équité, souhaits, coût. */
export function genererVariantes(data: AppData, monday: ISODate, conserver: boolean, graine = 7): GenResult[] {
  return (['equite', 'souhaits', 'cout'] as Variante[]).map((variante, i) =>
    generer(data, monday, { variante, conserver, graine: graine + i * 101 }),
  );
}
