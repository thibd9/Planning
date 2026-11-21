import { describe, it } from 'vitest';
import { rmSync } from 'node:fs';
import { validateEquipe, validateWeek } from '/home/user/releve-planning/src/engine/validate';
import type { Issue } from '/home/user/releve-planning/src/engine/validate';
import { controlePublication } from '/home/user/releve-planning/src/engine/publish';
import { delaiGarde } from '/home/user/releve-planning/src/engine/gardes';
import { delaiRemplacement, peutDemanderRemplacement } from '/home/user/releve-planning/src/engine/remplacement';
import { REGLES_INITIALES } from '/home/user/releve-planning/src/domain/rules';
import type { AppData, Besoin, Garde, Mission } from '/home/user/releve-planning/src/domain/types';
import { DOSSIER, H, base, constat, personne, poste } from './aide';

rmSync(`${DOSSIER}/regles.jsonl`, { force: true });
const F = 'regles';
// Semaine sans jour férié : lundi 11 au dimanche 17 janvier 2027.
const W = '2027-01-11';
const LUN = '2027-01-11';
const MAR = '2027-01-12';
const MER = '2027-01-13';
const JEU = '2027-01-14';
const VEN = '2027-01-15';
const SAM = '2027-01-16';
const DIM = '2027-01-17';
const LUN2 = '2027-01-18';

const A1 = personne('a1', 'adjoint', 35, { competences: ['vaccination', 'entretien'] });
const T1 = personne('t1', 'titulaire', 42);
const P1 = personne('p1', 'preparateur', 35);
const P2 = personne('p2', 'preparateur', 24);
const MANON = personne('manon', 'apprenti', 21);

const de = (issues: Issue[], regle: string): Issue[] => issues.filter((i) => i.regle === regle);
const dire = (l: Issue[]): string => (l.length ? l.map((i) => `${i.gravite}: ${i.message}`).join(' / ') : 'aucun constat');
/** Une journée couverte par la titulaire, pour que la présence d'un pharmacien ne pollue pas les essais. */
const couverture = (date: string, start = H(8, 30), end = H(19, 30)) => poste('t1', date, start, end);

function cas(id: string, regle: string, scenario: string, data: AppData, attendu: 'bloquant' | 'alerte' | 'info' | 'rien', note?: string, monday = W): Issue[] {
  const l = de(validateWeek(data, monday), regle);
  const ok = attendu === 'rien' ? l.length === 0 : l.length > 0 && l.every((i) => i.gravite === attendu);
  constat(F, { id, regle, scenario, attendu: attendu === 'rien' ? 'non signalé' : `signalé, ${attendu}`, obtenu: dire(l), ok, note });
  return l;
}

describe('1. Règles : cas qui viole et cas limite', () => {
  it('durée quotidienne (10 h)', () => {
    cas('Q1', 'duree.quotidienne', 'Préparateur 8 h - 19 h, pause 13 h - 13 h 59 : 10 h 01 de travail', base([T1, P1], [poste('p1', LUN, H(8), H(19), { pauseStart: H(13), pauseEnd: H(13, 59) })]), 'bloquant');
    cas('Q2', 'duree.quotidienne', 'Préparateur 8 h - 19 h, pause 13 h - 14 h : 10 h 00 pile', base([T1, P1], [poste('p1', LUN, H(8), H(19), { pauseStart: H(13), pauseEnd: H(14) })]), 'rien');
    cas('Q3', 'duree.quotidienne', 'Titulaire 12 h de travail (non salarié)', base([T1], [poste('t1', LUN, H(7), H(19, 30), { pauseStart: H(12), pauseEnd: H(12, 30) })]), 'rien');
    cas('Q4', 'duree.quotidienne', 'Deux postes le même jour : 6 h + 4 h 30 = 10 h 30', base([T1, P1], [poste('p1', LUN, H(8), H(14)), poste('p1', LUN, H(15), H(19, 30))]), 'bloquant');
    // Garde à volets ouverts = travail effectif ; le moteur dit « le temps de garde est décompté à part ».
    const g: Garde = { id: 'g1', date: LUN, start: H(20), end: H(23), type: 'volets_ouverts', personId: 'a1', interventions: [] };
    cas('Q5', 'duree.quotidienne', 'Adjoint : poste 8 h 30 - 19 h 30 (9 h 30 de travail) puis garde à volets ouverts 20 h - 23 h le même jour (3 h de travail effectif) = 12 h 30', base([A1], [poste('a1', LUN, H(8, 30), H(19, 30), { pauseStart: H(12, 30), pauseEnd: H(14) })], { gardes: [g] }), 'bloquant', 'La garde à volets ouverts est du travail effectif (le moteur la paie comme telle, code GARDE_VO) mais n’entre pas dans la durée quotidienne.');
  });

  it('amplitude (12 h)', () => {
    cas('A1', 'duree.amplitude', 'Deux postes 7 h - 11 h et 15 h - 19 h 01 : amplitude 12 h 01', base([T1, P1], [poste('p1', LUN, H(7), H(11)), poste('p1', LUN, H(15), H(19, 1))]), 'bloquant');
    cas('A2', 'duree.amplitude', 'Deux postes 7 h - 11 h et 15 h - 19 h : amplitude 12 h pile', base([T1, P1], [poste('p1', LUN, H(7), H(11)), poste('p1', LUN, H(15), H(19))]), 'rien');
  });

  it('durée hebdomadaire (46 h) et plafond de l’officine (42 h)', () => {
    const semaine = (fin: number) => [LUN, MAR, MER, JEU, VEN].map((d) => poste('p1', d, H(8), fin, { pauseStart: H(12), pauseEnd: H(13) }));
    cas('H1', 'duree.hebdo', '5 jours de 9 h 15 = 46 h 15', base([T1, P1], semaine(H(18, 15))), 'bloquant');
    cas('H2', 'duree.hebdo', '5 jours de 9 h 12 = 46 h 00 pile', base([T1, P1], semaine(H(18, 12))), 'rien');
    cas('H3', 'equipe.heuresMax', '46 h 00 : au-dessus du plafond de 42 h, sous le maximum', base([T1, P1], semaine(H(18, 12))), 'alerte');
    cas('H4', 'equipe.heuresMax', '46 h 15 : au-delà du maximum, le plafond ne double pas le constat', base([T1, P1], semaine(H(18, 15))), 'rien');
    cas('H5', 'equipe.heuresMax', '5 jours de 8 h 24 = 42 h 00 pile', base([T1, P1], semaine(H(17, 24))), 'rien');
    cas('H6', 'equipe.heuresMax', '5 jours de 8 h 27 = 42 h 15', base([T1, P1], semaine(H(17, 27))), 'alerte');
    // Temps partiel de 24 h planifié 34 h : heures complémentaires au-delà du dixième (2 h 24) et du tiers (8 h), aucun contrôle.
    const p2 = [LUN, MAR, MER, JEU].map((d) => poste('p2', d, H(9), H(17, 30), { pauseStart: H(12), pauseEnd: H(13) }));
    const l = validateWeek(base([T1, P2], p2), W).filter((i) => i.personId === 'p2');
    constat(F, { id: 'H7', regle: '(aucune) heures complémentaires', scenario: 'Temps partiel 24 h planifié 4 × 7 h 30 = 30 h (6 h complémentaires, au-delà du dixième du contrat)', attendu: 'au moins une alerte (limite du dixième, ou du tiers par accord, Code du travail)', obtenu: dire(l), ok: l.length > 0, note: 'Aucune règle ne borne les heures complémentaires d’un temps partiel.' });
  });

  it('pause (20 min dès 6 h)', () => {
    cas('P1', 'duree.pause', '8 h - 14 h 15 sans coupure : 6 h 15 continues', base([T1, P1], [poste('p1', LUN, H(8), H(14, 15))]), 'bloquant');
    cas('P2', 'duree.pause', '8 h - 14 h sans coupure : 6 h 00 pile', base([T1, P1], [poste('p1', LUN, H(8), H(14))]), 'bloquant', 'L3121-16 (cité par la fiche) : « dès que le temps de travail quotidien ATTEINT six heures ». Le moteur ne signale qu’au-delà de 6 h (test `> 360`) et la fiche dit « au-delà de 6 heures ».');
    cas('P3', 'duree.pause', '8 h - 12 h puis 12 h 19 - 15 h : coupure de 19 min, 6 h 41 de travail', base([T1, P1], [poste('p1', LUN, H(8), H(12)), poste('p1', LUN, H(12, 19), H(15))]), 'bloquant');
    cas('P4', 'duree.pause', '8 h - 12 h puis 12 h 20 - 15 h : coupure de 20 min', base([T1, P1], [poste('p1', LUN, H(8), H(12)), poste('p1', LUN, H(12, 20), H(15))]), 'rien');
    cas('P5', 'duree.pause', '8 h - 15 h avec une pause courte de 20 min (10 h 50 - 11 h 10) saisie dans « pauses »', base([T1, P1], [poste('p1', LUN, H(8), H(15), { pauses: [{ start: H(10, 50), end: H(11, 10) }] })]), 'rien', 'La pause courte de 20 min consécutives, payée, satisfait L3121-16 ; le moteur l’ignore et signale « sans pause de 20 minutes ».');
    const regles = REGLES_INITIALES.map((r) => (r.id === 'duree.pause' ? { ...r, valeur: 30 } : r));
    cas('P6', 'duree.pause', 'Pause portée à 30 min : 8 h - 12 h puis 12 h 25 - 15 h (coupure de 25 min)', base([T1, P1], [poste('p1', LUN, H(8), H(12)), poste('p1', LUN, H(12, 25), H(15))], { regles }), 'bloquant');
  });

  it('repos quotidien (11 h)', () => {
    cas('RQ1', 'repos.quotidien', 'Lundi 8 h 30 - 19 h 30, mardi dès 6 h 30 : 11 h pile', base([T1, P1], [poste('p1', LUN, H(8, 30), H(19, 30), { pauseStart: H(12, 30), pauseEnd: H(14) }), poste('p1', MAR, H(6, 30), H(12))]), 'rien');
    cas('RQ2', 'repos.quotidien', 'Lundi 8 h 30 - 19 h 30, mardi dès 6 h 15 : 10 h 45', base([T1, P1], [poste('p1', LUN, H(8, 30), H(19, 30), { pauseStart: H(12, 30), pauseEnd: H(14) }), poste('p1', MAR, H(6, 15), H(12))]), 'bloquant');
    cas('RQ3', 'repos.quotidien', 'Dimanche de la semaine précédente 14 h - 22 h, lundi 8 h 30 : 10 h 30 (à cheval sur deux semaines)', base([T1, P1], [poste('p1', '2027-01-10', H(14), H(22), { pauseStart: H(17), pauseEnd: H(17, 30) }), poste('p1', LUN, H(8, 30), H(12))]), 'bloquant');
    const gVF: Garde = { id: 'g1', date: LUN, start: H(20), end: H(8), type: 'volets_fermes', personId: 'a1', interventions: [] };
    cas('RQ4', 'repos.quotidien', 'Adjoint de garde à volets fermés lundi 20 h - mardi 8 h, poste mardi 9 h - 13 h', base([A1, T1], [poste('a1', MAR, H(9), H(13))], { gardes: [gVF] }), 'bloquant');
    const gA: Garde = { id: 'g2', date: LUN, start: H(20), end: H(8), type: 'astreinte', personId: 'a1', interventions: [] };
    cas('RQ5', 'repos.quotidien', 'Astreinte lundi 20 h - mardi 8 h sans intervention, poste mardi 8 h 30', base([A1, T1], [poste('a1', MAR, H(8, 30), H(12))], { gardes: [gA] }), 'rien');
    const gA2: Garde = { ...gA, interventions: [{ id: 'i', offset: 360, duree: 60 }] };
    cas('RQ6', 'repos.quotidien', 'Même astreinte avec une intervention de 2 h à 3 h, poste mardi 8 h 30 (5 h 30 de repos)', base([A1, T1], [poste('a1', MAR, H(8, 30), H(12))], { gardes: [gA2] }), 'bloquant');
    // Changement d'heure de printemps : la nuit du 27 au 28 mars 2027 dure une heure de moins.
    const o7 = base([T1, P1], [poste('p1', '2027-03-27', H(13), H(21), { pauseStart: H(16), pauseEnd: H(16, 30) }), poste('p1', '2027-03-28', H(8), H(12))]);
    cas('RQ7', 'repos.quotidien', 'Samedi 27 mars 2027 fin 21 h, dimanche 28 mars début 8 h : 11 h à l’horloge, 10 h réellement écoulées (passage à l’heure d’été)', o7, 'bloquant', 'Le repos est mesuré en heure locale « naïve » (absMin), sans le décalage d’heure que le moteur sait pourtant calculer pour les gardes (dureeReelle).', '2027-03-22');
  });

  it('repos hebdomadaire (36 h)', () => {
    const jours = [LUN, MAR, MER, JEU, VEN, SAM].map((d) => poste('p1', d, H(9), H(17), { pauseStart: H(12), pauseEnd: H(13) }));
    const avecSemainePrec = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10'].map((d) => poste('p1', d, H(9), H(17), { pauseStart: H(12), pauseEnd: H(13) }));
    cas('RH1', 'repos.hebdo', 'Semaine précédente travaillée jusqu’au dimanche 17 h ; lundi au samedi 9 h - 17 h, puis lundi suivant dès 5 h : samedi 17 h → lundi 5 h = 36 h pile', base([T1, P1], [...avecSemainePrec, ...jours, poste('p1', LUN2, H(5), H(12))]), 'rien');
    cas('RH2', 'repos.hebdo', 'Idem, lundi suivant dès 4 h 45 : 35 h 45', base([T1, P1], [...avecSemainePrec, ...jours, poste('p1', LUN2, H(4, 45), H(12))]), 'bloquant');
    // Sept jours travaillés dans la semaine, première semaine planifiée (rien la semaine précédente).
    const sept = [LUN, MAR, MER, JEU, VEN, SAM, DIM].map((d) => poste('p1', d, H(9), H(16), { pauseStart: H(12), pauseEnd: H(13) }));
    cas('RH3', 'repos.hebdo', 'Sept jours sur sept (lundi au dimanche 9 h - 16 h), la semaine précédente vide, le lundi suivant travaillé 9 h', base([T1, P1], [...sept, poste('p1', LUN2, H(9), H(16), { pauseStart: H(12), pauseEnd: H(13) })]), 'bloquant', 'Le plus long repos de la semaine est de 17 h ; le moteur compte comme repos le temps « depuis toujours » avant le premier poste quand la semaine précédente est vide.');
    // Sept jours dans la semaine, la semaine précédente travaillée du lundi au vendredi seulement : le week-end précédent sert de repos.
    const precLV = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08'].map((d) => poste('p1', d, H(9), H(16), { pauseStart: H(12), pauseEnd: H(13) }));
    cas('RH4', 'repos.hebdo', 'Semaine précédente du lundi au vendredi, puis sept jours sur sept : le seul repos de 36 h est le week-end de la semaine précédente', base([T1, P1], [...precLV, ...sept, poste('p1', LUN2, H(9), H(16), { pauseStart: H(12), pauseEnd: H(13) })]), 'bloquant', 'Le repos du week-end précédent (vendredi 16 h → lundi 9 h, 65 h) est crédité à la semaine suivante. Le Code du travail (L3132-1) interdit aussi plus de six jours de travail par semaine : aucun contrôle.');
  });

  it('présence d’un pharmacien', () => {
    cas('PH1', 'pharmacie.presence', 'Adjoint 8 h 30 - 19 h 29 (ouverture jusqu’à 19 h 30) : 1 min sans pharmacien', base([A1, P1], [poste('a1', LUN, H(8, 30), H(19, 29), { pauseStart: H(12), pauseEnd: H(12) })]), 'bloquant');
    const l = de(validateWeek(base([A1, P1], [poste('a1', LUN, H(8, 30), H(19, 30))]), W), 'pharmacie.presence').filter((i) => i.date === LUN);
    constat(F, { id: 'PH2', regle: 'pharmacie.presence', scenario: 'Adjoint 8 h 30 - 19 h 30 pile, lundi', attendu: 'non signalé pour lundi', obtenu: dire(l), ok: l.length === 0 });
    const l3 = de(validateWeek(base([A1], [poste('a1', LUN, H(8, 30), H(19, 30), { pauseStart: H(12, 30), pauseEnd: H(13, 30) })]), W), 'pharmacie.presence').filter((i) => i.date === LUN);
    constat(F, { id: 'PH3', regle: 'pharmacie.presence', scenario: 'Seul pharmacien = adjoint, pause 12 h 30 - 13 h 30', attendu: 'bloquant 12 h 30 - 13 h 30', obtenu: dire(l3), ok: l3.length === 1 && l3[0].start === H(12, 30) && l3[0].end === H(13, 30) });
    const l4 = de(validateWeek(base([T1], [poste('t1', LUN, H(8, 30), H(19, 30), { pauseStart: H(12, 30), pauseEnd: H(13, 30) })]), W), 'pharmacie.presence').filter((i) => i.date === LUN);
    constat(F, { id: 'PH4', regle: 'pharmacie.presence', scenario: 'Seul pharmacien = titulaire, pause 12 h 30 - 13 h 30', attendu: 'non signalé (règle annoncée : le titulaire reste présent pendant sa pause)', obtenu: dire(l4), ok: l4.length === 0 });
    const l5 = de(validateWeek(base([A1], [poste('a1', LUN, H(8, 30), H(19, 30), { activite: 'formation' })]), W), 'pharmacie.presence').filter((i) => i.date === LUN);
    constat(F, { id: 'PH5', regle: 'pharmacie.presence', scenario: 'Seul pharmacien en « formation (hors officine) » toute la journée', attendu: 'bloquant toute la journée', obtenu: dire(l5), ok: l5.length === 1 && l5[0].start === H(8, 30) && l5[0].end === H(19, 30) });
    const l6 = de(validateWeek(base([A1], [poste('a1', '2027-01-01', H(8, 30), H(10))]), '2026-12-28'), 'pharmacie.presence').filter((i) => i.date === '2027-01-01');
    constat(F, { id: 'PH6', regle: 'pharmacie.presence', scenario: 'Vendredi 1er janvier 2027 (férié, officine fermée les jours fériés)', attendu: 'aucun contrôle ce jour-là', obtenu: dire(l6), ok: l6.length === 0 });
  });

  it('seul pharmacien en rendez-vous, compétences et salle', () => {
    const m = (x: Partial<Mission>): Mission => ({ id: 'm1', date: LUN, start: H(10), end: H(10, 30), type: 'entretien', personId: 'a1', salle: true, reportable: true, ...x });
    const jour = [poste('a1', LUN, H(8, 30), H(19, 30), { pauseStart: H(12, 30), pauseEnd: H(12, 30) })];
    cas('RDV1', 'pharmacie.rdv', 'Seul pharmacien (adjoint) en entretien 10 h - 10 h 30', base([A1, P1], jour, { missions: [m({})] }), 'alerte');
    cas('RDV2', 'pharmacie.rdv', 'Entretien 10 h - 10 h 30 avec la titulaire en poste à côté', base([A1, T1, P1], [...jour, couverture(LUN)], { missions: [m({})] }), 'rien');
    cas('C1', 'pharmacie.competence', 'Vaccination confiée au préparateur sans la compétence', base([A1, P1], [...jour, poste('p1', LUN, H(9), H(17), { pauseStart: H(12), pauseEnd: H(13) })], { missions: [m({ type: 'vaccination', personId: 'p1' })] }), 'bloquant');
    cas('C2', 'pharmacie.competence', 'Entretien 10 h - 10 h 30, adjoint en poste 8 h 30 - 10 h 29 seulement', base([A1, T1], [poste('a1', LUN, H(8, 30), H(10, 29)), couverture(LUN)], { missions: [m({})] }), 'bloquant');
    cas('C3', 'pharmacie.competence', 'Entretien 10 h - 10 h 30, adjoint en poste 8 h 30 - 10 h 30 (fin pile)', base([A1, T1], [poste('a1', LUN, H(8, 30), H(10, 30)), couverture(LUN)], { missions: [m({})] }), 'rien');
    cas('C4', 'pharmacie.competence', 'Créneau de vaccination sans personne affectée', base([A1], jour, { missions: [m({ personId: null, type: 'vaccination' })] }), 'alerte');
    cas('C5', 'pharmacie.competence', 'Deux activités en salle de confidentialité 10 h - 10 h 30 et 10 h 15 - 10 h 45', base([A1, T1], [...jour, couverture(LUN)], { missions: [m({ id: 'm1' }), m({ id: 'm2', start: H(10, 15), end: H(10, 45), personId: 't1', type: 'rdv_labo' })] }), 'bloquant');
    const prepEntretien = personne('p3', 'preparateur', 35, { competences: ['entretien'] });
    cas('C6', 'pharmacie.competence', 'Entretien pharmaceutique confié à un préparateur dont la fiche porte la compétence « entretien » (réservée aux pharmaciens)', base([A1, prepEntretien], [...jour, poste('p3', LUN, H(9), H(17), { pauseStart: H(12), pauseEnd: H(13) })], { missions: [m({ personId: 'p3' })] }), 'bloquant', 'peutDetenir() réserve « entretien » et « trod » aux pharmaciens, mais validateWeek ne contrôle que la liste des compétences de la fiche.');
  });

  it('effectif minimal au comptoir', () => {
    const trois = ['p1', 'p2', 'a1'].map((id) => poste(id, LUN, H(8, 30), H(19, 30)));
    const pers = [A1, P1, P2];
    const l0 = de(validateWeek(base(pers, trois), W), 'equipe.effectif').filter((i) => i.date === LUN);
    constat(F, { id: 'E1', regle: 'equipe.effectif', scenario: 'Trois personnes au comptoir toute la journée (seuils 2, 3 de 10 h à 12 h 30 et de 16 h 30 à 19 h)', attendu: 'non signalé', obtenu: dire(l0), ok: l0.length === 0 });
    const l1 = de(validateWeek(base(pers, trois.slice(0, 2)), W), 'equipe.effectif').filter((i) => i.date === LUN);
    constat(F, { id: 'E2', regle: 'equipe.effectif', scenario: 'Deux personnes seulement', attendu: 'alerte 10 h - 12 h 30 et 16 h 30 - 19 h', obtenu: dire(l1), ok: l1.length === 2 && l1.every((i) => i.gravite === 'alerte') });
    const pause1 = [poste('p1', LUN, H(8, 30), H(19, 30), { pauseStart: H(10, 15), pauseEnd: H(10, 45) }), ...trois.slice(1)];
    const l2 = de(validateWeek(base(pers, pause1), W), 'equipe.effectif').filter((i) => i.date === LUN);
    constat(F, { id: 'E3', regle: 'equipe.effectif', scenario: 'Trois personnes, l’une en pause 10 h 15 - 10 h 45 (2 au comptoir pour 3 attendues pendant 30 min)', attendu: 'alerte de 10 h 15 à 10 h 45', obtenu: dire(l2), ok: l2.length === 1 && l2[0].start === H(10, 15) && l2[0].end === H(10, 45), note: 'Le contrôle échantillonne toutes les 30 min à partir de l’ouverture (8 h 30, 9 h, 9 h 30…).' });
    const pause2 = [poste('p1', LUN, H(8, 30), H(19, 30), { pauseStart: H(10, 5), pauseEnd: H(10, 25) }), ...trois.slice(1)];
    const l3 = de(validateWeek(base(pers, pause2), W), 'equipe.effectif').filter((i) => i.date === LUN);
    constat(F, { id: 'E4', regle: 'equipe.effectif', scenario: 'Trois personnes, l’une en pause 10 h 05 - 10 h 25 (20 min sous le seuil)', attendu: 'alerte de 10 h 05 à 10 h 25', obtenu: dire(l3), ok: l3.length === 1 });
    const back = [poste('p1', LUN, H(8, 30), H(19, 30), { activite: 'back' }), ...trois.slice(1)];
    const l4 = de(validateWeek(base(pers, back), W), 'equipe.effectif').filter((i) => i.date === LUN);
    constat(F, { id: 'E5', regle: 'equipe.effectif', scenario: 'Trois personnes dont une en réception (activité « back »)', attendu: 'alerte (2 au comptoir)', obtenu: dire(l4), ok: l4.length === 2 });
  });

  it('absences approuvées, indisponibilités reconnues, préférences', () => {
    const abs = (statut: 'approuvee' | 'demandee' | 'refusee') => [{ id: 'ab', personId: 'p1', from: LUN, to: MAR, type: 'conge' as const, statut, createdAt: '2027-01-01' }];
    const s = [couverture(LUN), poste('p1', MAR, H(9), H(12))];
    cas('AB1', 'equipe.absence', 'Poste mardi pendant un congé approuvé lundi-mardi', base([T1, P1], s, { absences: abs('approuvee') }), 'bloquant');
    cas('AB2', 'equipe.absence', 'Poste mardi pendant un congé seulement demandé', base([T1, P1], s, { absences: abs('demandee') }), 'rien');
    cas('AB3', 'equipe.absence', 'Poste mercredi, lendemain du congé approuvé', base([T1, P1], [poste('p1', MER, H(9), H(12))], { absences: abs('approuvee') }), 'rien');
    const b = (x: Partial<Besoin>): Besoin => ({ id: 'b1', personId: 'p1', forme: 'indisponible', jours: [0], frequence: 1, statut: 'reconnue', horsPlafond: true, decision: 'acceptee', createdAt: '2027-01-01', ...x });
    const lundi = (start: number, end: number) => [poste('p1', LUN, start, end)];
    cas('I1', 'equipe.indisponibilite', 'Indisponibilité reconnue le lundi (journée), poste lundi', base([T1, P1], lundi(H(9), H(12)), { besoins: [b({})] }), 'bloquant');
    cas('I2', 'equipe.indisponibilite', 'Indisponible lundi 14 h - 18 h, poste 9 h - 14 h (fin pile au début de la plage)', base([T1, P1], lundi(H(9), H(14)), { besoins: [b({ plageStart: H(14), plageEnd: H(18) })] }), 'rien');
    cas('I3', 'equipe.indisponibilite', 'Indisponible lundi 14 h - 18 h, poste 9 h - 14 h 15', base([T1, P1], lundi(H(9), H(14, 15)), { besoins: [b({ plageStart: H(14), plageEnd: H(18) })] }), 'bloquant');
    cas('I4', 'equipe.indisponibilite', '« Finir avant 17 h » reconnu, poste jusqu’à 17 h pile', base([T1, P1], lundi(H(9), H(17)), { besoins: [b({ forme: 'finir_avant', heure: H(17) })] }), 'rien');
    cas('I5', 'equipe.indisponibilite', '« Finir avant 17 h » reconnu, poste jusqu’à 17 h 15', base([T1, P1], lundi(H(9), H(17, 15)), { besoins: [b({ forme: 'finir_avant', heure: H(17) })] }), 'bloquant');
    cas('I6', 'equipe.indisponibilite', 'Indisponibilité reconnue mais encore en attente de décision', base([T1, P1], lundi(H(9), H(12)), { besoins: [b({ decision: 'en_attente' })] }), 'rien');
    cas('I7', 'souhait', 'Préférence prioritaire « indisponible lundi », poste lundi', base([T1, P1], lundi(H(9), H(12)), { besoins: [b({ statut: 'prioritaire' })] }), 'info');
    cas('I8', 'equipe.indisponibilite', 'Indisponibilité reconnue une semaine sur deux (référence : semaine du 11 janvier), poste le lundi 18 (semaine impaire)', base([T1, P1], [poste('p1', LUN2, H(9), H(12))], { besoins: [b({ frequence: 2, semaineRef: W })] }), 'rien', undefined, LUN2);
    cas('I9', 'equipe.indisponibilite', 'Même besoin, poste le lundi 25 janvier (semaine paire)', base([T1, P1], [poste('p1', '2027-01-25', H(9), H(12))], { besoins: [b({ frequence: 2, semaineRef: W })] }), 'bloquant', undefined, '2027-01-25');
    // Repos posé par le titulaire : le validateur ne le contrôle pas.
    const l = validateWeek(base([T1, P1], lundi(H(9), H(12)), { repos: [{ personId: 'p1', date: LUN }] }), W).filter((i) => i.personId === 'p1');
    constat(F, { id: 'RP1', regle: '(repos posé)', scenario: 'Poste le lundi alors qu’un repos est posé pour ce jour (donnée)', attendu: 'signalé', obtenu: dire(l), ok: l.length > 0, note: 'Dans l’interface, poser un poste sur un repos efface le repos (saveShift) : l’incohérence ne peut venir que d’un calcul qui ne le respecte pas.' });
  });

  it('samedis libres par mois', () => {
    const samedisJanvier = ['2027-01-02', '2027-01-09', '2027-01-16', '2027-01-23', '2027-01-30'];
    cas('S1', 'equipe.samedisLibres', 'Préparateur posté les 5 samedis de janvier 2027', base([T1, P1], samedisJanvier.map((d) => poste('p1', d, H(9), H(14)))), 'alerte');
    cas('S2', 'equipe.samedisLibres', 'Préparateur posté 4 samedis sur 5 (le 30 libre)', base([T1, P1], samedisJanvier.slice(0, 4).map((d) => poste('p1', d, H(9), H(14)))), 'rien');
  });

  it('contrôles d’équipe : temps partiel minimal, nombre de pharmaciens', () => {
    const e = (pers: typeof A1[], ca: number | null) => {
      const d = base(pers);
      return validateEquipe({ ...d, officine: { ...d.officine, caAnnuelHT: ca } });
    };
    const tp = (h: number, q: typeof A1['qualification']) => e([personne('x', q, h)], null).filter((i) => i.regle === 'contrat.partielMin');
    constat(F, { id: 'TP1', regle: 'contrat.partielMin', scenario: 'Préparateur à 15 h', attendu: 'alerte', obtenu: dire(tp(15, 'preparateur')), ok: tp(15, 'preparateur').length === 1 });
    constat(F, { id: 'TP2', regle: 'contrat.partielMin', scenario: 'Préparateur à 16 h pile', attendu: 'non signalé', obtenu: dire(tp(16, 'preparateur')), ok: tp(16, 'preparateur').length === 0 });
    constat(F, { id: 'TP3', regle: 'contrat.partielMin', scenario: 'Étudiant à 10 h ; apprenti à 10 h', attendu: 'non signalés (dérogations)', obtenu: `${dire(tp(10, 'etudiant'))} ; ${dire(tp(10, 'apprenti'))}`, ok: tp(10, 'etudiant').length === 0 && tp(10, 'apprenti').length === 0 });
    constat(F, { id: 'TP4', regle: 'contrat.partielMin', scenario: 'Animatrice à 21 h (exemple : Sarah)', attendu: 'à vérifier : 21 h < 24 h (durée minimale légale L3123-27, sauf accord de branche)', obtenu: dire(tp(21, 'animateur')), ok: true, note: 'Seuil de 16 h « source secondaire » : à confirmer sur l’accord de branche.' });
    const adj = (ca: number) => e([personne('a', 'adjoint', 35), personne('b', 'adjoint', 28)], ca).filter((i) => i.regle === 'pharmacie.adjoints');
    constat(F, { id: 'AD1', regle: 'pharmacie.adjoints', scenario: 'CA 2 600 000 €, adjoints 35 h + 28 h (1,8 ETP)', attendu: 'alerte : 2 ETP attendus (2 tranches révolues de 1,3 M€)', obtenu: dire(adj(2_600_000)), ok: adj(2_600_000).length === 1 && adj(2_600_000)[0].message.includes('pour 2 attendu') });
    constat(F, { id: 'AD2', regle: 'pharmacie.adjoints', scenario: 'CA 2 599 999 € (1 seule tranche révolue)', attendu: 'non signalé (1 ETP attendu, 1,8 présents)', obtenu: dire(adj(2_599_999)), ok: adj(2_599_999).length === 0 });
  });

  it('délais : garde (15 jours), temps partiel (7 jours ouvrés), remplacement (7 jours)', () => {
    const g = (communique: string, exceptionnel = false): Garde => ({ id: 'g', date: '2027-01-18', start: H(20), end: H(8), type: 'volets_fermes', personId: 'a1', interventions: [], communiqueLe: `${communique}T10:00:00.000Z`, exceptionnel });
    const d1 = delaiGarde({ regles: REGLES_INITIALES }, g('2027-01-03'), A1, '2027-01-03');
    const d2 = delaiGarde({ regles: REGLES_INITIALES }, g('2027-01-04'), A1, '2027-01-04');
    constat(F, { id: 'DG1', regle: 'garde.delai', scenario: 'Garde du lundi 18 janvier communiquée le 3 (15 jours avant)', attendu: 'délai tenu', obtenu: `${d1.ok} - ${d1.message}`, ok: d1.ok });
    constat(F, { id: 'DG2', regle: 'garde.delai', scenario: 'Communiquée le 4 (14 jours avant)', attendu: 'délai non tenu', obtenu: `${d2.ok} - ${d2.message}`, ok: !d2.ok });
    const d3 = delaiGarde({ regles: REGLES_INITIALES }, g('2027-01-15', true), A1, '2027-01-15');
    const d4 = delaiGarde({ regles: REGLES_INITIALES }, g('2027-01-16', true), A1, '2027-01-16');
    constat(F, { id: 'DG3', regle: 'garde.delai', scenario: 'Circonstances exceptionnelles : communiquée vendredi 15 pour lundi 18 (samedi seul jour ouvrable strictement entre les deux)', attendu: 'à vérifier : 1 ou 2 jours ouvrables selon que l’on compte le jour de la garde', obtenu: `${d3.ok} - ${d3.message}`, ok: true, note: 'joursOuvrablesEntre compte le jour de la garde lui-même.' });
    constat(F, { id: 'DG4', regle: 'garde.delai', scenario: 'Exceptionnel, communiquée samedi 16 pour lundi 18', attendu: 'délai non tenu', obtenu: `${d4.ok} - ${d4.message}`, ok: !d4.ok });
    const dt = delaiGarde({ regles: REGLES_INITIALES }, g('2027-01-17'), T1, '2027-01-17');
    constat(F, { id: 'DG5', regle: 'garde.delai', scenario: 'Garde de la titulaire communiquée la veille', attendu: 'aucun délai (non salariée)', obtenu: `${dt.ok} - ${dt.message}`, ok: dt.ok });

    const sem = base([T1, P2], [poste('p2', LUN, H(9), H(16), { pauseStart: H(12), pauseEnd: H(13) }), poste('p2', MER, H(9), H(16), { pauseStart: H(12), pauseEnd: H(13) })]);
    const c1 = controlePublication(sem, W, '2026-12-30').delais;
    const c2 = controlePublication(sem, W, '2026-12-31').delais;
    constat(F, { id: 'DT1', regle: 'delai.tempsPartiel', scenario: 'Première publication le mercredi 30 décembre 2026 pour la semaine du 11 janvier (7 jours ouvrés : 31/12, 4-8/01, 11/01 ; le 1er janvier férié exclu)', attendu: 'délai tenu', obtenu: c1.map((x) => x.message).join(' / ') || 'aucun délai signalé', ok: c1.length === 0 });
    constat(F, { id: 'DT2', regle: 'delai.tempsPartiel', scenario: 'Première publication le jeudi 31 décembre (6 jours ouvrés)', attendu: 'délai signalé pour le temps partiel', obtenu: c2.map((x) => x.message).join(' / ') || 'aucun délai signalé', ok: c2.length === 1 });
    const publiee: AppData = { ...sem, semaines: { [W]: { statut: 'publie', snapshot: sem.shifts.map((x) => ({ ...x })) } } };
    const modif: AppData = { ...publiee, shifts: publiee.shifts.map((x) => (x.date === MER ? { ...x, end: H(15) } : x)) };
    const c3 = controlePublication(modif, W, LUN).delais;
    constat(F, { id: 'DT3', regle: 'delai.tempsPartiel', scenario: 'Semaine publiée ; le lundi, le poste du mercredi d’un temps partiel est raccourci', attendu: 'délai signalé (2 jours ouvrés)', obtenu: c3.map((x) => x.message).join(' / ') || 'aucun', ok: c3.length === 1 });
    const temps_plein = base([T1, P1], [poste('p1', MER, H(9), H(16), { pauseStart: H(12), pauseEnd: H(13) })]);
    const tpPub: AppData = { ...temps_plein, semaines: { [W]: { statut: 'publie', snapshot: temps_plein.shifts.map((x) => ({ ...x })) } }, shifts: temps_plein.shifts.map((x) => ({ ...x, end: H(18) })) };
    const c4 = controlePublication(tpPub, W, MAR);
    constat(F, { id: 'DT4', regle: '(délai de prévenance temps plein)', scenario: 'Temps plein : poste du mercredi allongé de 2 h, publié la veille', attendu: 'à vérifier : délai de prévenance de 7 jours (L3121-47) en cas de modification des horaires', obtenu: `${c4.delais.length} délai signalé ; ${c4.changements.length} changement`, ok: c4.delais.length > 0, note: 'Seuls les temps partiels et les gardes ont un contrôle de délai à la publication ; la règle « delai.remplacement » ne sert qu’aux demandes de remplacement.' });

    const r = { regles: REGLES_INITIALES };
    constat(F, { id: 'DR1', regle: 'delai.remplacement', scenario: 'Demande pour un poste dans 7 jours, puis dans 6 jours', attendu: 'acceptée puis refusée', obtenu: `${peutDemanderRemplacement(r, '2027-01-18', '2027-01-11')} / ${peutDemanderRemplacement(r, '2027-01-17', '2027-01-11')}`, ok: peutDemanderRemplacement(r, '2027-01-18', '2027-01-11') && !peutDemanderRemplacement(r, '2027-01-17', '2027-01-11') });
    const bas = { regles: REGLES_INITIALES.map((x) => (x.id === 'delai.remplacement' ? { ...x, valeur: 1 } : x)) };
    constat(F, { id: 'DR2', regle: 'delai.remplacement', scenario: 'Fiche abaissée à 1 jour', attendu: 'plancher de 3 jours', obtenu: String(delaiRemplacement(bas)), ok: delaiRemplacement(bas) === 3 });
  });

  it('jeunes travailleurs (apprentie, étudiant)', () => {
    // Apprentie : 9 h 30 dans la journée, 40 h dans la semaine, pause de 1 h 30 après 4 h. Si elle a moins de 18 ans : 8 h/j, 35 h/sem., 30 min de pause dès 4 h 30, 12 h de repos.
    const s = [LUN, MAR, MER, JEU].map((d) => poste('manon', d, H(8, 30), H(19, 30), { pauseStart: H(12, 30), pauseEnd: H(14) })).concat(poste('manon', VEN, H(14), H(17, 30)));
    const l = validateWeek(base([T1, MANON], s.concat([LUN, MAR, MER, JEU, VEN].map((d) => couverture(d)))), W).filter((i) => i.personId === 'manon');
    constat(F, { id: 'JT1', regle: '(jeunes travailleurs)', scenario: 'Apprentie planifiée 4 × 9 h 30 + 3 h 30 = 41 h 30, contrat 21 h', attendu: 'au minimum une alerte (contrat dépassé de 20 h 30) ; si mineure, durées maximales de 8 h/j et 35 h/sem. dépassées', obtenu: dire(l), ok: l.length > 0, note: 'Aucune date de naissance dans la fiche (types.ts), aucune règle « moins de 18 ans » ; le dépassement du contrat n’est jamais signalé par le validateur (seul le plafond de 42 h l’est).' });
  });
});
