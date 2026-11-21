import { describe, it } from 'vitest';
import { rmSync } from 'node:fs';
import { addDays, decalageParis, dureeReelle, ferie, isoWeek, joursFeries, joursOuvrablesEntre, joursOuvresEntre, mondayOf, weekday, fmtSemaine, fmtDateLong } from '/home/user/releve-planning/src/domain/time';
import { etatPublication, semainesDuMois as semainesEcheance, reglagePublication } from '/home/user/releve-planning/src/engine/echeance';
import { semainesDuMois as semainesPaie } from '/home/user/releve-planning/src/engine/payroll';
import { datesDuMois, limiteSouhaits, moisACollecter } from '/home/user/releve-planning/src/engine/souhaits';
import { segmentsGarde } from '/home/user/releve-planning/src/engine/gardes';
import { seed } from '/home/user/releve-planning/src/data/seed';
import { chiffresOfficine, remarquesOfficine } from '/home/user/releve-planning/src/engine/officine';
import { DOSSIER, H, constat } from './aide';

rmSync(`${DOSSIER}/dates.jsonl`, { force: true });
const F = 'dates';
const eq = (id: string, regle: string, scenario: string, attendu: unknown, obtenu: unknown, note?: string) =>
  constat(F, { id, regle, scenario, attendu: JSON.stringify(attendu), obtenu: JSON.stringify(obtenu), ok: JSON.stringify(attendu) === JSON.stringify(obtenu), note });

describe('5. Dates', () => {
  it('semaines ISO et fin d’année', () => {
    const cas: [string, number][] = [['2026-01-01', 1], ['2026-12-31', 53], ['2027-01-01', 53], ['2027-01-03', 53], ['2027-01-04', 1], ['2024-12-30', 1], ['2020-12-31', 53], ['2021-01-03', 53], ['2028-01-02', 52], ['2026-11-20', 47]];
    eq('ISO1', 'time.isoWeek', cas.map((c) => c[0]).join(', '), cas.map((c) => c[1]), cas.map((c) => isoWeek(c[0])));
    eq('ISO2', 'time.mondayOf', 'lundi du vendredi 1er janv. 2027 et du dimanche 3 janv. 2027', ['2026-12-28', '2026-12-28'], [mondayOf('2027-01-01'), mondayOf('2027-01-03')]);
    eq('ISO3', 'time.fmtSemaine', 'semaine du 28 déc. 2026 (à cheval sur deux années)', '28 décembre – 3 janvier 2027', fmtSemaine('2026-12-28'), 'Seule l’année de fin est écrite.');
  });

  it('29 février et longueur des mois', () => {
    eq('B1', 'time.addDays', '28 févr. 2028 + 1 ; 28 févr. 2027 + 1 ; 29 févr. 2028 + 365', ['2028-02-29', '2027-03-01', '2029-02-28'], [addDays('2028-02-28', 1), addDays('2027-02-28', 1), addDays('2028-02-29', 365)]);
    eq('B2', 'time.weekday', 'mardi 29 février 2028', 1, weekday('2028-02-29'));
    eq('B3', 'souhaits.datesDuMois', 'février 2028, février 2027, février 2100 (non bissextile)', [29, 28, 28], [datesDuMois('2028-02').length, datesDuMois('2027-02').length, datesDuMois('2100-02').length]);
    eq('B4', 'souhaits.limiteSouhaits', 'Préférences de mars 2028 avec une limite au 29 (le réglage va de 1 à 28) ; au 31 pour mars 2027', ['2028-02-29', '2027-02-28'], [limiteSouhaits({ souhaitsLimite: 29 }, '2028-03'), limiteSouhaits({ souhaitsLimite: 31 }, '2027-03')]);
    eq('B5', 'time.fmtDateLong', 'mardi 29 février 2028', 'mardi 29 février 2028', fmtDateLong('2028-02-29'));
  });

  it('jours fériés et fêtes mobiles', () => {
    const attendus: Record<number, Record<string, string>> = {
      2025: { 'Lundi de Pâques': '2025-04-21', Ascension: '2025-05-29', 'Lundi de Pentecôte': '2025-06-09' },
      2026: { 'Lundi de Pâques': '2026-04-06', Ascension: '2026-05-14', 'Lundi de Pentecôte': '2026-05-25' },
      2027: { 'Lundi de Pâques': '2027-03-29', Ascension: '2027-05-06', 'Lundi de Pentecôte': '2027-05-17' },
      2028: { 'Lundi de Pâques': '2028-04-17', Ascension: '2028-05-25', 'Lundi de Pentecôte': '2028-06-05' },
      2038: { 'Lundi de Pâques': '2038-04-26', Ascension: '2038-06-03', 'Lundi de Pentecôte': '2038-06-14' },
    };
    for (const [an, att] of Object.entries(attendus)) {
      const m = joursFeries(Number(an));
      const obtenu: Record<string, string> = {};
      for (const [d, n] of m) if (n in att) obtenu[n] = d;
      eq(`JF-${an}`, 'time.joursFeries', `fêtes mobiles ${an}`, att, obtenu);
    }
    eq('JF-n', 'time.joursFeries', 'nombre de jours fériés légaux (Code du travail, L3133-1 : 11)', 11, joursFeries(2027).size);
    eq('JF-am', 'time.ferie', 'Alsace-Moselle : Vendredi saint 26 mars 2027, 26 décembre 2026', 'à vérifier (non gérés : « France métropolitaine »)', [ferie('2027-03-26') ?? 'non férié', ferie('2026-12-26') ?? 'non férié'], 'Pas de réglage de région : une officine d’Alsace-Moselle ou d’outre-mer n’a pas ses jours fériés.');
    eq('JF-ov', 'time.joursOuvrablesEntre', 'jours ouvrables du jeu. 24 déc. 2026 (exclu) au lun. 28 déc. (inclus) : 26 sam. et 28 lun. (25 férié, 27 dimanche)', 2, joursOuvrablesEntre('2026-12-24', '2026-12-28'));
    eq('JF-oe', 'time.joursOuvresEntre', 'jours ouvrés du jeu. 30 avr. 2026 au ven. 8 mai 2026 : 4, 5, 6, 7 mai (1er et 8 fériés)', 4, joursOuvresEntre('2026-04-30', '2026-05-08'));
  });

  it('changement d’heure', () => {
    eq('DST1', 'time.decalageParis', '29 mars 2026 à 1 h 59, 3 h ; 25 oct. 2026 à 1 h 59, 2 h 30 (heure ambiguë), 3 h', [60, 120, 120, 120, 60], [decalageParis('2026-03-29', 119), decalageParis('2026-03-29', 180), decalageParis('2026-10-25', 119), decalageParis('2026-10-25', 150), decalageParis('2026-10-25', 180)]);
    eq('DST2', 'time.dureeReelle', 'nuits du 28 au 29 mars 2026 et du 24 au 25 oct. 2026, 20 h - 8 h ; nuit ordinaire', [660, 780, 720], [dureeReelle('2026-03-28', H(20), '2026-03-29', H(8)), dureeReelle('2026-10-24', H(20), '2026-10-25', H(8)), dureeReelle('2026-11-07', H(20), '2026-11-08', H(8))]);
    eq('DST3', 'gardes.segmentsGarde', 'garde de 24 h du dimanche 25 oct. 2026 à 9 h au lundi 9 h (heure d’hiver)', [900, 540], segmentsGarde({ date: '2026-10-25', start: H(9), end: H(9) }).map((x) => x.minutes), 'Le 25 octobre de 9 h à minuit : 15 h ; heure d’hiver déjà en place, aucun décalage.');
    eq('DST4', 'gardes.segmentsGarde', 'garde de 24 h du samedi 24 oct. 2026 à 9 h au dimanche 9 h', [900, 600], segmentsGarde({ date: '2026-10-24', start: H(9), end: H(9) }).map((x) => x.minutes));
  });

  it('échéance de publication et date limite des préférences', () => {
    const o = seed('2026-11-20', -99).officine;
    const lignes: string[] = [];
    let incoherent = 0;
    for (const today of ['2026-11-01', '2026-12-01', '2027-01-15', '2027-02-01', '2027-07-01']) {
      const e = etatPublication({ ...seed('2026-11-20', -99), officine: o }, today);
      const lim = limiteSouhaits(o, e.mois);
      if (lim > e.echeance) incoherent++;
      lignes.push(`${e.mois} : préférences jusqu’au ${lim}, publication au plus tard le ${e.echeance} (rappel dès le ${e.rappelLe})`);
    }
    const r = reglagePublication(o);
    constat(F, { id: 'ECH1', regle: 'echeance.etatPublication / souhaits.limiteSouhaits', scenario: `Réglages par défaut : publication ${r.delai} jours avant le 1er, préférences jusqu’au ${o.souhaitsLimite ?? 20} du mois précédent`, attendu: 'la collecte des préférences se ferme avant l’échéance de publication', obtenu: lignes.join(' ; '), ok: incoherent === 0, note: `${incoherent} mois sur 5 : la collecte se ferme APRÈS la date limite de publication. Aucun contrôle croisé entre les deux réglages (Officine.tsx).` });
    // Le relais de Solvéa à l'échéance prépare les semaines vides d'après les habitudes : les préférences encore attendues sont-elles lues ?
    const today = '2026-11-18';
    const e = etatPublication(seed('2026-11-20', 2), today);
    constat(F, { id: 'ECH2', regle: 'echeance.etatPublication', scenario: `Le ${today} (exemple établi)`, attendu: 'état cohérent avec la collecte encore ouverte jusqu’au 20', obtenu: `mois ${e.mois}, échéance ${e.echeance}, état « ${e.etat} », ${e.restantes} semaine(s) à publier, ${e.vides} vide(s) ; collecte des préférences de ${moisACollecter(o, today)} ouverte jusqu’au ${limiteSouhaits(o, moisACollecter(o, today))}`, ok: !(e.etat === 'depasse' && limiteSouhaits(o, e.mois) >= today) });
    eq('ECH3', 'echeance.semainesDuMois / payroll.semainesDuMois', 'les deux fonctions homonymes, décembre 2026 et février 2027', [semainesEcheance('2026-12'), semainesEcheance('2027-02')], [semainesPaie('2026-12'), semainesPaie('2027-02')], 'Deux implémentations de la même fonction (répétition), mêmes résultats.');
    const dec = etatPublication(seed('2026-11-20', 2), '2026-12-10');
    constat(F, { id: 'ECH4', regle: 'echeance.etatPublication', scenario: 'Le 10 déc. 2026 : publication de janvier 2027', attendu: 'mois 2027-01, échéance 18 déc., semaines du 28 déc. au 25 janv.', obtenu: `${dec.mois}, ${dec.echeance}, ${dec.semaines.map((x) => x.monday).join(' ')}`, ok: dec.mois === '2027-01' && dec.echeance === '2026-12-18' && dec.semaines[0].monday === '2026-12-28' });
  });

  it('officine en chiffres', () => {
    eq('OF1', 'officine.chiffresOfficine', 'surface 180, vente 110, réserve 45, 3 caisses, 4 comptoirs, 1 espace, robot', ['180 m² au total', '110 m² de surface de vente', '45 m² de réserve et de préparatoire', '3 caisses', '4 postes de comptoir', '1 espace de confidentialité', 'un robot de dispensation'], chiffresOfficine({ surface: 180, infos: { surfaceVente: 110, reserve: 45, caisses: 3, comptoirs: 4, confidentialite: 1, robot: true } }));
    eq('OF2', 'officine.remarquesOfficine', 'vente 200 > total 180 ; 5 caisses pour 4 comptoirs ; effectif 3 pour 2 comptoirs', 3, remarquesOfficine({ surface: 180, infos: { surfaceVente: 200, caisses: 5, comptoirs: 2 }, effectifs: [{ jours: [0], start: 0, end: 60, minEquipe: 3 }] }).length);
    eq('OF3', 'officine.remarquesOfficine', 'surface 0 et valeurs négatives (−10 m² de vente)', 'au moins une remarque', remarquesOfficine({ surface: 100, infos: { surfaceVente: -10, caisses: -1 }, effectifs: [] }).length ? 'au moins une remarque' : 'aucune remarque', 'Aucune remarque sur des valeurs négatives : la saisie de l’écran est la seule barrière.');
  });
});
