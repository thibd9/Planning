import { describe, it } from 'vitest';
import { rmSync } from 'node:fs';
import { seed } from '/home/user/releve-planning/src/data/seed';
import { soldeHeures, contratSemaine, proposerRegularisations } from '/home/user/releve-planning/src/engine/heures';
import { equite, ecartEquite } from '/home/user/releve-planning/src/engine/equity';
import { statsEquipe } from '/home/user/releve-planning/src/engine/stats';
import { quotaAdjoints } from '/home/user/releve-planning/src/engine/validate';
import { decompteSemaine, ficheNavette, coutSemaine } from '/home/user/releve-planning/src/engine/payroll';
import { variablesGarde } from '/home/user/releve-planning/src/engine/gardes';
import { suiviDe } from '/home/user/releve-planning/src/engine/suivi';
import { planifieMois, heuresMois } from '/home/user/releve-planning/src/engine/souhaits';
import { estFermeture } from '/home/user/releve-planning/src/engine/core';
import { addDays, mondayOf, weekday, ferie, weekDates } from '/home/user/releve-planning/src/domain/time';
import { REGLES_INITIALES } from '/home/user/releve-planning/src/domain/rules';
import type { AppData, Garde, Person, Shift } from '/home/user/releve-planning/src/domain/types';
import { DOSSIER, H, constat, personne } from './aide';

rmSync(`${DOSSIER}/compteurs.jsonl`, { force: true });
const F = 'compteurs';
const TODAY = '2026-11-20';
const LUNDI = mondayOf(TODAY);
const data = seed(TODAY, 2);
const P = (id: string): Person => data.personnes.find((p) => p.id === id)!;
/** Minutes d'un poste, recalculées à la main : fin - début - pause. */
const min = (s: Shift): number => s.end - s.start - (s.pauseStart !== undefined && s.pauseEnd !== undefined ? s.pauseEnd - s.pauseStart : 0);
const h = (m: number): string => `${(m / 60).toFixed(2)} h`;

describe('3. Compteurs recalculés à la main', () => {
  it('compteur d’heures (solde)', () => {
    for (const id of ['p_camille', 'p_karim', 'p_ines', 'p_manon']) {
      const p = P(id);
      const publiees = Object.entries(data.semaines).filter(([m, s]) => s.statut === 'publie' && m <= LUNDI).map(([m]) => m);
      let contrat = 0;
      let realise = 0;
      for (const m of publiees) {
        const absents = [0, 1, 2, 3, 4].filter((i) => data.absences.some((a) => a.personId === id && a.statut === 'approuvee' && a.from <= addDays(m, i) && addDays(m, i) <= a.to)).length;
        contrat += Math.round(p.heuresHebdo * 60 * (1 - absents / 5));
        realise += (data.semaines[m].snapshot ?? []).filter((s) => s.personId === id).reduce((t, s) => t + min(s), 0);
      }
      const s = soldeHeures(data, p, TODAY);
      constat(F, { id: `SH-${id}`, regle: 'heures.soldeHeures', scenario: `${p.prenom} (${p.heuresHebdo} h), ${publiees.length} semaines publiées jusqu’à la semaine en cours`, attendu: `réalisé ${h(realise)} (versions publiées), contrat ${h(contrat)}, solde ${h(realise - contrat)}`, obtenu: `réalisé ${h(s.realise)}, contrat ${h(s.contrat)}, solde ${h(s.solde)}`, ok: s.realise === realise && s.contrat === contrat });
    }
    // Semaine du 9 novembre (mercredi 11, Armistice, officine fermée) : le contrat n'est pas réduit.
    const m = '2026-11-09';
    const lignes = data.personnes.filter((p) => p.salarie && !p.externe).map((p) => {
      const fait = (data.semaines[m].snapshot ?? []).filter((s) => s.personId === p.id).reduce((t, s) => t + min(s), 0);
      return { p, fait, contrat: contratSemaine(data, p, m) };
    });
    const pleins = lignes.filter((l) => l.p.heuresHebdo >= 35);
    constat(F, { id: 'SH-ferie', regle: 'heures.contratSemaine', scenario: 'Semaine du 9 nov. 2026 (mercredi 11 férié, officine fermée), temps pleins', attendu: 'contrat réduit d’un jour férié chômé (7 h) ou heures non récupérées : aucun « retard » créé par le férié', obtenu: pleins.map((l) => `${l.p.prenom} ${h(l.fait)} pour un contrat compté ${h(l.contrat)}`).join(', '), ok: pleins.every((l) => l.contrat <= 28 * 60), note: 'contratSemaine() ne déduit que les absences approuvées (1/5 par jour ouvré) ; le planning de l’exemple a fait travailler 33 à 35,5 h sur 4 jours ouvrés + samedi.' });
    // Une retouche de brouillon sur une semaine publiée compte-t-elle déjà dans le compteur ?
    const nicolas = P('p_camille');
    const un = data.shifts.find((s) => s.personId === 'p_camille' && s.date >= LUNDI && s.date <= addDays(LUNDI, 6))!;
    const brouillon: AppData = { ...data, shifts: data.shifts.map((s) => (s.id === un.id ? { ...s, end: s.end + 120 } : s)) };
    const a = soldeHeures(data, nicolas, TODAY).solde;
    const b = soldeHeures(brouillon, nicolas, TODAY).solde;
    constat(F, { id: 'SH-brouillon', regle: 'heures.soldeHeures', scenario: 'Nicolas : poste de la semaine publiée allongé de 2 h en brouillon (non publié)', attendu: 'compteur inchangé tant que la modification n’est pas publiée (« ce qui a été planifié et publié »)', obtenu: `solde ${h(a)} → ${h(b)}`, ok: a === b, note: 'soldeHeures lit data.shifts (le brouillon), pas la version publiée (snapshot).' });
    // La semaine en cours compte en entier, même les jours pas encore passés.
    const futur = data.shifts.filter((s) => s.personId === 'p_camille' && s.date > TODAY && s.date <= addDays(LUNDI, 6)).reduce((t, s) => t + min(s), 0);
    constat(F, { id: 'SH-encours', regle: 'heures.soldeHeures', scenario: `Nicolas, aujourd’hui vendredi ${TODAY} : postes de samedi déjà comptés`, attendu: 'à vérifier : la semaine en cours est comptée en entier (prévu, pas réalisé)', obtenu: `${h(futur)} de postes futurs inclus dans « réalisé »`, ok: true });
    const prop = proposerRegularisations(data, TODAY);
    constat(F, { id: 'SH-regul', regle: 'heures.proposerRegularisations', scenario: 'Propositions automatiques sur l’exemple', attendu: 'chaque solde d’au moins 1 h résorbé par demi-heures, plafonné à 8 h', obtenu: prop.map((r) => `${P(r.personId).prenom} ${r.minutes} min (${r.type}, sem. ${r.semaine})`).join(' ; ') || 'aucune', ok: prop.every((r) => r.minutes % 30 === 0 && Math.abs(r.minutes) <= 480) });
  });

  it('heures d’un mois : trois calculs', () => {
    const mois = '2026-10';
    for (const id of ['p_camille', 'p_ines']) {
      const p = P(id);
      const main = Object.values(data.semaines).flatMap((s) => s.snapshot ?? []).filter((s) => s.personId === id && s.date.startsWith(mois)).reduce((t, s) => t + min(s), 0);
      const fn = ficheNavette(data, mois).find((l) => l.person.id === id)!;
      const pm = planifieMois(data, p, mois);
      const hm = heuresMois(data, p, mois);
      // Contrat attendu sur le mois : jours ouvrés du mois × contrat / 5 (pas de férié en octobre).
      const ouvres = Array.from({ length: 31 }, (_, i) => `${mois}-${String(i + 1).padStart(2, '0')}`).filter((d) => weekday(d) < 5 && !ferie(d)).length;
      constat(F, { id: `HM-${id}`, regle: 'heures du mois', scenario: `${p.prenom}, octobre 2026 (${ouvres} jours ouvrés)`, attendu: `${h(main)} planifiées dans le mois ; contrat ≈ ${h((p.heuresHebdo * 60 * ouvres) / 5)}`, obtenu: `fiche navette ${fn.heuresMois.toFixed(2)} h ; vue Mois (planifieMois) ${h(pm.minutes)} pour ${h(pm.cible)} ; heuresMois() ${h(hm.minutes)} pour ${h(hm.cible)} (semaines entières, dont des jours de septembre et novembre)`, ok: Math.abs(fn.heuresMois * 60 - main) < 1 && pm.minutes === main });
      const supp = fn.supp25 + fn.supp50 + fn.complementaires;
      const semaines = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].filter((m) => m.startsWith(mois));
      const attendu = semaines.reduce((t, m) => {
        const mi = data.shifts.filter((s) => s.personId === id && s.date >= m && s.date <= addDays(m, 6)).reduce((u, s) => u + min(s), 0);
        return t + (p.heuresHebdo >= 35 ? Math.max(0, mi - 35 * 60) : Math.max(0, Math.min(mi, 35 * 60) - p.heuresHebdo * 60) + Math.max(0, mi - 35 * 60));
      }, 0);
      constat(F, { id: `HS-${id}`, regle: 'payroll.ficheNavette', scenario: `${p.prenom}, octobre 2026 : heures complémentaires ou supplémentaires (semaines dont le lundi est en octobre)`, attendu: h(attendu), obtenu: `${supp.toFixed(2)} h (compl. ${fn.complementaires.toFixed(2)}, 25 % ${fn.supp25.toFixed(2)}, 50 % ${fn.supp50.toFixed(2)})`, ok: Math.abs(supp * 60 - attendu) < 1, note: 'La semaine du 28 sept. (lundi en septembre) contient les 1er-4 oct. : ses heures entrent dans les heures du mois d’octobre mais ses heures supplémentaires dans septembre (choix documenté).' });
    }
    // Les jours d'absence de la fiche navette comptent les dimanches.
    const d2: AppData = { ...data, absences: data.absences.concat({ id: 'x', personId: 'p_thomas', from: '2026-10-05', to: '2026-10-18', type: 'conge', statut: 'approuvee', createdAt: '2026-09-01' }) };
    const jt = ficheNavette(d2, '2026-10').find((l) => l.person.id === 'p_thomas')!.joursAbsence;
    constat(F, { id: 'FN-abs', regle: 'payroll.ficheNavette', scenario: 'Congé de Thomas du lundi 5 au dimanche 18 octobre (2 semaines)', attendu: 'à vérifier : 12 jours ouvrables (lundi-samedi) ou 10 jours ouvrés pour les congés payés', obtenu: JSON.stringify(jt), ok: (jt['Congé'] ?? 0) !== 14, note: 'Les jours calendaires (dimanches compris) sont comptés.' });
  });

  it('équité des samedis', () => {
    const from = addDays(LUNDI, -56);
    const to = addDays(LUNDI, -1);
    const lignes = equite(data, from, to);
    const internes = data.personnes.filter((p) => !p.externe);
    const sam = new Map<string, number>();
    const sem = new Map<string, number>();
    for (const p of internes) {
      const dates = new Set(data.shifts.filter((s) => s.personId === p.id && s.date >= from && s.date <= to && weekday(s.date) === 5).map((s) => s.date));
      sam.set(p.id, dates.size);
      sem.set(p.id, new Set(data.shifts.filter((s) => s.personId === p.id && s.date >= from && s.date <= to).map((s) => mondayOf(s.date))).size);
    }
    const total = [...sam.values()].reduce((a, b) => a + b, 0);
    const poids = (p: Person) => p.heuresHebdo * Math.max(1, sem.get(p.id)!);
    const somme = internes.reduce((t, p) => t + poids(p), 0);
    let ok = true;
    const det: string[] = [];
    for (const p of internes) {
      const l = lignes.find((x) => x.personId === p.id)!;
      const att = (total * poids(p)) / somme;
      if (l.reel.samedis !== sam.get(p.id) || Math.abs((l.attendu.samedis ?? -1) - att) > 1e-9) ok = false;
      det.push(`${p.prenom} ${l.reel.samedis}/${(l.attendu.samedis ?? 0).toFixed(2)}`);
    }
    constat(F, { id: 'EQ-sam', regle: 'equity.equite', scenario: '8 semaines avant la semaine en cours : samedis réels et attendus (prorata heures × semaines travaillées)', attendu: 'mêmes valeurs qu’un recomptage à la main', obtenu: det.join(', ') + ` ; écart type ${ecartEquite(lignes, 'samedis').toFixed(2)}`, ok });
    const ferm = lignes.reduce((t, l) => t + l.reel.fermetures, 0);
    const fermMain = data.shifts.filter((s) => s.date >= from && s.date <= to && weekday(s.date) < 5 && estFermeture(data.officine, s) && internes.some((p) => p.id === s.personId)).length;
    constat(F, { id: 'EQ-ferm', regle: 'equity.equite', scenario: 'Fermetures en semaine, même période', attendu: `${fermMain} (postes du lundi au vendredi finissant à la fermeture)`, obtenu: String(ferm), ok: ferm === fermMain });
    const titu = lignes.filter((l) => P(l.personId).qualification === 'titulaire').map((l) => `${P(l.personId).prenom} attendu ${(l.attendu.samedis ?? 0).toFixed(2)}`);
    constat(F, { id: 'EQ-titu', regle: 'equity.equite', scenario: 'Les titulaires (non salariés) entrent-ils dans le partage des samedis ?', attendu: 'à vérifier : choix de l’officine', obtenu: `oui, au prorata de leur « objectif indicatif » : ${titu.join(', ')}`, ok: true });
  });

  it('ETP et nombre de pharmaciens', () => {
    const st = statsEquipe(data, TODAY);
    const main = data.personnes.filter((p) => !p.externe).reduce((t, p) => t + Math.min(1, p.heuresHebdo / 35), 0);
    constat(F, { id: 'ETP1', regle: 'stats.composition.etp', scenario: 'ETP de l’équipe de l’exemple (11 personnes internes)', attendu: `${(Math.round(main * 100) / 100).toFixed(2)} (somme des heures/35 plafonnées à 1)`, obtenu: String(st.composition.etp), ok: Math.abs(st.composition.etp - Math.round(main * 100) / 100) < 1e-9, note: 'Les titulaires non salariés (objectif indicatif 42 h et 24 h) et l’apprentie sont comptés ; à vérifier selon l’usage voulu (le Code du travail exclut les apprentis du calcul des effectifs).' });
    const d39: AppData = { ...data, personnes: data.personnes.map((p) => (p.id === 'p_karim' ? { ...p, heuresHebdo: 39 } : p)) };
    const s39 = statsEquipe(d39, TODAY).composition.parFonction.find((f) => f.qualification === 'adjoint')!.etp;
    const q39 = quotaAdjoints(d39)!.etpActuel;
    constat(F, { id: 'ETP2', regle: 'stats vs pharmacie.adjoints', scenario: 'Igor passé à 39 h : ETP des pharmaciens adjoints', attendu: 'la même valeur dans les statistiques et dans le contrôle du nombre de pharmaciens', obtenu: `statistiques ${s39} ; contrôle ${q39}`, ok: s39 === q39, note: 'stats plafonne chaque personne à 1 ETP ; quotaAdjoints ne plafonne pas.' });
  });

  it('coût et majorations', () => {
    const p39 = personne('c39', 'preparateur', 39, { tauxHoraire: 10 });
    const d = decompteSemaine({ regles: REGLES_INITIALES }, p39, 39 * 60);
    constat(F, { id: 'PAY1', regle: 'payroll.decompteSemaine', scenario: 'Contrat de 39 h, 39 h planifiées, 10 €/h', attendu: '35 h × 10 + 4 h × 12,50 = 400 €', obtenu: `${d.cout} € (supp25 ${d.supp25 / 60} h, au-delà du contrat ${d.auDela / 60} h)`, ok: Math.abs((d.cout ?? 0) - 400) < 0.01, note: 'cout = taux × (contrat + heures majorées) : les 4 h de 36 à 39 sont payées deux fois (dans le contrat et dans la majoration).' });
    const p35 = personne('c35', 'preparateur', 35, { tauxHoraire: 10 });
    const d2 = decompteSemaine({ regles: REGLES_INITIALES }, p35, 44 * 60);
    constat(F, { id: 'PAY2', regle: 'payroll.decompteSemaine', scenario: 'Contrat de 35 h, 44 h planifiées', attendu: '350 + 8 × 12,50 + 1 × 15 = 465 €', obtenu: `${d2.cout} € (25 % : ${d2.supp25 / 60} h, 50 % : ${d2.supp50 / 60} h)`, ok: Math.abs((d2.cout ?? 0) - 465) < 0.01 });
    const p24 = personne('c24', 'preparateur', 24, { tauxHoraire: 10 });
    const d3 = decompteSemaine({ regles: REGLES_INITIALES }, p24, 30 * 60);
    constat(F, { id: 'PAY3', regle: 'payroll.decompteSemaine', scenario: 'Temps partiel 24 h, 30 h planifiées', attendu: '240 + 2,4 h × 11 + 3,6 h × 12,50 = 311,40 €', obtenu: `${d3.cout?.toFixed(2)} € (complémentaires ${d3.complementaires / 60} h)`, ok: Math.abs((d3.cout ?? 0) - 311.4) < 0.01 });
    const d4 = decompteSemaine({ regles: REGLES_INITIALES }, p35, 30 * 60);
    constat(F, { id: 'PAY4', regle: 'payroll.decompteSemaine', scenario: 'Contrat de 35 h, 30 h planifiées', attendu: '350 € (le contrat reste dû)', obtenu: `${d4.cout} €`, ok: d4.cout === 350 });
    const c = coutSemaine(data, '2026-11-23');
    constat(F, { id: 'PAY5', regle: 'payroll.coutSemaine', scenario: 'Coût estimé de la semaine du 23 nov. (taux de l’exemple)', attendu: 'somme des coûts individuels', obtenu: `${Math.round(c)} €`, ok: c > 0 });
  });

  it('indemnités de garde', () => {
    const igor = P('p_karim');
    const lea = P('p_lea');
    const g = (x: Partial<Garde>): Garde => ({ id: 'g', date: '2026-12-01', start: H(20), end: H(8), type: 'volets_fermes', personId: 'p_karim', interventions: [], ...x });
    const v = (x: Garde, d: AppData = data) => variablesGarde(d, x);
    const dire = (r: ReturnType<typeof variablesGarde>) => r.variables.map((x) => `${x.code} ${x.quantite} ${x.unite}${x.montant !== null ? ` = ${x.montant.toFixed(2)} €` : ''} [${x.mois}]`).join(' ; ');
    const r1 = v(g({}));
    constat(F, { id: 'GA1', regle: 'garde.equivalence', scenario: `Garde volets fermés mardi 1er déc. 20 h - mercredi 8 h, Igor (35 h, ${igor.tauxHoraire} €/h)`, attendu: '12 h × 25 % = 3 h d’équivalence = 72 €', obtenu: dire(r1), ok: r1.variables.some((x) => x.code === 'GARDE_VF_EQUIV' && x.quantite === 3 && x.montant === 72) });
    const r2 = v(g({ personId: 'p_lea' }));
    constat(F, { id: 'GA2', regle: 'garde.equivalence', scenario: `Même garde, Léa (28 h, temps partiel, ${lea.tauxHoraire} €/h)`, attendu: '12 h payées à 100 % = 282 €', obtenu: dire(r2), ok: r2.variables.some((x) => x.code === 'GARDE_VF_100' && x.quantite === 12 && Math.abs((x.montant ?? 0) - 282) < 0.01) });
    const r3 = v(g({ date: '2026-11-29', start: H(9), end: H(19), type: 'volets_ouverts', personId: 'p_lea' }), { ...data, officine: { ...data.officine, valeurPoint: 4.5 } });
    constat(F, { id: 'GA3', regle: 'garde.dimanche', scenario: 'Dimanche 29 nov. 9 h - 19 h volets ouverts, Léa, point à 4,50 €', attendu: '10 h de travail (235 €) + sujétion 10 × 1,5 = 15 points (67,50 €) + 10 h de repos compensateur', obtenu: dire(r3), ok: r3.variables.some((x) => x.code === 'SUJETION_DIM_FERIE' && x.quantite === 15 && Math.abs((x.montant ?? 0) - 67.5) < 0.01) && r3.variables.some((x) => x.code === 'GARDE_VO' && x.quantite === 10) && r3.variables.some((x) => x.code === 'REPOS_COMPENSATEUR' && x.quantite === 10) });
    const r4 = v(g({ date: '2027-05-01', start: H(9), end: H(19), type: 'volets_ouverts' }));
    constat(F, { id: 'GA4', regle: 'garde.dimanche (1er mai)', scenario: 'Samedi 1er mai 2027 9 h - 19 h volets ouverts, Igor', attendu: 'travail 10 h (240 €) + indemnité égale au salaire (240 €) + repos compensateur 10 h', obtenu: dire(r4), ok: r4.variables.some((x) => x.code === 'GARDE_1ER_MAI' && x.montant === 240) && r4.variables.some((x) => x.code === 'GARDE_VO' && x.montant === 240) && r4.variables.some((x) => x.code === 'REPOS_COMPENSATEUR' && x.quantite === 10) });
    const r5 = v(g({ date: '2026-10-24' }));
    constat(F, { id: 'GA5', regle: 'garde (changement d’heure)', scenario: 'Volets fermés samedi 24 oct. 2026 20 h - dimanche 25 8 h (passage à l’heure d’hiver), Igor', attendu: '13 h réelles : samedi 4 h (équivalence 1 h), dimanche 9 h (sujétion 13,5 points, présence 9 h, repos 9 h)', obtenu: `${dire(r5)} ; durée réelle ${r5.dureeReelle / 60} h`, ok: r5.dureeReelle === 780 && r5.variables.some((x) => x.code === 'GARDE_VF_EQUIV' && x.quantite === 1) && r5.variables.some((x) => x.code === 'SUJETION_DIM_FERIE' && x.quantite === 13.5) });
    const r6 = v(g({ date: '2027-03-27' }));
    constat(F, { id: 'GA6', regle: 'garde (changement d’heure)', scenario: 'Volets fermés samedi 27 mars 2027 20 h - dimanche 28 8 h (passage à l’heure d’été)', attendu: '11 h réelles (4 h samedi + 7 h dimanche)', obtenu: `${dire(r6)} ; durée réelle ${r6.dureeReelle / 60} h`, ok: r6.dureeReelle === 660 });
    const r7 = v(g({ date: '2026-12-31', start: H(19, 30), end: H(8, 30) }));
    constat(F, { id: 'GA7', regle: 'garde (fin d’année)', scenario: 'Volets fermés jeudi 31 déc. 19 h 30 - vendredi 1er janv. 8 h 30, Igor', attendu: 'décembre : 4 h 30 → 1,125 h d’équivalence ; janvier (férié) : 8 h 30 → 12,75 points + 8,5 h de présence ; repos compensateur 8,5 h', obtenu: `${dire(r7)} ; notes : ${r7.notes.join(' / ')}`, ok: r7.variables.some((x) => x.code === 'SUJETION_DIM_FERIE' && x.mois === '2027-01' && x.quantite === 12.75) && r7.variables.some((x) => x.code === 'GARDE_VF_EQUIV' && x.mois === '2026-12') });
    const r8 = v(g({ type: 'astreinte', start: H(19), end: H(9), interventions: [{ id: 'i', offset: 300, duree: 45 }] }));
    constat(F, { id: 'GA8', regle: 'garde.astreinte', scenario: 'Astreinte mardi 19 h - mercredi 9 h, une intervention de 45 min, Igor', attendu: '14 h × 10 % × 24 € = 33,60 € ; intervention 0,75 h × 24 € = 18 €', obtenu: dire(r8), ok: r8.variables.some((x) => x.code === 'ASTREINTE' && Math.abs((x.montant ?? 0) - 33.6) < 0.01) && r8.variables.some((x) => x.code === 'ASTREINTE_INTERVENTION' && x.montant === 18) });
    const r9 = v(g({ date: '2026-11-29', type: 'astreinte', start: H(9), end: H(19) }));
    constat(F, { id: 'GA9', regle: 'garde.astreinte (dimanche)', scenario: 'Astreinte un dimanche 9 h - 19 h', attendu: 'à vérifier : sujétion dimanche ou non', obtenu: dire(r9), ok: true });
    const fn = ficheNavette({ ...data, gardes: [g({ date: '2026-12-31', start: H(19, 30), end: H(8, 30) })] }, '2026-12').find((l) => l.person.id === 'p_karim')!;
    constat(F, { id: 'GA10', regle: 'payroll.ficheNavette', scenario: 'La garde du 31 déc. dans la fiche navette de décembre', attendu: 'seulement la part de décembre, et le repos compensateur', obtenu: fn.variablesGarde.map((x) => `${x.code} ${x.quantite}`).join(', '), ok: !fn.variablesGarde.some((x) => x.code === 'SUJETION_DIM_FERIE') });
  });

  it('suivi de présence', () => {
    const s = suiviDe(data, 'p_karim', TODAY);
    constat(F, { id: 'SU1', regle: 'suivi.suiviDe', scenario: 'Igor : arrêt du mercredi 18 au vendredi 20 nov., aujourd’hui le 20', attendu: '3 jours d’arrêt', obtenu: `${s.arrets} jours`, ok: s.arrets === 3 });
    const j = suiviDe(data, 'p_jules', TODAY);
    constat(F, { id: 'SU2', regle: 'suivi.suiviDe', scenario: 'Jules : retards de 15 et 10 min dans l’exemple', attendu: '2 retards, 25 min', obtenu: `${j.retards} retards, ${j.minutesRetard} min`, ok: j.retards === 2 && j.minutesRetard === 25 });
  });
});
