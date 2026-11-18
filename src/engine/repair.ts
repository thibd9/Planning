import { valeurRegle } from '../domain/rules';
import { JOURS, fmtDuree, fmtHeure, joursOuvresEntre, mondayOf, overlaps, totalDuree, uid, weekday } from '../domain/time';
import type { AppData, Changement, ISODate, Mission, Person, Shift } from '../domain/types';
import { MISSION_COMPETENCE, MISSION_LABEL, estPharmacien, nomCourt } from '../domain/types';
import {
  decrireJournee,
  estAbsent,
  minutesSemaine,
  minutesTravail,
  segmentsTravail,
  shiftsSemaine,
  sousEffectifs,
  trousPharmacien,
} from './core';
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
  accepter: 'Laisser les horaires tels quels',
};

export interface Patch {
  retirer: string[];
  ajouter: Shift[];
  /** Activité d'un poste existant basculée au comptoir. */
  auComptoir: string[];
  /** Rendez-vous à reprogrammer : la personne en est libérée. */
  liberer: string[];
  /** Rendez-vous de la personne absente confiés à un collègue habilité et présent. */
  confier: { missionId: string; personId: string }[];
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

const vide = (): Patch => ({ retirer: [], ajouter: [], auComptoir: [], liberer: [], confier: [] });

export function appliquerPatch(data: AppData, patch: Patch): AppData {
  return {
    ...data,
    shifts: data.shifts
      .filter((s) => !patch.retirer.includes(s.id))
      .map((s) => (patch.auComptoir.includes(s.id) ? { ...s, activite: 'comptoir' as const } : s))
      .concat(patch.ajouter),
    missions: data.missions.map((m) => {
      if (patch.liberer.includes(m.id)) return { ...m, personId: null };
      const c = patch.confier.find((x) => x.missionId === m.id);
      return c ? { ...m, personId: c.personId } : m;
    }),
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

/** Mesure de la couverture d'une journée : c'est elle, et non une liste de messages, qui compare deux scénarios. */
interface Mesure {
  /** Minutes d'ouverture sans pharmacien. */
  sansPharmacien: number;
  /** Personnes-minutes manquantes au comptoir. */
  deficit: number;
}

function mesurer(data: AppData, date: ISODate): Mesure {
  return {
    sansPharmacien: totalDuree(trousPharmacien(data, date)),
    deficit: sousEffectifs(data, date).reduce((t, s) => t + (s.requis - s.present) * (s.end - s.start), 0),
  };
}

/**
 * Propose des façons comparables de combler le poste laissé vacant par une absence.
 * `data` ne contient déjà plus le poste retiré (`retire`).
 *
 * Ordre de recherche : échange interne, heures complémentaires d'un temps partiel volontaire,
 * remplaçant habituel. Aucune option ne crée de nouveau point bloquant ni n'aggrave la couverture.
 */
export function optionsReparation(data: AppData, retire: Shift, today: ISODate): Reparation {
  const monday = mondayOf(retire.date);
  const date = retire.date;
  const absent = data.personnes.find((p) => p.id === retire.personId);
  const jour = JOURS[weekday(date)];
  const duJour = (i: Issue, regle: string): boolean => i.regle === regle && i.date === date;

  const dataAvant: AppData = { ...data, shifts: data.shifts.concat(retire) };
  const m0 = mesurer(dataAvant, date); // avant l'absence
  const m1 = mesurer(data, date); // absence constatée, rien de fait
  const issuesApres = validateWeek(data, monday);
  const idsAvant = new Set(validateWeek(dataAvant, monday).map((i) => i.id));
  const idsApres = new Set(issuesApres.map((i) => i.id));

  // Rendez-vous que la personne absente devait assurer ce jour-là.
  const orphelines = data.missions.filter((m) => m.personId === retire.personId && m.date === date);

  const besoinPharmacien = m1.sansPharmacien > m0.sansPharmacien;
  const besoinEffectif = m1.deficit > m0.deficit;
  const impact: string[] = [
    ...(besoinPharmacien ? issuesApres.filter((i) => duJour(i, 'pharmacie.presence')).map((i) => i.message) : []),
    ...(besoinEffectif ? issuesApres.filter((i) => duJour(i, 'equipe.effectif')).map((i) => i.message) : []),
    ...orphelines.map((m) => `${MISSION_LABEL[m.type]} de ${fmtHeure(m.start)} à ${fmtHeure(m.end)} : ${absent ? nomCourt(absent) : 'la personne'} devait l'assurer.`),
  ];
  const coutBase = coutSemaine(data, monday);

  /** Confie les rendez-vous de l'absent à une personne formée, en poste sur tout le créneau et libre. */
  const reprendreRendezVous = (patch: Patch): Patch => {
    if (!orphelines.length) return patch;
    const d = appliquerPatch(data, patch);
    const confier: Patch['confier'] = [];
    const arrivants = patch.ajouter.map((x) => x.personId);
    for (const m of orphelines) {
      const requise = MISSION_COMPETENCE[m.type];
      const candidat = data.personnes
        .filter((p) => p.id !== retire.personId && (!requise || p.competences.includes(requise)))
        .filter((p) =>
          d.shifts
            .filter((x) => x.personId === p.id && x.date === m.date && x.activite !== 'formation')
            .flatMap(segmentsTravail)
            .some((i) => i.start <= m.start && m.end <= i.end),
        )
        .filter((p) => !d.missions.some((o) => o.id !== m.id && o.personId === p.id && o.date === m.date && overlaps(o, m)))
        .filter((p) => !confier.some((c) => c.personId === p.id))
        .sort((a, b) => arrivants.indexOf(b.id) - arrivants.indexOf(a.id))[0];
      if (candidat) confier.push({ missionId: m.id, personId: candidat.id });
    }
    return confier.length ? { ...patch, confier } : patch;
  };

  interface Evalue {
    patch: Patch;
    data: AppData;
    issues: Issue[];
    mesure: Mesure;
    /** Points bloquants que le scénario ferait apparaître, hors présence pharmaceutique (mesurée à part). */
    nouveauxBloquants: Issue[];
    rdvSansPreneur: Mission[];
    /** Le scénario découvre-t-il un autre jour de la semaine (poste rendu en échange) ? */
    degradeAilleurs: boolean;
    cout: number;
  }
  const evaluer = (brut: Patch): Evalue => {
    const patch = reprendreRendezVous(brut);
    const d = appliquerPatch(data, patch);
    const issues = validateWeek(d, monday);
    return {
      patch,
      data: d,
      issues,
      mesure: mesurer(d, date),
      nouveauxBloquants: issues.filter(
        (i) => i.gravite === 'bloquant' && !idsApres.has(i.id) && !idsAvant.has(i.id) && i.regle !== 'pharmacie.presence',
      ),
      rdvSansPreneur: orphelines.filter((m) => !patch.confier.some((c) => c.missionId === m.id)),
      degradeAilleurs: [...new Set(patch.retirer.map((id) => data.shifts.find((x) => x.id === id)?.date).filter((x): x is ISODate => !!x && x !== date))].some(
        (autre) => {
          const a = mesurer(data, autre);
          const b = mesurer(d, autre);
          return b.sansPharmacien > a.sansPharmacien || b.deficit > a.deficit;
        },
      ),
      cout: coutSemaine(d, monday) - coutBase,
    };
  };
  /** Le scénario améliore-t-il la couverture sans rien aggraver ? */
  const utile = (e: Evalue): boolean =>
    !e.nouveauxBloquants.length &&
    !e.degradeAilleurs &&
    e.mesure.sansPharmacien <= m1.sansPharmacien &&
    e.mesure.deficit <= m1.deficit &&
    (e.mesure.sansPharmacien < m1.sansPharmacien || e.mesure.deficit < m1.deficit);
  const couvert = (e: Evalue): boolean => e.mesure.sansPharmacien <= m0.sansPharmacien && e.mesure.deficit <= m0.deficit;

  const changementsDe = (patch: Patch, d: AppData): Changement[] => {
    const cles = new Set<string>();
    for (const id of [...patch.retirer, ...patch.auComptoir]) {
      const s = data.shifts.find((x) => x.id === id);
      if (s) cles.add(`${s.personId}|${s.date}`);
    }
    for (const s of patch.ajouter) cles.add(`${s.personId}|${s.date}`);
    return [...cles].map((k) => {
      const [personId, d2] = k.split('|');
      const a = data.shifts.filter((s) => s.personId === personId && s.date === d2);
      const b = d.shifts.filter((s) => s.personId === personId && s.date === d2);
      const activite = b.some((s) => patch.auComptoir.includes(s.id)) ? ' - au comptoir' : '';
      return { personId, date: d2, avant: decrireJournee(a), apres: decrireJournee(b) + activite };
    });
  };

  const periode = periodeAvant(monday, 8);
  const hist = equite(data, periode.from, periode.to);
  const charge = (p: Person): number => {
    const l = hist.find((x) => x.personId === p.id);
    const cle = weekday(date) === 5 ? 'samedis' : 'fermetures';
    return l && l.attendu[cle] !== null ? l.reel[cle] - (l.attendu[cle] as number) : 0;
  };
  const delaiPartiel = valeurRegle(data.regles, 'delai.tempsPartiel', 7);

  const reglesControlees = (e: Evalue, ids: string[]): RepairOption['regles'] => {
    const respecte = (regle: string): boolean =>
      !e.issues.some((i) => i.regle === regle && i.gravite === 'bloquant' && !!i.personId && ids.includes(i.personId) && !idsAvant.has(i.id));
    return [
      { label: 'Pharmacien présent sur toute l’ouverture', ok: e.mesure.sansPharmacien <= m0.sansPharmacien },
      { label: 'Repos quotidien de 11 h', ok: respecte('repos.quotidien') },
      { label: 'Repos hebdomadaire', ok: respecte('repos.hebdo') },
      { label: 'Durées maximales (jour, semaine, amplitude)', ok: respecte('duree.quotidienne') && respecte('duree.hebdo') && respecte('duree.amplitude') && respecte('duree.pause') },
      { label: 'Effectif attendu au comptoir', ok: e.mesure.deficit <= m0.deficit },
    ];
  };
  const restantDe = (e: Evalue): string[] => [
    ...(e.mesure.sansPharmacien > m0.sansPharmacien ? e.issues.filter((i) => duJour(i, 'pharmacie.presence')).map((i) => i.message) : []),
    ...(e.mesure.deficit > m0.deficit ? e.issues.filter((i) => duJour(i, 'equipe.effectif')).map((i) => i.message) : []),
    ...e.rdvSansPreneur.map(
      (m) => `${MISSION_LABEL[m.type]} de ${fmtHeure(m.start)} à ${fmtHeure(m.end)} : aucune personne habilitée n'est en poste, rendez-vous à reprogrammer.`,
    ),
  ];
  const reprises = (patch: Patch): string[] =>
    patch.confier.map((c) => {
      const m = data.missions.find((x) => x.id === c.missionId) as Mission;
      const p = data.personnes.find((x) => x.id === c.personId) as Person;
      return `${MISSION_LABEL[m.type]} de ${fmtHeure(m.start)} reprise par ${nomCourt(p)} : à lui confirmer`;
    });

  const options: RepairOption[] = [];
  const aCouvrir = besoinPharmacien || besoinEffectif;

  // ---- 1 et 2. Solutions internes
  interface Candidat {
    e: Evalue;
    p: Person;
    creneaux: number;
    heuresComp: boolean;
  }
  const candidats: Candidat[] = [];
  const semaine = shiftsSemaine(data, monday);
  // Sans plage découverte, inutile de déranger qui que ce soit.
  for (const p of aCouvrir ? data.personnes : []) {
    if (p.externe || p.id === retire.personId) continue;
    if (besoinPharmacien && !estPharmacien(p)) continue;
    if (estAbsent(data, p.id, date)) continue;
    const postesDuJour = semaine.filter((s) => s.personId === p.id && s.date === date);
    const patches: { patch: Patch; creneaux: number }[] = [];
    if (!postesDuJour.length) {
      patches.push({ patch: { ...vide(), ajouter: [nouveauShift(retire, p.id)] }, creneaux: 1 });
      // Échange de jour : la personne rend un autre poste de la semaine pour garder son volume d'heures.
      // Seulement un poste à venir : on ne « rend » pas une journée déjà commencée.
      for (const autre of semaine.filter((s) => s.personId === p.id && s.date !== date && s.date > today)) {
        patches.push({ patch: { ...vide(), ajouter: [nouveauShift(retire, p.id)], retirer: [autre.id] }, creneaux: 2 });
      }
    } else {
      // La personne travaille déjà ce jour-là : reprendre l'horaire vacant, ou allonger sa journée.
      const ids = postesDuJour.map((s) => s.id);
      patches.push({ patch: { ...vide(), retirer: ids, ajouter: [nouveauShift(retire, p.id)] }, creneaux: 1 });
      const debut = Math.min(retire.start, ...postesDuJour.map((s) => s.start));
      const fin = Math.max(retire.end, ...postesDuJour.map((s) => s.end));
      const pause = postesDuJour.find((s) => s.pauseStart !== undefined) ?? (retire.pauseStart !== undefined ? retire : undefined);
      const milieu = Math.round((debut + fin) / 2 / 30) * 30;
      const long: Shift = {
        ...nouveauShift(retire, p.id),
        start: debut,
        end: fin,
        pauseStart: pause?.pauseStart ?? milieu - 30,
        pauseEnd: pause?.pauseEnd ?? milieu + 30,
      };
      if (long.start !== postesDuJour[0].start || long.end !== postesDuJour[0].end) {
        patches.push({ patch: { ...vide(), retirer: ids, ajouter: [long] }, creneaux: 1 });
      }
    }
    for (const { patch, creneaux } of patches) {
      const e = evaluer(patch);
      if (!utile(e)) continue;
      candidats.push({
        e,
        p,
        creneaux,
        heuresComp: p.salarie && p.heuresHebdo < 35 && p.volontaireHeuresComp && minutesSemaine(e.data, p.id, monday) > p.heuresHebdo * 60,
      });
    }
  }
  const tri = (a: Candidat, b: Candidat): number =>
    a.e.mesure.sansPharmacien - b.e.mesure.sansPharmacien ||
    a.e.mesure.deficit - b.e.mesure.deficit ||
    a.creneaux - b.creneaux ||
    a.e.cout - b.e.cout ||
    charge(a.p) - charge(b.p);

  const construireInterne = (c: Candidat, type: 'echange' | 'heures_comp'): RepairOption => {
    const changements = changementsDe(c.e.patch, c.e.data);
    const validations = [`Accord de ${nomCourt(c.p)} à obtenir`];
    if (c.p.salarie && c.p.heuresHebdo < 35 && joursOuvresEntre(today, date) < delaiPartiel) {
      validations.push(`Temps partiel prévenu moins de ${delaiPartiel} jours ouvrés avant : accord à tracer`);
    }
    validations.push(...reprises(c.e.patch));
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
      couverture: couvert(c.e) ? 'maintenue' : 'partielle',
      changements,
      personnesTouchees: [...new Set([c.p.id, ...c.e.patch.confier.map((x) => x.personId)])],
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
    .filter((p) => aCouvrir && p.externe && estPharmacien(p) === roleVoulu)
    .map((p) => ({ p, e: evaluer({ ...vide(), ajouter: [nouveauShift(retire, p.id)] }) }))
    .filter((x) => utile(x.e))
    .sort((a, b) => a.e.mesure.sansPharmacien - b.e.mesure.sansPharmacien || a.e.mesure.deficit - b.e.mesure.deficit || a.e.cout - b.e.cout);
  if (externes.length) {
    const { p, e } = externes[0];
    options.push({
      id: uid('opt'),
      type: 'remplacant',
      titre: `Faire appel à ${nomCourt(p)}, remplaçant habituel`,
      resume: `${nomCourt(p)} reprend le poste de ${fmtHeure(retire.start)} à ${fmtHeure(retire.end)}. Aucun horaire de l’équipe ne change.`,
      couverture: couvert(e) ? 'maintenue' : 'partielle',
      changements: changementsDe(e.patch, e.data),
      personnesTouchees: e.patch.confier.map((c) => c.personId).filter((id) => id !== p.id),
      creneauxModifies: 0,
      coutSupp: ((p.tauxHoraire ?? 0) * minutesTravail(retire)) / 60,
      validations: [`Disponibilité de ${nomCourt(p)} à confirmer`, 'Contrat ou bon de mission à établir', ...reprises(e.patch)],
      regles: reglesControlees(e, [p.id]),
      restant: restantDe(e),
      patch: e.patch,
      recommande: false,
    });
  }

  // ---- 4. Décaler une activité non urgente (ne remplace jamais un pharmacien absent)
  if (besoinEffectif && !besoinPharmacien) {
    const plage = { start: retire.start, end: retire.end };
    const patch = vide();
    const libelles: string[] = [];
    for (const s of semaine) {
      if (s.date !== date || s.activite === 'comptoir' || s.activite === 'formation') continue;
      if (!segmentsTravail(s).some((seg) => overlaps(seg, plage))) continue;
      patch.auComptoir.push(s.id);
      const p = data.personnes.find((x) => x.id === s.personId);
      if (p) libelles.push(`${nomCourt(p)} passe au comptoir`);
    }
    const reportables = data.missions.filter(
      (m) => m.date === date && m.reportable && m.personId && m.personId !== retire.personId && overlaps(m, plage),
    );
    for (const m of reportables) {
      patch.liberer.push(m.id);
      libelles.push(`${MISSION_LABEL[m.type].toLowerCase()} de ${fmtHeure(m.start)} reprogrammé`);
    }
    if (patch.auComptoir.length || patch.liberer.length) {
      const e = evaluer(patch);
      if (utile(e)) {
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
          couverture: couvert(e) ? 'sous_conditions' : 'partielle',
          changements: changementsDe(e.patch, e.data),
          personnesTouchees: touchees,
          creneauxModifies: patch.auComptoir.length + patch.liberer.length,
          coutSupp: 0,
          validations: [
            ...(patch.auComptoir.length ? ['Tâche de réception ou d’administratif à reporter'] : []),
            ...(patch.liberer.length ? ['Rendez-vous à reprogrammer avec les personnes concernées'] : []),
            ...reprises(e.patch),
          ],
          regles: reglesControlees(e, touchees),
          restant: restantDe(e),
          patch: e.patch,
          recommande: false,
        });
      }
    }
  }

  // ---- 5. Ne rien changer aux horaires : possible seulement si un pharmacien reste présent
  if (!besoinPharmacien) {
    const e = evaluer(vide());
    const repris = e.patch.confier.length > 0;
    // Faute de personne habilitée en poste, le rendez-vous est libéré pour être reprogrammé.
    const patch: Patch = e.rdvSansPreneur.length ? { ...e.patch, liberer: e.rdvSansPreneur.map((m) => m.id) } : e.patch;
    const reduit = e.mesure.deficit > m0.deficit;
    options.push({
      id: uid('opt'),
      type: 'accepter',
      titre: reduit
        ? 'Assumer la charge, sans réaffecter'
        : repris
          ? `Confier le rendez-vous à ${nomCourt(data.personnes.find((p) => p.id === e.patch.confier[0].personId) as Person)}`
          : e.rdvSansPreneur.length
            ? 'Reprogrammer le rendez-vous'
            : 'Aucun remplacement nécessaire',
      resume: reduit
        ? 'Personne n’est déplacé : un pharmacien est présent et l’équipe en poste absorbe la charge. L’effectif attendu n’est pas atteint.'
        : repris
          ? 'Aucun horaire ne change : une personne formée, déjà en poste, reprend le rendez-vous.'
          : e.rdvSansPreneur.length
            ? 'Aucune personne habilitée n’est en poste sur le créneau : le rendez-vous est à déplacer.'
            : `L’absence ${absent ? `de ${nomCourt(absent)} ` : ''}ne découvre aucune plage : la couverture reste assurée.`,
      couverture: reduit ? 'partielle' : e.rdvSansPreneur.length ? 'sous_conditions' : 'maintenue',
      changements: [],
      personnesTouchees: e.patch.confier.map((c) => c.personId),
      creneauxModifies: 0,
      coutSupp: 0,
      validations: [...reprises(e.patch), ...(e.rdvSansPreneur.length ? ['Rendez-vous à reprogrammer avec les personnes concernées'] : [])],
      regles: reglesControlees(e, []),
      restant: restantDe(e),
      patch,
      recommande: false,
    });
  }

  // Recommandation : la couverture d'abord, puis l'ordre de recherche (interne avant externe).
  const ordre: OptionType[] = aCouvrir ? ['echange', 'heures_comp', 'remplacant', 'decaler', 'accepter'] : ['accepter'];
  const rang = { maintenue: 0, sous_conditions: 1, partielle: 2 };
  const choix = options.slice().sort((a, b) => rang[a.couverture] - rang[b.couverture] || ordre.indexOf(a.type) - ordre.indexOf(b.type))[0];
  if (choix) choix.recommande = true;

  return { impact, options };
}
