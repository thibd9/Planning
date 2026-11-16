import { valeurRegle } from '../domain/rules';
import { JOURS, fmtDuree, fmtHeure, joursOuvresEntre, mondayOf, overlaps, uid, weekday } from '../domain/time';
import type { AppData, Changement, ISODate, Mission, Person, Shift } from '../domain/types';
import { MISSION_LABEL, estPharmacien, nomCourt } from '../domain/types';
import { decrireJournee, estAbsent, minutesSemaine, minutesTravail, segmentsTravail, shiftsSemaine } from './core';
import { equite, periodeAvant } from './equity';
import { coutSemaine } from './payroll';
import type { Issue } from './validate';
import { validateWeek } from './validate';

export type OptionType = 'echange' | 'heures_comp' | 'remplacant' | 'decaler' | 'accepter';

export const OPTION_LABEL: Record<OptionType, string> = {
  echange: 'Réaffecter un collègue',
  heures_comp: 'Heures complémentaires d’un temps partiel volontaire',
  remplacant: 'Faire appel à un remplaçant habituel',
  decaler: 'Décaler une activité non urgente',
  accepter: 'Laisser le planning tel quel',
};

export interface Patch {
  retirer: string[];
  ajouter: Shift[];
  /** Activité d'un poste existant basculée au comptoir. */
  auComptoir: string[];
  /** Rendez-vous à reprogrammer : la personne en est libérée. */
  liberer: string[];
}

export interface RepairOption {
  id: string;
  type: OptionType;
  titre: string;
  resume: string;
  couverture: 'maintenue' | 'sous_conditions' | 'partielle';
  changements: Changement[];
  personnesTouchees: string[];
  creneauxModifies: number;
  /** Coût supplémentaire estimé sur la semaine. */
  coutSupp: number;
  validations: string[];
  regles: { label: string; ok: boolean }[];
  /** Ce qui reste à régler si l'option est retenue. */
  restant: string[];
  patch: Patch;
  recommande: boolean;
}

export interface Reparation {
  /** Ce que l'absence a découvert, en clair. */
  impact: string[];
  options: RepairOption[];
}

const vide = (): Patch => ({ retirer: [], ajouter: [], auComptoir: [], liberer: [] });

export function appliquerPatch(data: AppData, patch: Patch): AppData {
  return {
    ...data,
    shifts: data.shifts
      .filter((s) => !patch.retirer.includes(s.id))
      .map((s) => (patch.auComptoir.includes(s.id) ? { ...s, activite: 'comptoir' as const } : s))
      .concat(patch.ajouter),
    missions: data.missions.map((m) => (patch.liberer.includes(m.id) ? { ...m, personId: null } : m)),
  };
}

function nouveauShift(modele: Shift, personId: string): Shift {
  return {
    id: uid('s'),
    personId,
    date: modele.date,
    start: modele.start,
    end: modele.end,
    pauseStart: modele.pauseStart,
    pauseEnd: modele.pauseEnd,
    activite: 'comptoir',
    origine: 'reparation',
  };
}

/**
 * Propose des façons comparables de combler le poste laissé vacant par une absence.
 * `data` ne contient déjà plus le poste retiré (`retire`).
 *
 * Ordre de recherche : échange interne, heures complémentaires d'un temps partiel volontaire,
 * remplaçant habituel. Aucune option ne crée de nouveau point bloquant.
 */
export function optionsReparation(data: AppData, retire: Shift, today: ISODate): Reparation {
  const monday = mondayOf(retire.date);
  const absent = data.personnes.find((p) => p.id === retire.personId);
  const apres = validateWeek(data, monday);
  const avant = new Set(
    validateWeek({ ...data, shifts: data.shifts.concat(retire) }, monday)
      .filter((i) => i.regle !== 'equipe.absence')
      .map((i) => i.id),
  );
  const surLaPlage = (i: Issue): boolean =>
    i.date === retire.date &&
    (i.regle === 'pharmacie.presence' || i.regle === 'equipe.effectif' || i.regle === 'pharmacie.competence');
  const crees = apres.filter((i) => !avant.has(i.id) && surLaPlage(i));
  const idsApres = new Set(apres.map((i) => i.id));
  const besoinPharmacien = crees.some((i) => i.regle === 'pharmacie.presence');
  const impact = crees.map((i) => i.message);
  const coutBase = coutSemaine(data, monday);
  const jour = JOURS[weekday(retire.date)];

  // Rendez-vous que la personne absente devait assurer.
  const orphelines = data.missions.filter((m) => m.personId === retire.personId && m.date === retire.date);

  interface Evalue {
    patch: Patch;
    restants: Issue[];
    nouveauxBloquants: Issue[];
    cout: number;
    issues: Issue[];
    data: AppData;
  }
  const evaluer = (patch: Patch): Evalue => {
    const d = appliquerPatch(data, patch);
    const issues = validateWeek(d, monday);
    const ids = new Set(issues.map((i) => i.id));
    return {
      patch,
      data: d,
      issues,
      restants: crees.filter((i) => ids.has(i.id) || issues.some((x) => x.regle === i.regle && x.date === i.date && surLaPlage(x) && !avant.has(x.id))),
      nouveauxBloquants: issues.filter((i) => i.gravite === 'bloquant' && !idsApres.has(i.id) && !avant.has(i.id)),
      cout: coutSemaine(d, monday) - coutBase,
    };
  };

  const changementsDe = (patch: Patch, d: AppData): Changement[] => {
    const cles = new Set<string>();
    for (const id of [...patch.retirer, ...patch.auComptoir]) {
      const s = data.shifts.find((x) => x.id === id);
      if (s) cles.add(`${s.personId}|${s.date}`);
    }
    for (const s of patch.ajouter) cles.add(`${s.personId}|${s.date}`);
    return [...cles].map((k) => {
      const [personId, date] = k.split('|');
      const a = data.shifts.filter((s) => s.personId === personId && s.date === date);
      const b = d.shifts.filter((s) => s.personId === personId && s.date === date);
      const activite = b.some((s) => patch.auComptoir.includes(s.id)) ? ' — au comptoir' : '';
      return { personId, date, avant: decrireJournee(a), apres: decrireJournee(b) + activite };
    });
  };

  const hist = equite(data, periodeAvant(monday, 8).from, periodeAvant(monday, 8).to);
  const charge = (p: Person): number => {
    const l = hist.find((x) => x.personId === p.id);
    const cle = weekday(retire.date) === 5 ? 'samedis' : 'fermetures';
    return l && l.attendu[cle] !== null ? l.reel[cle] - (l.attendu[cle] as number) : 0;
  };
  const delaiPartiel = valeurRegle(data.regles, 'delai.tempsPartiel', 7);
  const reglesControlees = (e: Evalue, ids: string[]): RepairOption['regles'] => {
    const concerne = (regle: string): boolean =>
      !e.issues.some((i) => i.regle === regle && i.gravite === 'bloquant' && (!i.personId || ids.includes(i.personId)) && (!i.date || i.date === retire.date || !!i.personId));
    return [
      { label: 'Pharmacien présent sur toute l’ouverture', ok: !e.issues.some((i) => i.regle === 'pharmacie.presence' && i.date === retire.date) },
      { label: 'Repos quotidien de 11 h', ok: concerne('repos.quotidien') },
      { label: 'Repos hebdomadaire', ok: concerne('repos.hebdo') },
      { label: 'Durées maximales (jour, semaine, amplitude)', ok: concerne('duree.quotidienne') && concerne('duree.hebdo') && concerne('duree.amplitude') },
      { label: 'Effectif attendu au comptoir', ok: !e.issues.some((i) => i.regle === 'equipe.effectif' && i.date === retire.date && !avant.has(i.id)) },
    ];
  };
  const restantDe = (e: Evalue): string[] => {
    const r = e.restants.map((i) => i.message);
    if (orphelines.length && !e.patch.liberer.length) {
      for (const m of orphelines) {
        r.push(`${MISSION_LABEL[m.type]} de ${fmtHeure(m.start)} à ${fmtHeure(m.end)} : à confier à une personne habilitée ou à reprogrammer.`);
      }
    }
    return r;
  };

  const options: RepairOption[] = [];

  // ---- 1 et 2. Solutions internes
  interface Candidat {
    e: Evalue;
    p: Person;
    creneaux: number;
    heuresComp: boolean;
  }
  const candidats: Candidat[] = [];
  const semaine = shiftsSemaine(data, monday);
  for (const p of data.personnes) {
    if (p.externe || p.id === retire.personId) continue;
    if (besoinPharmacien && !estPharmacien(p)) continue;
    if (estAbsent(data, p.id, retire.date)) continue;
    const duJour = semaine.filter((s) => s.personId === p.id && s.date === retire.date);
    const patches: { patch: Patch; creneaux: number }[] = [];
    if (!duJour.length) {
      const ajout = nouveauShift(retire, p.id);
      patches.push({ patch: { ...vide(), ajouter: [ajout] }, creneaux: 1 });
      // Échange de jour : la personne rend un autre poste de la semaine pour garder son volume d'heures.
      for (const autre of semaine.filter((s) => s.personId === p.id && s.date !== retire.date)) {
        patches.push({ patch: { ...vide(), ajouter: [nouveauShift(retire, p.id)], retirer: [autre.id] }, creneaux: 2 });
      }
    } else {
      // La personne travaille déjà ce jour-là : reprendre l'horaire vacant, ou allonger sa journée.
      const ids = duJour.map((s) => s.id);
      patches.push({ patch: { ...vide(), retirer: ids, ajouter: [nouveauShift(retire, p.id)] }, creneaux: 1 });
      const debut = Math.min(retire.start, ...duJour.map((s) => s.start));
      const fin = Math.max(retire.end, ...duJour.map((s) => s.end));
      const pause = duJour.find((s) => s.pauseStart !== undefined) ?? (retire.pauseStart !== undefined ? retire : undefined);
      const milieu = Math.round((debut + fin) / 2 / 30) * 30;
      const long: Shift = {
        ...nouveauShift(retire, p.id),
        start: debut,
        end: fin,
        pauseStart: pause?.pauseStart ?? milieu - 30,
        pauseEnd: pause?.pauseEnd ?? milieu + 30,
      };
      if (long.start !== duJour[0].start || long.end !== duJour[0].end) {
        patches.push({ patch: { ...vide(), retirer: ids, ajouter: [long] }, creneaux: 1 });
      }
    }
    for (const { patch, creneaux } of patches) {
      const e = evaluer(patch);
      if (e.nouveauxBloquants.length) continue;
      if (e.restants.length >= crees.length && crees.length) continue;
      const apresMin = minutesSemaine(e.data, p.id, monday);
      candidats.push({
        e,
        p,
        creneaux,
        heuresComp: p.salarie && p.heuresHebdo < 35 && p.volontaireHeuresComp && apresMin > p.heuresHebdo * 60,
      });
    }
  }
  const tri = (a: Candidat, b: Candidat): number =>
    a.e.restants.length - b.e.restants.length ||
    a.creneaux - b.creneaux ||
    a.e.cout - b.e.cout ||
    charge(a.p) - charge(b.p);

  const construireInterne = (c: Candidat, type: 'echange' | 'heures_comp'): RepairOption => {
    const changements = changementsDe(c.e.patch, c.e.data);
    const validations = [`Accord de ${nomCourt(c.p)} à obtenir`];
    if (c.p.salarie && c.p.heuresHebdo < 35 && joursOuvresEntre(today, retire.date) < delaiPartiel) {
      validations.push(`Temps partiel prévenu moins de ${delaiPartiel} jours ouvrés avant : accord à tracer`);
    }
    const plus = minutesSemaine(c.e.data, c.p.id, monday) - minutesSemaine(data, c.p.id, monday);
    return {
      id: uid('opt'),
      type,
      titre: type === 'heures_comp' ? `Proposer des heures complémentaires à ${nomCourt(c.p)}` : `Réaffecter ${nomCourt(c.p)}`,
      resume:
        c.creneaux === 2
          ? `${nomCourt(c.p)} vient ${jour} et rend un autre poste de la semaine.`
          : plus > 0
            ? `${nomCourt(c.p)} travaille ${fmtDuree(plus)} de plus ${jour}.`
            : `${nomCourt(c.p)} change d’horaire ${jour}, sans heure en plus.`,
      couverture: c.e.restants.length ? 'partielle' : 'maintenue',
      changements,
      personnesTouchees: [c.p.id],
      creneauxModifies: changements.length,
      coutSupp: Math.max(0, c.e.cout),
      validations,
      regles: reglesControlees(c.e, [c.p.id]),
      restant: restantDe(c.e),
      patch: c.e.patch,
      recommande: false,
    };
  };
  const echange = candidats.filter((c) => !c.heuresComp).sort(tri)[0];
  if (echange) options.push(construireInterne(echange, 'echange'));
  const comp = candidats.filter((c) => c.heuresComp).sort(tri)[0];
  if (comp) options.push(construireInterne(comp, 'heures_comp'));

  // ---- 3. Remplaçant habituel
  const roleVoulu = besoinPharmacien || (absent ? estPharmacien(absent) : false);
  const externes = data.personnes
    .filter((p) => p.externe && estPharmacien(p) === roleVoulu)
    .map((p) => ({ p, e: evaluer({ ...vide(), ajouter: [nouveauShift(retire, p.id)] }) }))
    .filter((x) => !x.e.nouveauxBloquants.length)
    .sort((a, b) => a.e.restants.length - b.e.restants.length || a.e.cout - b.e.cout);
  if (externes.length) {
    const { p, e } = externes[0];
    options.push({
      id: uid('opt'),
      type: 'remplacant',
      titre: `Faire appel à ${nomCourt(p)}, remplaçant habituel`,
      resume: `${nomCourt(p)} reprend le poste de ${fmtHeure(retire.start)} à ${fmtHeure(retire.end)}. Aucun horaire de l’équipe ne change.`,
      couverture: e.restants.length ? 'partielle' : 'maintenue',
      changements: changementsDe(e.patch, e.data),
      personnesTouchees: [],
      creneauxModifies: 0,
      coutSupp: ((p.tauxHoraire ?? 0) * minutesTravail(retire)) / 60,
      validations: [`Disponibilité de ${nomCourt(p)} à confirmer`, 'Contrat ou bon de mission à établir'],
      regles: reglesControlees(e, [p.id]),
      restant: restantDe(e),
      patch: e.patch,
      recommande: false,
    });
  }

  // ---- 4. Décaler une activité non urgente (ne remplace jamais un pharmacien absent)
  if (crees.length && !besoinPharmacien) {
    const plage = { start: retire.start, end: retire.end };
    const patch = vide();
    const libelles: string[] = [];
    for (const s of semaine) {
      if (s.date !== retire.date || s.activite === 'comptoir' || s.activite === 'formation') continue;
      if (!segmentsTravail(s).some((seg) => overlaps(seg, plage))) continue;
      patch.auComptoir.push(s.id);
      const p = data.personnes.find((x) => x.id === s.personId);
      if (p) libelles.push(`${nomCourt(p)} passe au comptoir`);
    }
    const reportables: Mission[] = data.missions.filter(
      (m) => m.date === retire.date && m.reportable && m.personId && m.personId !== retire.personId && overlaps(m, plage),
    );
    for (const m of reportables) {
      patch.liberer.push(m.id);
      libelles.push(`${MISSION_LABEL[m.type].toLowerCase()} de ${fmtHeure(m.start)} reprogrammé`);
    }
    if (patch.auComptoir.length || patch.liberer.length) {
      const e = evaluer(patch);
      if (!e.nouveauxBloquants.length && e.restants.length < crees.length) {
        const touchees = [
          ...new Set([
            ...patch.auComptoir.map((id) => data.shifts.find((s) => s.id === id)?.personId ?? ''),
            ...reportables.map((m) => m.personId as string),
          ]),
        ].filter(Boolean);
        options.push({
          id: uid('opt'),
          type: 'decaler',
          titre: 'Décaler une activité non urgente',
          resume: libelles.join(' ; ') + '.',
          couverture: e.restants.length ? 'partielle' : 'sous_conditions',
          changements: changementsDe(patch, e.data),
          personnesTouchees: touchees,
          creneauxModifies: patch.auComptoir.length + patch.liberer.length,
          coutSupp: 0,
          validations: [
            ...(patch.auComptoir.length ? ['Tâche de réception ou d’administratif à reporter'] : []),
            ...(patch.liberer.length ? ['Rendez-vous à reprogrammer avec les personnes concernées'] : []),
          ],
          regles: reglesControlees(e, touchees),
          restant: restantDe(e),
          patch,
          recommande: false,
        });
      }
    }
  }

  // ---- 5. Ne rien changer : possible seulement si un pharmacien reste présent
  if (!besoinPharmacien) {
    const e = evaluer(vide());
    options.push({
      id: uid('opt'),
      type: 'accepter',
      titre: crees.length ? 'Accepter un effectif réduit' : 'Aucun remplacement nécessaire',
      resume: crees.length
        ? 'Le planning reste tel quel : un pharmacien est présent, mais l’effectif attendu n’est pas atteint.'
        : `L’absence ${absent ? `de ${nomCourt(absent)} ` : ''}ne découvre aucune plage : la couverture reste assurée.`,
      couverture: crees.length ? 'partielle' : 'maintenue',
      changements: [],
      personnesTouchees: [],
      creneauxModifies: 0,
      coutSupp: 0,
      validations: [],
      regles: reglesControlees(e, []),
      restant: restantDe(e),
      patch: vide(),
      recommande: false,
    });
  }

  // Recommandation : la couverture d'abord, puis le moins de personnes dérangées, puis l'ordre de recherche.
  const ordre: OptionType[] = ['echange', 'heures_comp', 'remplacant', 'decaler', 'accepter'];
  const rang = { maintenue: 0, sous_conditions: 1, partielle: 2 };
  const choix = options
    .slice()
    .sort(
      (a, b) =>
        rang[a.couverture] - rang[b.couverture] ||
        (crees.length ? 0 : (a.type === 'accepter' ? -1 : 0) - (b.type === 'accepter' ? -1 : 0)) ||
        ordre.indexOf(a.type) - ordre.indexOf(b.type),
    )[0];
  if (choix) choix.recommande = true;

  return { impact, options };
}
