import { describe, it } from 'vitest';
import { rmSync } from 'node:fs';
import { seed } from '/home/user/releve-planning/src/data/seed';
import { generer } from '/home/user/releve-planning/src/engine/generate';
import { validateWeek } from '/home/user/releve-planning/src/engine/validate';
import { preparerMois } from '/home/user/releve-planning/src/engine/echeance';
import { planifieMois } from '/home/user/releve-planning/src/engine/souhaits';
import { contratSemaine } from '/home/user/releve-planning/src/engine/heures';
import { minutesSemaine, besoinsDe, contreditBesoin, enRepos } from '/home/user/releve-planning/src/engine/core';
import { addDays, mondayOf, weekDates, ferie } from '/home/user/releve-planning/src/domain/time';
import type { AppData, Garde, Person } from '/home/user/releve-planning/src/domain/types';
import { DOSSIER, H, constat, poste, personne, base } from './aide';

rmSync(`${DOSSIER}/complements.jsonl`, { force: true });
const F = 'complements';
const TODAY = '2026-11-20';

describe('Compléments', () => {
  it('poste type illégal à côté de postes légaux', () => {
    const d0 = seed(TODAY, 2);
    const officine = { ...d0.officine, postes: d0.officine.postes.concat({ id: 'xxl', label: 'Très longue', start: H(8, 30), end: H(19, 30), jours: [0, 1, 2, 3, 4] }) };
    const d: AppData = { ...d0, officine };
    let n = 0;
    let b = 0;
    for (const graine of [1, 2, 3]) {
      const r = generer(d, '2026-12-07', { variante: 'equite', graine });
      n += r.shifts.filter((s) => s.start === H(8, 30) && s.end === H(19, 30) && s.pauseStart === undefined && d.personnes.find((p) => p.id === s.personId)?.salarie).length;
      b += r.indicateurs.bloquants;
    }
    constat(F, { id: 'X5b', regle: 'generer (postes types)', scenario: 'Postes types de l’exemple + un poste 8 h 30 - 19 h 30 sans pause (11 h), trois graines', attendu: 'le poste de 11 h sans pause n’est jamais donné à un salarié', obtenu: `${n} poste(s) de 11 h sans pause donné(s) à des salariés ; ${b} bloquant(s) au total`, ok: n === 0, note: 'Le calcul ne vérifie ni la durée quotidienne ni la pause : il fait confiance aux postes types ; l’écran de création de poste type ne les borne pas (PosteTypeDialogue : seulement fin > début).' });
  });

  it('préparation automatique du mois (relais à l’échéance)', () => {
    let d = seed(TODAY, 2);
    d = { ...d, officine: { ...d.officine, modele: 'classique' } };
    // Contraintes posées après les huit semaines de référence : un repos et une indisponibilité reconnue.
    d = { ...d, repos: [{ personId: 'p_camille', date: '2026-12-08' }], besoins: d.besoins.concat({ id: 'b_new', personId: 'p_thomas', forme: 'indisponible', jours: [2], frequence: 1, statut: 'reconnue', horsPlafond: true, decision: 'acceptee', createdAt: TODAY }) };
    const r = preparerMois(d, '2026-11-18', '2026-12', '2026-11-18T08:00:00Z');
    let reposV = 0;
    let indispoV = 0;
    let bloq = 0;
    for (const m of r.semaines) {
      for (const s of r.data.shifts.filter((x) => x.date >= m && x.date <= addDays(m, 6))) {
        if (enRepos(r.data, s.personId, s.date)) reposV++;
        if (besoinsDe(r.data, s.personId, s.date).some((b) => b.statut === 'reconnue' && contreditBesoin(b, s))) indispoV++;
      }
      bloq += validateWeek(r.data, m).filter((i) => i.gravite === 'bloquant').length;
    }
    constat(F, { id: 'RL1', regle: 'echeance.preparerMois', scenario: 'Relais à l’échéance (décembre 2026, d’après les habitudes) avec un repos posé pour Nicolas le 8 déc. et une indisponibilité reconnue de Thomas le mercredi', attendu: 'semaines préparées sans enfreindre repos posés ni indisponibilités reconnues', obtenu: `${r.semaines.length} semaine(s) préparée(s) (${r.habitudes} d’après les habitudes) ; postes sur un repos posé : ${reposV} ; postes contre une indisponibilité reconnue : ${indispoV} ; bloquants : ${bloq}`, ok: reposV === 0 && indispoV === 0, note: 'semaineHabituelle() recopie les journées les plus fréquentes sans relire ni les besoins reconnus, ni les repos posés, ni les règles.' });
  });

  it('heures du mois : vue Mois et jours fériés', () => {
    const d = seed(TODAY, 2);
    const p = d.personnes.find((x) => x.id === 'p_camille')!;
    const nov = planifieMois(d, p, '2026-11');
    const ouvres = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`).filter((x) => new Date(x).getUTCDay() >= 1 && new Date(x).getUTCDay() <= 5);
    const sansFerie = ouvres.filter((x) => !ferie(x));
    constat(F, { id: 'HM-nov', regle: 'souhaits.planifieMois', scenario: 'Nicolas, novembre 2026 (mercredi 11 férié), vue Mois', attendu: `contrat sur ${sansFerie.length} jours ouvrés hors férié = ${(sansFerie.length * 7).toFixed(1)} h`, obtenu: `contrat compté ${(nov.cible / 60).toFixed(1)} h pour ${(nov.minutes / 60).toFixed(1)} h planifiées`, ok: nov.cible <= sansFerie.length * 7 * 60, note: 'Le jour férié compte dans l’objectif du mois.' });
    // Décomposition du solde : d'où vient le « retard » de chacun ?
    const lignes: string[] = [];
    for (const id of ['p_camille', 'p_yanis', 'p_karim']) {
      const q = d.personnes.find((x) => x.id === id)!;
      const sem = Object.entries(d.semaines).filter(([m, s]) => s.statut === 'publie' && m <= mondayOf(TODAY)).map(([m]) => m).sort();
      lignes.push(`${q.prenom} : ` + sem.map((m) => `${m.slice(5)} ${((minutesSemaine(d, id, m) - contratSemaine(d, q, m)) / 60).toFixed(1)}`).join(' '));
    }
    constat(F, { id: 'SH-detail', regle: 'heures.soldeHeures', scenario: 'Écart semaine par semaine (planifié - contrat), semaines publiées de l’exemple', attendu: 'écarts proches de 0 hors semaine fériée', obtenu: lignes.join(' | '), ok: true });
  });

  it('gardes et durée hebdomadaire', () => {
    const A = personne('a1', 'adjoint', 35);
    const T = personne('t1', 'titulaire', 42);
    const W = '2027-01-11';
    const shifts = weekDates(W).slice(0, 5).map((d) => poste('a1', d, H(8, 30), H(18), { pauseStart: H(12, 30), pauseEnd: H(13, 30) }));
    const g: Garde = { id: 'g', date: '2027-01-17', start: H(9), end: H(19), type: 'volets_ouverts', personId: 'a1', interventions: [] };
    const l = validateWeek(base([A, T], shifts, { gardes: [g] }), W).filter((i) => i.personId === 'a1');
    constat(F, { id: 'GH1', regle: 'duree.hebdo', scenario: 'Adjoint : 5 × 8 h 30 = 42 h 30 de postes, plus une garde à volets ouverts le dimanche 9 h - 19 h (10 h de travail effectif) = 52 h 30', attendu: 'durée hebdomadaire dépassée (bloquant)', obtenu: l.map((i) => `${i.gravite} ${i.regle}`).join(', ') || 'aucun constat', ok: l.some((i) => i.regle === 'duree.hebdo') });
  });

  it('temps de calcul sur une grande équipe', () => {
    const d0 = seed(TODAY, 2);
    const clones: Person[] = [];
    for (const k of [1, 2]) for (const p of d0.personnes.filter((x) => !x.externe && x.qualification !== 'titulaire')) clones.push({ ...p, id: `${p.id}_${k}`, prenom: `${p.prenom}${k}` });
    const d: AppData = { ...d0, personnes: d0.personnes.concat(clones), officine: { ...d0.officine, effectifs: d0.officine.effectifs.map((e) => ({ ...e, minEquipe: e.minEquipe * 3 })) } };
    const t0 = performance.now();
    const r = generer(d, '2026-12-07', { variante: 'equite', graine: 7 });
    const ms = Math.round(performance.now() - t0);
    constat(F, { id: 'PERF', regle: 'generer (temps)', scenario: `Équipe de ${d.personnes.filter((x) => !x.externe).length} personnes, une variante, 40 000 itérations`, attendu: 'quelques secondes au plus', obtenu: `${ms} ms ; ${r.indicateurs.bloquants} bloquant(s)`, ok: ms < 10000 });
  });
});
