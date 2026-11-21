import { describe, it } from 'vitest';
import { rmSync, writeFileSync } from 'node:fs';
import { seed } from '/home/user/releve-planning/src/data/seed';
import { genererVariantes, generer, VARIANTE_LABEL } from '/home/user/releve-planning/src/engine/generate';
import type { GenResult } from '/home/user/releve-planning/src/engine/generate';
import { validateWeek } from '/home/user/releve-planning/src/engine/validate';
import { estAbsent, enRepos, minutesTravail, besoinsDe, contreditBesoin, ouverture, shiftsSemaine } from '/home/user/releve-planning/src/engine/core';
import { contratSemaine, cibleSemaine } from '/home/user/releve-planning/src/engine/heures';
import { equite, ecartEquite } from '/home/user/releve-planning/src/engine/equity';
import { addDays, ferie, weekDates } from '/home/user/releve-planning/src/domain/time';
import type { AppData, Person, Shift } from '/home/user/releve-planning/src/domain/types';
import { DOSSIER, H, constat } from './aide';

rmSync(`${DOSSIER}/generation.jsonl`, { force: true });
const F = 'generation';
const TODAY = '2026-11-20';

interface Mesure {
  semaine: string;
  variante: string;
  ms: number;
  bloquants: string[];
  alertes: Record<string, number>;
  auDelaContrat: string[];
  auDela46: string[];
  ecartContratTotalH: number;
  souhaits: string;
  reconnuesViolees: number;
  absencesViolees: number;
  reposViolees: number;
  ecartSamedis: number;
  maxJour: string;
  heures: Record<string, number>;
}

function mesurer(data: AppData, monday: string, r: GenResult, ms: number): Mesure {
  const fin = addDays(monday, 6);
  const d: AppData = { ...data, shifts: data.shifts.filter((s) => s.date < monday || s.date > fin).concat(r.shifts) };
  const issues = validateWeek(d, monday);
  const alertes: Record<string, number> = {};
  for (const i of issues.filter((x) => x.gravite !== 'bloquant')) alertes[i.regle] = (alertes[i.regle] ?? 0) + 1;
  const heures: Record<string, number> = {};
  const auDelaContrat: string[] = [];
  const auDela46: string[] = [];
  let ecart = 0;
  let maxJour = { qui: '', h: 0 };
  let reconnuesViolees = 0;
  let absencesViolees = 0;
  let reposViolees = 0;
  for (const p of d.personnes.filter((x) => !x.externe)) {
    const mine = r.shifts.filter((s) => s.personId === p.id);
    const m = mine.reduce((t, s) => t + minutesTravail(s), 0);
    heures[p.prenom] = Math.round((m / 60) * 100) / 100;
    if (p.salarie && m > p.heuresHebdo * 60) auDelaContrat.push(`${p.prenom} ${(m / 60).toFixed(2)} h / ${p.heuresHebdo} h`);
    if (p.salarie && m > 46 * 60) auDela46.push(`${p.prenom} ${(m / 60).toFixed(2)} h`);
    if (p.salarie) ecart += Math.abs(m - contratSemaine(d, p, monday)) / 60;
    for (const s of mine) {
      const mj = mine.filter((x) => x.date === s.date).reduce((t, x) => t + minutesTravail(x), 0);
      if (mj > maxJour.h) maxJour = { qui: `${p.prenom} ${s.date}`, h: mj };
      if (estAbsent(d, p.id, s.date)) absencesViolees++;
      if (enRepos(d, p.id, s.date)) reposViolees++;
      if (besoinsDe(d, p.id, s.date).some((b) => b.statut === 'reconnue' && contreditBesoin(b, s))) reconnuesViolees++;
    }
  }
  const lignes = equite(d, addDays(monday, -49), fin);
  return {
    semaine: monday,
    variante: r.variante,
    ms,
    bloquants: issues.filter((i) => i.gravite === 'bloquant').map((i) => `${i.regle}: ${i.message}`),
    alertes,
    auDelaContrat,
    auDela46,
    ecartContratTotalH: Math.round(ecart * 10) / 10,
    souhaits: r.indicateurs.souhaits === null ? 'aucune' : `${Math.round(r.indicateurs.souhaits * 100)} % de ${r.indicateurs.souhaitsTotal}`,
    reconnuesViolees,
    absencesViolees,
    reposViolees,
    ecartSamedis: Math.round(ecartEquite(lignes, 'samedis') * 100) / 100,
    maxJour: `${maxJour.qui} ${(maxJour.h / 60).toFixed(2)} h`,
    heures,
  };
}

function variantes(data: AppData, monday: string): Mesure[] {
  const t0 = performance.now();
  const res = genererVariantes(data, monday, false);
  const ms = (performance.now() - t0) / res.length;
  return res.map((r) => mesurer(data, monday, r, Math.round(ms)));
}

const toutes: Mesure[] = [];
let data: AppData;

describe('2. Propositions de planning sur l’exemple', () => {
  it('dix semaines, trois variantes', () => {
    data = seed(TODAY, 2);
    // Une semaine avec congé approuvé (Nicolas, 30 nov. - 4 déc.), un congé partiel (Inès lundi-mardi 14-15 déc.),
    // un arrêt (Jules 4-5 janv.), des repos posés (Thomas mardi 8 déc., Léa lundi 14 déc.).
    data = {
      ...data,
      absences: data.absences
        .map((a) => (a.personId === 'p_camille' && a.statut === 'demandee' ? { ...a, statut: 'approuvee' as const } : a))
        .concat(
          { id: 'ab_ines', personId: 'p_ines', from: '2026-12-14', to: '2026-12-15', type: 'conge', statut: 'approuvee', createdAt: '2026-11-01' },
          { id: 'ab_jules', personId: 'p_jules', from: '2027-01-04', to: '2027-01-05', type: 'maladie', statut: 'approuvee', createdAt: '2026-11-01' },
        ),
      repos: [
        { personId: 'p_thomas', date: '2026-12-08' },
        { personId: 'p_lea', date: '2026-12-14' },
      ],
    };
    const semaines = ['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28', '2027-01-04', '2027-03-29', '2027-05-03', '2027-05-17'];
    for (const m of semaines) toutes.push(...variantes(data, m));
    writeFileSync(`${DOSSIER}/generation-mesures.json`, JSON.stringify(toutes, null, 1));
    for (const x of toutes) {
      const feries = weekDates(x.semaine).filter((d) => ferie(d)).map((d) => `${d} ${ferie(d)}`);
      constat(F, {
        id: `G-${x.semaine}-${x.variante}`,
        regle: 'generer',
        scenario: `Semaine du ${x.semaine}${feries.length ? ` (férié : ${feries.join(', ')})` : ''}, variante ${VARIANTE_LABEL[x.variante as 'equite'].titre}`,
        attendu: '0 bloquant ; personne au-delà de 46 h ; absences, repos posés et indisponibilités reconnues respectés',
        obtenu: `${x.bloquants.length} bloquant(s)${x.bloquants.length ? ' [' + x.bloquants.join(' ; ') + ']' : ''} ; >46 h : ${x.auDela46.length} ; au-delà du contrat : ${x.auDelaContrat.join(', ') || 'personne'} ; préférences suivies : ${x.souhaits} ; écart samedis ${x.ecartSamedis} ; alertes ${JSON.stringify(x.alertes)} ; violations absence/repos/indispo ${x.absencesViolees}/${x.reposViolees}/${x.reconnuesViolees} ; jour le plus long ${x.maxJour} ; ${x.ms} ms`,
        ok: x.bloquants.length === 0 && x.auDela46.length === 0 && x.absencesViolees + x.reposViolees + x.reconnuesViolees === 0,
      });
    }
  });

  it('les variantes tiennent-elles leur promesse ?', () => {
    const parSemaine = new Map<string, Mesure[]>();
    for (const x of toutes) parSemaine.set(x.semaine, (parSemaine.get(x.semaine) ?? []).concat(x));
    let prefOk = 0;
    let prefN = 0;
    let coutOk = 0;
    let coutN = 0;
    let eqOk = 0;
    let eqN = 0;
    const lignes: string[] = [];
    for (const [m, l] of parSemaine) {
      const v = (k: string) => l.find((x) => x.variante === k)!;
      const pct = (x: Mesure) => (x.souhaits === 'aucune' ? null : Number(x.souhaits.split(' ')[0]));
      const ps = pct(v('souhaits'));
      if (ps !== null) {
        prefN++;
        if (ps >= Math.max(pct(v('equite')) ?? 0, pct(v('cout')) ?? 0)) prefOk++;
      }
      const au = (x: Mesure) => x.auDelaContrat.length;
      coutN++;
      if (au(v('cout')) <= Math.min(au(v('equite')), au(v('souhaits')))) coutOk++;
      eqN++;
      if (v('equite').ecartSamedis <= Math.min(v('souhaits').ecartSamedis, v('cout').ecartSamedis) + 1e-9) eqOk++;
      lignes.push(`${m}: préf ${l.map((x) => `${x.variante}=${x.souhaits}`).join(', ')} | au-delà du contrat ${l.map((x) => `${x.variante}=${au(x)}`).join(', ')} | écart samedis ${l.map((x) => `${x.variante}=${x.ecartSamedis}`).join(', ')}`);
    }
    writeFileSync(`${DOSSIER}/generation-comparaison.txt`, lignes.join('\n'));
    constat(F, { id: 'GV1', regle: 'variante souhaits', scenario: 'Semaines où l’équipe a donné des préférences', attendu: '« Préférences d’abord » suit au moins autant de préférences que les deux autres', obtenu: `${prefOk} semaine(s) sur ${prefN}`, ok: prefOk === prefN });
    constat(F, { id: 'GV2', regle: 'variante cout', scenario: 'Toutes les semaines', attendu: '« Contrats d’abord » laisse au plus autant de personnes au-delà de leur contrat', obtenu: `${coutOk} semaine(s) sur ${coutN}`, ok: coutOk === coutN });
    constat(F, { id: 'GV3', regle: 'variante equite', scenario: 'Toutes les semaines', attendu: '« Équité d’abord » a le plus petit écart des samedis', obtenu: `${eqOk} semaine(s) sur ${eqN}`, ok: eqOk === eqN });
  });

  it('jours fériés et absences : objectif d’heures', () => {
    // Semaine de Noël (vendredi 25 fermé) et semaine du 1er janvier : les heures planifiées comparées à une semaine normale.
    const normale = toutes.filter((x) => x.semaine === '2026-12-07' && x.variante === 'equite')[0];
    for (const sem of ['2026-12-21', '2026-12-28', '2027-05-03']) {
      const f = toutes.filter((x) => x.semaine === sem && x.variante === 'equite')[0];
      const tp = data.personnes.filter((p) => p.salarie && !p.externe && p.heuresHebdo >= 35).map((p) => p.prenom);
      const details = tp.map((n) => `${n} ${f.heures[n]} h (normale ${normale.heures[n]} h)`).join(', ');
      const complets = tp.filter((n) => f.heures[n] >= 34).length;
      constat(F, {
        id: `JF-${sem}`,
        regle: 'objectif hebdomadaire (cibleSemaine)',
        scenario: `Semaine du ${sem} avec jour(s) férié(s) chômé(s), temps pleins`,
        attendu: 'Les heures perdues un jour férié chômé ne se récupèrent pas (Code du travail, L3133-2) : objectif réduit d’un jour, ou alerte',
        obtenu: `${complets} temps plein(s) sur ${tp.length} planifiés ≥ 34 h dans la semaine écourtée : ${details}`,
        ok: complets === 0,
        note: 'cibleSemaine() = heuresHebdo + régularisations, sans déduire les jours fériés ; contratSemaine() (compteur d’heures) ne les déduit pas non plus.',
      });
    }
    // Inès (24 h) en congé lundi-mardi 14-15 déc., indisponible le mercredi : combien d'heures le calcul lui donne-t-il ?
    for (const x of toutes.filter((y) => y.semaine === '2026-12-14')) {
      const ines = data.personnes.find((p) => p.id === 'p_ines')!;
      constat(F, { id: `ABS-ines-${x.variante}`, regle: 'objectif hebdomadaire (cibleSemaine)', scenario: `Inès, 24 h, congé approuvé lundi-mardi (variante ${x.variante})`, attendu: `contrat de la semaine, absences déduites : ${contratSemaine(data, ines, '2026-12-14') / 60} h (contratSemaine) ; objectif donné au calcul : ${cibleSemaine(data, ines, '2026-12-14') / 60} h (cibleSemaine)`, obtenu: `${x.heures['Inès']} h planifiées sur jeudi-samedi`, ok: x.heures['Inès'] <= contratSemaine(data, ines, '2026-12-14') / 60 + 0.01, note: 'Le calcul vise le contrat entier malgré le congé : la personne « rattrape » ses jours de congé sur le reste de la semaine.' });
    }
    // Igor, arrêt mercredi-vendredi de la semaine en cours.
    for (const x of toutes.filter((y) => y.semaine === '2026-11-16')) {
      const igor = data.personnes.find((p) => p.id === 'p_karim')!;
      constat(F, { id: `ABS-igor-${x.variante}`, regle: 'objectif hebdomadaire (cibleSemaine)', scenario: `Igor, 35 h, arrêt mercredi-vendredi, recalcul de la semaine en cours (variante ${x.variante})`, attendu: `au plus ${contratSemaine(data, igor, '2026-11-16') / 60} h (contrat, arrêt déduit)`, obtenu: `${x.heures['Igor']} h planifiées lundi, mardi, samedi`, ok: x.heures['Igor'] <= contratSemaine(data, igor, '2026-11-16') / 60 + 0.01 });
    }
  });

  it('samedis libres et jeunes', () => {
    // Les propositions tiennent-elles le « 1 samedi libre par mois » de l'officine ?
    const sam = toutes.filter((x) => (x.alertes['equipe.samedisLibres'] ?? 0) > 0);
    constat(F, { id: 'SL1', regle: 'equipe.samedisLibres', scenario: 'Toutes les propositions générées (33)', attendu: 'aucune alerte « travaille tous les samedis du mois » créée par le calcul', obtenu: `${sam.length} proposition(s) avec cette alerte : ${sam.map((x) => `${x.semaine}/${x.variante}=${x.alertes['equipe.samedisLibres']}`).join(', ')}`, ok: sam.length === 0, note: 'Le calcul pèse les samedis pour l’équité mais ne lit pas le seuil « samedis libres par mois ».' });
    const manon = toutes.map((x) => x.heures['Manon']);
    constat(F, { id: 'JT2', regle: '(jeunes travailleurs)', scenario: 'Heures de Manon (apprentie, 21 h) dans les 33 propositions', attendu: 'à vérifier selon son âge (35 h/sem. et 8 h/j si mineure)', obtenu: `de ${Math.min(...manon)} h à ${Math.max(...manon)} h`, ok: true });
  });
});

// --------------------------------------------------------------- Cas extrêmes
const POSTES_DIM = [
  { id: 'dim-matin', label: 'Dimanche matin', start: H(9), end: H(13), jours: [6] },
  { id: 'dim-aprem', label: 'Dimanche après-midi', start: H(14), end: H(19), jours: [6] },
];

describe('2 bis. Cas extrêmes', () => {
  const tester = (id: string, scenario: string, d: AppData, monday: string, attendu: string, juger: (m: Mesure, r: GenResult) => boolean) => {
    const t0 = performance.now();
    const res = genererVariantes(d, monday, false);
    const ms = Math.round((performance.now() - t0) / res.length);
    for (const r of res) {
      const m = mesurer(d, monday, r, ms);
      constat(F, { id: `${id}-${r.variante}`, regle: 'generer (cas extrême)', scenario, attendu, obtenu: `${m.bloquants.length} bloquant(s) ${JSON.stringify([...new Set(m.bloquants.map((b) => b.split(':')[0]))])} ; >46 h : ${m.auDela46.join(', ') || 'personne'} ; heures ${JSON.stringify(m.heures)} ; blocages ${r.blocages.map((b) => b.cas + ': ' + b.titre).slice(0, 4).join(' | ')} ; ${ms} ms`, ok: juger(m, r) });
    }
  };

  it('un seul pharmacien (la titulaire)', () => {
    const d0 = seed(TODAY, 2);
    const d: AppData = { ...d0, personnes: d0.personnes.filter((p) => !['p_antoine', 'p_karim', 'p_lea', 'x_paul'].includes(p.id)), missions: [] };
    tester('X1', 'Équipe sans autre pharmacien que la titulaire principale (non salariée), semaine du 7 déc.', d, '2026-12-07', 'présence pharmacien tenue par la titulaire seule ; aucun salarié au-delà de 46 h', (m) => m.auDela46.length === 0 && !m.bloquants.some((b) => b.startsWith('pharmacie.presence')));
  });

  it('un seul pharmacien salarié', () => {
    const d0 = seed(TODAY, 2);
    const d: AppData = { ...d0, personnes: d0.personnes.filter((p) => !['p_helene', 'p_antoine', 'p_lea', 'x_paul'].includes(p.id)), missions: [] };
    tester('X2', 'Seul pharmacien : Igor, adjoint salarié 35 h ; 57 h d’ouverture', d, '2026-12-07', 'Impossibilité annoncée ; jamais plus de 46 h ni de repos insuffisant pour combler', (m) => m.auDela46.length === 0 && !m.bloquants.some((b) => /repos|duree/.test(b.split(':')[0])));
  });

  it('équipe trop petite', () => {
    const d0 = seed(TODAY, 2);
    const d: AppData = { ...d0, personnes: d0.personnes.filter((p) => ['p_helene', 'p_ines'].includes(p.id)), missions: [], besoins: [], souhaits: [] };
    tester('X3', 'Titulaire + une préparatrice 24 h pour 2 à 3 personnes attendues', d, '2026-12-07', 'Sous-effectif signalé, aucune règle impérative enfreinte pour la salariée', (m) => !m.bloquants.some((b) => /repos|duree|indispo|absence/.test(b.split(':')[0])) && m.auDela46.length === 0);
  });

  it('pharmacie ouverte 7 jours sur 7', () => {
    const d0 = seed(TODAY, 2);
    const officine = { ...d0.officine, horaires: d0.officine.horaires.map((h, i) => (i === 6 ? [{ start: H(9), end: H(19) }] : h)), postes: d0.officine.postes.concat(POSTES_DIM), effectifs: d0.officine.effectifs.concat({ jours: [6], start: H(9), end: H(19), minEquipe: 2 }) };
    let d: AppData = { ...d0, officine };
    const semaines = ['2026-12-07', '2026-12-14', '2026-12-21'];
    for (const m of semaines) {
      const r = generer(d, m, { variante: 'equite', graine: 7 });
      const fin = addDays(m, 6);
      d = { ...d, shifts: d.shifts.filter((s) => s.date < m || s.date > fin).concat(r.shifts) };
      const issues = validateWeek(d, m);
      const sept = d.personnes.filter((p) => p.salarie && new Set(r.shifts.filter((s) => s.personId === p.id).map((s) => s.date)).size >= 7).map((p) => p.prenom);
      const six = d.personnes.filter((p) => p.salarie && new Set(r.shifts.filter((s) => s.personId === p.id).map((s) => s.date)).size === 6).map((p) => p.prenom);
      constat(F, { id: `X4-${m}`, regle: 'generer 7j/7', scenario: `Ouverture 7 j/7 (dimanche 9 h - 19 h), semaine du ${m}, enchaînée sur la précédente`, attendu: 'aucun salarié 7 jours sur 7 ; repos hebdomadaire tenu', obtenu: `${issues.filter((i) => i.gravite === 'bloquant').length} bloquant(s) [${[...new Set(issues.filter((i) => i.gravite === 'bloquant').map((i) => i.regle))].join(', ')}] ; salariés à 7 jours : ${sept.join(', ') || 'aucun'} ; à 6 jours : ${six.join(', ') || 'aucun'}`, ok: sept.length === 0 && !issues.some((i) => i.regle === 'repos.hebdo') });
    }
  });

  it('mode « vous seul » : la variante Habitudes et les contraintes posées après coup', () => {
    const d0 = seed(TODAY, 2);
    // Une habitude de la semaine : ce que fait Nicolas le lundi.
    const lundi = '2026-12-07';
    let d: AppData = { ...d0, officine: { ...d0.officine, modele: 'classique' } };
    const res0 = genererVariantes(d, lundi, false);
    const hab = res0.find((r) => r.variante === 'habitudes');
    const travaille = (r: GenResult | undefined, id: string, date: string) => !!r?.shifts.some((s) => s.personId === id && s.date === date);
    const qui = ['p_camille', 'p_thomas', 'p_jules', 'p_ines'].find((id) => travaille(hab, id, lundi)) ?? 'p_camille';
    // On pose un repos ce lundi-là, et une indisponibilité reconnue le mardi.
    d = { ...d, repos: [{ personId: qui, date: lundi }], besoins: d.besoins.concat({ id: 'b_new', personId: qui, forme: 'indisponible', jours: [1], frequence: 1, statut: 'reconnue', horsPlafond: true, decision: 'acceptee', createdAt: '2026-11-20' }) };
    const res = genererVariantes(d, lundi, false);
    for (const r of res) {
      const reposViole = travaille(r, qui, lundi);
      const indispoViolee = travaille(r, qui, '2026-12-08');
      constat(F, { id: `HB-${r.variante}`, regle: 'generer (habitudes)', scenario: `Mode « vous seul », ${qui} : repos posé le lundi 7 déc. et indisponibilité reconnue le mardi (il travaille ces jours-là d’habitude)`, attendu: 'repos posé et indisponibilité reconnue respectés par chaque proposition', obtenu: `variante ${r.variante} : poste le lundi ${reposViole ? 'OUI' : 'non'}, poste le mardi ${indispoViolee ? 'OUI' : 'non'} ; bloquants ${r.indicateurs.bloquants}`, ok: !reposViole && !indispoViolee });
    }
  });

  it('postes types plus longs que la loi', () => {
    const d0 = seed(TODAY, 2);
    // Un poste type de 11 h de travail sans pause : le calcul l'utilise-t-il ?
    const officine = { ...d0.officine, postes: [{ id: 'xxl', label: 'Très longue', start: H(8, 30), end: H(19, 30), jours: [0, 1, 2, 3, 4] }, ...d0.officine.postes.filter((p) => p.jours.includes(5))] };
    const d: AppData = { ...d0, officine };
    const r = generer(d, '2026-12-07', { variante: 'equite', graine: 3 });
    const fin = '2026-12-13';
    const dd: AppData = { ...d, shifts: d.shifts.filter((s) => s.date < '2026-12-07' || s.date > fin).concat(r.shifts) };
    const b = validateWeek(dd, '2026-12-07').filter((i) => i.gravite === 'bloquant');
    const regles = [...new Set(b.map((i) => i.regle))];
    constat(F, { id: 'X5', regle: 'generer (postes types)', scenario: 'Seul poste type en semaine : 8 h 30 - 19 h 30 sans pause (11 h)', attendu: 'le calcul n’affecte pas de salarié sur un poste qui dépasse 10 h et 6 h sans pause, ou le dit', obtenu: `${b.length} bloquant(s) : ${regles.join(', ')} ; ${r.shifts.filter((s) => s.start === H(8, 30) && s.end === H(19, 30) && d.personnes.find((p) => p.id === s.personId)?.salarie).length} postes de 11 h donnés à des salariés`, ok: !regles.includes('duree.quotidienne') && !regles.includes('duree.pause') });
  });
});
