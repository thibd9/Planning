import { beforeAll, describe, expect, it } from 'vitest';
import { seed, vierge } from '../data/seed';
import { empreinte, espaceDe, estResponsable, identifiantPropose, libelleRole, memeIdentifiant, peutGerer } from '../domain/acces';
import { addDays, dureeReelle, ferie, joursOuvresEntre, mondayOf, subtract, weekday } from '../domain/time';
import type { AppData, Shift } from '../domain/types';
import { minutesSemaine, shiftsSemaine, trousPharmacien } from './core';
import { decisions } from './decisions';
import { diagnosticPrealable } from './diagnose';
import { equite } from './equity';
import { candidatsGarde, delaiGarde, parseCalendrierGardes, poidsGarde, repartirGardes, reposApresGarde, segmentsGarde, serieGardes, variablesGarde } from './gardes';
import { generer, genererVariantes } from './generate';
import { lireBesoin } from './nlp';
import { ficheNavetteCSV } from './payroll';
import { evaluerRemplacement, peutRemplacer } from './remplacement';
import { appliquerPatch, optionsReparation } from './repair';
import { bloquants, validateWeek } from './validate';

const TODAY = '2026-11-16';
const LUNDI = mondayOf(TODAY);
const SUIVANT = addDays(LUNDI, 7);
let data: AppData;

beforeAll(() => {
  data = seed(TODAY);
});

const poste = (personId: string, date: string, start: number, end: number, extra: Partial<Shift> = {}): Shift => ({
  id: `t_${personId}_${date}_${start}`,
  personId,
  date,
  start,
  end,
  activite: 'comptoir',
  origine: 'manuel',
  ...extra,
});

describe('temps', () => {
  it('connaît les jours de la semaine et les jours fériés', () => {
    expect(weekday('2026-11-16')).toBe(0);
    expect(weekday('2026-11-22')).toBe(6);
    expect(ferie('2026-12-25')).toBe('Noël');
    expect(ferie('2027-03-29')).toBe('Lundi de Pâques');
    expect(ferie('2027-05-06')).toBe('Ascension');
    expect(ferie('2026-11-17')).toBeUndefined();
  });
  it('mesure la durée réelle la nuit des changements d’heure', () => {
    expect(dureeReelle('2026-10-24', 20 * 60, '2026-10-25', 8 * 60)).toBe(13 * 60);
    expect(dureeReelle('2027-03-27', 20 * 60, '2027-03-28', 8 * 60)).toBe(11 * 60);
    expect(dureeReelle('2026-11-16', 20 * 60, '2026-11-17', 8 * 60)).toBe(12 * 60);
  });
  it('compte les jours ouvrés et soustrait des intervalles', () => {
    expect(joursOuvresEntre('2026-11-16', '2026-11-23')).toBe(5);
    expect(subtract([{ start: 510, end: 1170 }], [{ start: 750, end: 810 }])).toEqual([
      { start: 510, end: 750 },
      { start: 810, end: 1170 },
    ]);
  });
});

describe('contrôles', () => {
  it('signale la minute sans pharmacien, pause comprise', () => {
    const d: AppData = {
      ...data,
      shifts: [poste('p_helene', SUIVANT, 510, 1170, { pauseStart: 750, pauseEnd: 780 }), poste('p_camille', SUIVANT, 510, 990, { pauseStart: 750, pauseEnd: 810 })],
    };
    expect(trousPharmacien(d, SUIVANT)).toEqual([{ start: 750, end: 780 }]);
    const issue = validateWeek(d, SUIVANT).find((i) => i.regle === 'pharmacie.presence' && i.date === SUIVANT);
    expect(issue?.message).toContain('de 12 h 30 à 13 h, aucun pharmacien');
  });
  it('contrôle le repos de 11 h et la durée quotidienne des salariés, pas du titulaire', () => {
    const mardi = addDays(SUIVANT, 1);
    const d: AppData = {
      ...data,
      shifts: [
        poste('p_karim', SUIVANT, 600, 1320, { pauseStart: 840, pauseEnd: 870 }),
        poste('p_karim', mardi, 420, 780),
        poste('p_helene', SUIVANT, 480, 1320, { pauseStart: 780, pauseEnd: 810 }),
        poste('p_helene', mardi, 420, 1200, { pauseStart: 780, pauseEnd: 810 }),
      ],
    };
    const issues = validateWeek(d, SUIVANT);
    expect(issues.some((i) => i.regle === 'repos.quotidien' && i.personId === 'p_karim')).toBe(true);
    expect(issues.some((i) => i.regle === 'duree.quotidienne' && i.personId === 'p_karim')).toBe(true);
    expect(issues.some((i) => i.personId === 'p_helene' && i.regle.startsWith('duree'))).toBe(false);
    expect(issues.some((i) => i.personId === 'p_helene' && i.regle.startsWith('repos'))).toBe(false);
  });
  it('distingue indisponibilité reconnue (bloquant) et préférence (information)', () => {
    const mercredi = addDays(SUIVANT, 2);
    const d: AppData = { ...data, shifts: [poste('p_ines', mercredi, 510, 780), poste('p_thomas', SUIVANT, 510, 780)] };
    const issues = validateWeek(d, SUIVANT);
    expect(issues.find((i) => i.personId === 'p_ines' && i.regle === 'equipe.indisponibilite')?.gravite).toBe('bloquant');
    expect(issues.find((i) => i.personId === 'p_thomas' && i.regle === 'souhait')?.gravite).toBe('info');
  });
});

describe('génération', () => {
  it('produit une semaine sans point bloquant sur le jeu de démonstration', () => {
    const res = generer(data, SUIVANT, { variante: 'equite', graine: 3 });
    const d = { ...data, shifts: data.shifts.concat(res.shifts) };
    expect(bloquants(validateWeek(d, SUIVANT))).toEqual([]);
    expect(res.indicateurs.bloquants).toBe(0);
    expect(res.blocages).toEqual([]);
    // Les contrats sont approchés à quelques heures près.
    for (const p of data.personnes.filter((x) => !x.externe && x.salarie)) {
      expect(Math.abs(minutesSemaine(d, p.id, SUIVANT) - p.heuresHebdo * 60)).toBeLessThanOrEqual(240);
    }
  });
  it('est reproductible à graine égale et respecte les absences', () => {
    const a = generer(data, SUIVANT, { variante: 'cout', graine: 5, iterations: 8000 });
    const b = generer(data, SUIVANT, { variante: 'cout', graine: 5, iterations: 8000 });
    const cle = (s: Shift): string => `${s.personId}|${s.date}|${s.start}|${s.end}`;
    expect(a.shifts.map(cle).sort()).toEqual(b.shifts.map(cle).sort());
    const conge: AppData = {
      ...data,
      absences: data.absences.concat({ id: 'x', personId: 'p_thomas', from: SUIVANT, to: addDays(SUIVANT, 6), type: 'conge', statut: 'approuvee', createdAt: '' }),
    };
    const res = generer(conge, SUIVANT, { variante: 'equite', graine: 2, iterations: 8000 });
    expect(res.shifts.some((s) => s.personId === 'p_thomas')).toBe(false);
  });
  it('propose trois variantes et explique samedis et fermetures', () => {
    const variantes = genererVariantes(data, SUIVANT, false);
    expect(variantes.map((v) => v.variante)).toEqual(['equite', 'souhaits', 'cout']);
    const souhaits = variantes[1].indicateurs.souhaits ?? 0;
    expect(souhaits).toBeGreaterThanOrEqual(variantes[2].indicateurs.souhaits ?? 0);
    expect(variantes[2].indicateurs.auDela).toBeLessThanOrEqual(variantes[0].indicateurs.auDela);
    const samedi = variantes[0].shifts.filter((s) => weekday(s.date) === 5);
    expect(samedi.length).toBeGreaterThan(0);
    expect(samedi.every((s) => !!s.explication)).toBe(true);
  });
  it('conserve les postes déjà posés quand on le demande', () => {
    const fixe = poste('p_jules', SUIVANT, 510, 780);
    const d = { ...data, shifts: data.shifts.concat(fixe) };
    const res = generer(d, SUIVANT, { variante: 'equite', conserver: true, graine: 4, iterations: 8000 });
    expect(res.shifts.filter((s) => s.personId === 'p_jules' && s.date === SUIVANT)).toEqual([fixe]);
  });
});

describe('diagnostic', () => {
  it('démontre une impossibilité et nomme les raisons, sans proposer d’assouplir la loi', () => {
    const jeudi = addDays(SUIVANT, 3);
    const d: AppData = {
      ...data,
      absences: data.absences.concat(
        { id: 'a1', personId: 'p_helene', from: jeudi, to: jeudi, type: 'formation', statut: 'approuvee', createdAt: '' },
        { id: 'a2', personId: 'p_karim', from: jeudi, to: jeudi, type: 'conge', statut: 'approuvee', createdAt: '' },
        { id: 'a3', personId: 'p_antoine', from: jeudi, to: jeudi, type: 'conge', statut: 'approuvee', createdAt: '' },
      ),
      besoins: data.besoins.concat({
        id: 'b1', personId: 'p_lea', forme: 'commencer_apres', heure: 16 * 60, jours: [3], frequence: 1,
        statut: 'reconnue', horsPlafond: false, decision: 'acceptee', createdAt: '',
      }),
    };
    const blocages = diagnosticPrealable(d, SUIVANT);
    const b = blocages.find((x) => x.cas === 'impossible');
    expect(b?.date).toBe(jeudi);
    expect(b?.start).toBe(510);
    expect(b?.end).toBe(960);
    expect(b?.raisons.map((r) => r.personId).sort()).toEqual(['p_antoine', 'p_helene', 'p_karim', 'p_lea']);
    expect(b?.leviers.join(' ')).not.toMatch(/repos|durée maximale|11 h/i);
    const res = generer(d, SUIVANT, { variante: 'equite', graine: 1, iterations: 6000 });
    expect(res.blocages.some((x) => x.cas === 'impossible')).toBe(true);
  });
  it('signale les données manquantes', () => {
    const d: AppData = { ...data, personnes: data.personnes.map((p) => (p.id === 'p_jules' ? { ...p, heuresHebdo: 0 } : p)) };
    expect(diagnosticPrealable(d, SUIVANT).some((b) => b.cas === 'donnees_manquantes')).toBe(true);
  });
});

describe('réparation', () => {
  it('propose des options comparables qui ne créent aucun nouveau point bloquant', () => {
    expect(data.trous.length).toBeGreaterThan(0);
    for (const trou of data.trous) {
      const avant = new Set(bloquants(validateWeek(data, LUNDI)).map((i) => i.id));
      const rep = optionsReparation(data, trou.shift, TODAY);
      expect(rep.options.length).toBeGreaterThanOrEqual(1);
      expect(rep.options.filter((o) => o.recommande)).toHaveLength(1);
      const sansPharmacien = (d: AppData): number => trousPharmacien(d, trou.shift.date).reduce((t, i) => t + i.end - i.start, 0);
      for (const o of rep.options) {
        const d = appliquerPatch(data, o.patch);
        // Aucun nouveau point bloquant ; la présence pharmaceutique se juge en minutes découvertes, jamais en hausse.
        expect(bloquants(validateWeek(d, LUNDI)).filter((i) => !avant.has(i.id) && i.regle !== 'pharmacie.presence')).toEqual([]);
        expect(sansPharmacien(d)).toBeLessThanOrEqual(sansPharmacien(data));
        if (o.couverture === 'maintenue') expect(sansPharmacien(d)).toBe(0);
      }
      const remplacant = rep.options.find((o) => o.type === 'remplacant');
      if (remplacant) {
        expect(remplacant.creneauxModifies).toBe(0);
        expect(remplacant.coutSupp).toBeGreaterThan(0);
      }
      // Sans plage découverte, on ne dérange personne.
      if (!rep.impact.length) expect(rep.options.map((o) => o.type)).toEqual(['accepter']);
    }
    // Au moins une journée de l'arrêt découvre une plage sans pharmacien et propose un remplaçant.
    const avecImpact = data.trous.map((t) => optionsReparation(data, t.shift, TODAY)).filter((r) => r.impact.length);
    expect(avecImpact.length).toBeGreaterThan(0);
    expect(avecImpact.some((r) => r.options.some((o) => o.type === 'remplacant'))).toBe(true);
  });
});

describe('gardes', () => {
  it('ventile une garde par jour et tient compte du changement d’heure', () => {
    const g = data.gardes[0];
    expect(g.date).toBe('2026-10-24');
    const segs = segmentsGarde(g);
    expect(segs.map((s) => [s.date, s.minutes, s.typeJour])).toEqual([
      ['2026-10-24', 240, 'ouvrable'],
      ['2026-10-25', 540, 'dimanche_ferie'],
    ]);
    const calc = variablesGarde(data, g);
    expect(calc.dureeReelle).toBe(780);
    expect(calc.changementHeure).toBe(60);
    const code = (c: string): number | undefined => calc.variables.find((v) => v.code === c)?.quantite;
    expect(code('GARDE_VF_EQUIV')).toBe(1); // 25 % de 4 h, temps plein, jour ouvrable
    expect(code('SUJETION_DIM_FERIE')).toBe(13.5); // 9 h × 1,5 point
    expect(code('REPOS_COMPENSATEUR')).toBe(9);
    expect(code('GARDE_VF_DERANGEMENT')).toBe(1);
  });
  it('ventile par mois une garde qui traverse la fin du mois', () => {
    const g = data.gardes[2];
    expect(g.date).toBe('2026-11-30');
    const calc = variablesGarde(data, g);
    expect(new Set(calc.variables.map((v) => v.mois))).toEqual(new Set(['2026-11', '2026-12']));
    expect(calc.variables.find((v) => v.code === 'GARDE_VF_EQUIV' && v.mois === '2026-11')?.quantite).toBe(1.13);
  });
  it('paie un temps partiel à 100 % et rien au titulaire', () => {
    const g = { ...data.gardes[2], personId: 'p_lea' };
    expect(variablesGarde(data, g).variables.some((v) => v.code === 'GARDE_VF_100')).toBe(true);
    expect(variablesGarde(data, { ...g, personId: 'p_helene' }).variables).toEqual([]);
  });
  it('contrôle le délai de 15 jours et le repos après la garde', () => {
    const g = { ...data.gardes[3], personId: 'p_karim', communiqueLe: undefined };
    const karim = data.personnes.find((p) => p.id === 'p_karim');
    expect(delaiGarde(data, g, karim, addDays(g.date, -20)).ok).toBe(true);
    expect(delaiGarde(data, g, karim, addDays(g.date, -6)).ok).toBe(false);
    const nuit = data.gardes[2];
    const lendemain = addDays(nuit.date, 1);
    const d = { ...data, shifts: data.shifts.concat(poste('p_karim', lendemain, 510, 990)) };
    const repos = reposApresGarde(d, nuit);
    expect(repos?.conflits).toHaveLength(1);
    expect(repos?.reprise).toEqual({ date: lendemain, minute: 19 * 60 + 30 });
  });
  it('importe un calendrier de garde collé', () => {
    const { gardes, erreurs } = parseCalendrierGardes('date;début;fin;type\n14/02/2027;19:30;08:30;volets fermés\n2027-03-07;9h;19h;volets ouverts\nn’importe quoi');
    expect(gardes).toHaveLength(2);
    expect(gardes[0]).toMatchObject({ date: '2027-02-14', start: 1170, end: 510, type: 'volets_fermes' });
    expect(gardes[1].type).toBe('volets_ouverts');
    expect(erreurs).toHaveLength(1);
  });
});

describe('équité, paie et langage courant', () => {
  it('compare les samedis au prorata du temps de travail', () => {
    const lignes = equite(data, addDays(LUNDI, -56), addDays(LUNDI, -1));
    const total = lignes.reduce((t, l) => t + l.reel.samedis, 0);
    const attendu = lignes.reduce((t, l) => t + (l.attendu.samedis ?? 0), 0);
    expect(attendu).toBeCloseTo(total, 5);
    const ines = lignes.find((l) => l.personId === 'p_ines');
    const camille = lignes.find((l) => l.personId === 'p_camille');
    expect(ines?.attendu.samedis ?? 0).toBeLessThan(camille?.attendu.samedis ?? 0);
    expect(lignes.find((l) => l.personId === 'p_jules')?.reel.changementsTardifs).toBe(1);
  });
  it('exporte une fiche navette lisible', () => {
    const csv = ficheNavetteCSV(data, '2026-11');
    expect(csv).toContain('heures PRÉVUES');
    expect(csv).toContain('Karim Benali;Adjoint;35');
    expect(csv).not.toContain('Marchetti');
  });
  it('lit une demande en langage courant sans jamais stocker de motif', () => {
    const l = lireBesoin("Camille souhaite finir avant 17 h un mercredi sur deux jusqu'à fin juin", data.personnes, TODAY);
    expect(l.besoin).toMatchObject({ personId: 'p_camille', forme: 'finir_avant', heure: 17 * 60, jours: [2], frequence: 2, to: '2027-06-30', statut: 'preference' });
    expect(Object.keys(l.besoin ?? {})).not.toContain('motif');
    const m = lireBesoin('Inès ne peut pas travailler le samedi matin à partir du 4 janvier', data.personnes, TODAY);
    expect(m.besoin).toMatchObject({ personId: 'p_ines', forme: 'indisponible', jours: [5], plageEnd: 780, from: '2027-01-04', statut: 'prioritaire' });
    expect(lireBesoin('Il fait beau', data.personnes, TODAY).besoin).toBeNull();
  });
  it('garde un historique cohérent dans le jeu de démonstration', () => {
    expect(shiftsSemaine(data, addDays(LUNDI, -7)).length).toBeGreaterThan(30);
    expect(bloquants(validateWeek(data, addDays(LUNDI, -7)))).toEqual([]);
  });
});

describe('rendez-vous d’un absent', () => {
  it('confie le rendez-vous à une personne formée déjà en poste, sinon propose de le reprogrammer', () => {
    const jeudi = addDays(SUIVANT, 3);
    const base: AppData = {
      ...data,
      trous: [],
      shifts: [
        poste('p_helene', jeudi, 510, 1170, { pauseStart: 750, pauseEnd: 810 }),
        poste('p_lea', jeudi, 690, 1170, { pauseStart: 810, pauseEnd: 870 }),
        poste('p_camille', jeudi, 510, 1170, { pauseStart: 780, pauseEnd: 840 }),
        poste('p_thomas', jeudi, 510, 1170, { pauseStart: 720, pauseEnd: 780 }),
        poste('p_jules', jeudi, 510, 1170, { pauseStart: 840, pauseEnd: 900 }),
      ],
    };
    const retire = poste('p_karim', jeudi, 690, 1170, { pauseStart: 840, pauseEnd: 900 });
    const rep = optionsReparation(base, retire, TODAY);
    expect(rep.impact.some((m) => m.includes('Vaccination'))).toBe(true);
    const o = rep.options.find((x) => x.recommande);
    expect(o?.patch.confier).toHaveLength(1);
    expect(['p_helene', 'p_lea']).toContain(o?.patch.confier[0].personId);
    expect(o?.titre).toContain('Confier le rendez-vous');
    const apres = appliquerPatch(base, o!.patch);
    expect(validateWeek(apres, SUIVANT).some((i) => i.date === jeudi && i.regle === 'pharmacie.competence' && i.gravite === 'bloquant')).toBe(false);

    // Sans personne formée en poste sur le créneau : le rendez-vous est à reprogrammer.
    const sans: AppData = { ...base, shifts: base.shifts.filter((x) => x.personId !== 'p_helene' && x.personId !== 'p_lea').concat(poste('p_helene', jeudi, 510, 900, { pauseStart: 750, pauseEnd: 780 })) };
    const rep2 = optionsReparation(sans, { ...retire, start: 900, end: 1170, pauseStart: undefined, pauseEnd: undefined }, TODAY);
    const accepter = rep2.options.find((x) => x.type === 'accepter');
    expect(accepter).toBeUndefined(); // un pharmacien manque : on ne peut pas « ne rien changer »
    expect(rep2.options.some((x) => x.type === 'remplacant' && x.patch.confier.length === 1)).toBe(true);
  });
});

describe('démarrage à vide', () => {
  it('ouvre une application sans équipe, sans planning et sans décision en attente', () => {
    const d = vierge();
    expect(d.personnes).toEqual([]);
    expect(d.shifts).toEqual([]);
    expect(d.officine.nom).toBe('');
    expect(decisions(d, TODAY).total).toBe(0);
    expect(diagnosticPrealable(d, SUIVANT).some((b) => b.cas === 'donnees_manquantes')).toBe(true);
    // Deux applications vierges ne partagent aucun objet modifiable.
    const autre = vierge();
    autre.officine.horaires[0][0].start = 0;
    expect(d.officine.horaires[0][0].start).toBe(510);
  });
  it('génère une première semaine pour une petite équipe saisie à l’accueil', () => {
    const base = vierge();
    const p = (id: string, qualification: 'titulaire' | 'adjoint' | 'preparateur', heures: number) => ({
      id, prenom: id, nom: 'Test', qualification, salarie: qualification !== 'titulaire', heuresHebdo: heures,
      tauxHoraire: null, competences: [], volontaireHeuresComp: false, volontaireGardes: false,
    });
    const d: AppData = { ...base, officine: { ...base.officine, nom: 'Test' }, personnes: [p('t', 'titulaire', 42), p('a1', 'adjoint', 35), p('a2', 'adjoint', 35), p('p1', 'preparateur', 35), p('p2', 'preparateur', 35)] };
    const res = generer(d, SUIVANT, { variante: 'equite', graine: 3, iterations: 20000 });
    expect(res.indicateurs.bloquants).toBe(0);
    expect(res.shifts.length).toBeGreaterThan(15);
  });
});

describe('droits d’accès', () => {
  it('fait du créateur le responsable et réserve la gestion à ceux qu’il autorise', () => {
    const helene = data.personnes.find((p) => p.id === 'p_helene');
    const karim = data.personnes.find((p) => p.id === 'p_karim');
    const camille = data.personnes.find((p) => p.id === 'p_camille');
    expect(estResponsable(data, helene)).toBe(true);
    expect(espaceDe(data, helene)).toBe('responsable');
    expect(espaceDe(data, karim)).toBe('pharmacien');
    expect(espaceDe(data, camille)).toBe('equipe');
    // Un second titulaire n'a aucun droit de gestion tant que le responsable ne le lui donne pas.
    const second = { ...karim!, id: 'p_second', qualification: 'titulaire' as const, salarie: false };
    const d2: AppData = { ...data, personnes: data.personnes.concat(second) };
    expect(peutGerer(d2, second)).toBe(false);
    expect(espaceDe(d2, second)).toBe('pharmacien');
    expect(espaceDe(d2, { ...second, gestion: true })).toBe('responsable');
    expect(estResponsable(d2, { ...second, gestion: true })).toBe(false);
  });
});

describe('répartition des gardes', () => {
  it('pèse une garde selon sa durée, le dimanche et son type', () => {
    expect(poidsGarde({ date: '2026-11-17', start: 1200, end: 480, type: 'volets_fermes' })).toBe(1);
    expect(poidsGarde({ date: '2026-11-22', start: 540, end: 1140, type: 'volets_ouverts' })).toBe(1.25);
    expect(poidsGarde({ date: '2026-11-17', start: 1200, end: 480, type: 'astreinte' })).toBe(0.5);
  });
  it('compare les candidats et écarte une personne absente', () => {
    const g = data.gardes[3];
    const c = candidatsGarde(data, g, TODAY);
    expect(c.map((x) => x.person.id).sort()).toEqual(['p_antoine', 'p_helene', 'p_karim', 'p_lea']);
    expect(c.filter((x) => x.recommande)).toHaveLength(1);
    expect(c[0].charge).toBeLessThanOrEqual(c[c.length - 1].charge);
    const absent: AppData = { ...data, absences: data.absences.concat({ id: 'z', personId: c[0].person.id, from: g.date, to: g.date, type: 'conge', statut: 'approuvee', createdAt: '' }) };
    const c2 = candidatsGarde(absent, g, TODAY);
    expect(c2.find((x) => x.person.id === c[0].person.id)?.disponible).toBe(false);
    expect(c2.find((x) => x.recommande)?.person.id).not.toBe(c[0].person.id);
  });
  it('répartit les gardes libres en équilibrant la charge, et crée des séries', () => {
    const serie = serieGardes({ date: '2027-01-09', start: 1170, end: 510, type: 'volets_fermes', personId: null, interventions: [] }, 2, 6);
    expect(serie.map((x) => x.date)).toEqual(['2027-01-09', '2027-01-23', '2027-02-06', '2027-02-20', '2027-03-06', '2027-03-20']);
    const d: AppData = { ...data, gardes: serie.map((x, i) => ({ ...x, id: `s${i}` })) };
    const prop = repartirGardes(d, TODAY);
    expect(prop).toHaveLength(6);
    const parPersonne = new Map<string, number>();
    for (const x of prop) parPersonne.set(x.personId, (parPersonne.get(x.personId) ?? 0) + 1);
    expect([...parPersonne.values()].sort()).toEqual([1, 1, 2, 2]);
    expect(prop.every((x) => x.raison.length > 10)).toBe(true);
  });
});

describe('connexion et rôles', () => {
  it('propose des identifiants uniques, sans accent, et compare sans tenir compte de la casse', () => {
    expect(identifiantPropose('Hélène', 'Marchetti', [])).toBe('helene.marchetti');
    expect(identifiantPropose('Jean-Luc', "D'Arc", ['jeanluc.darc'])).toBe('jeanluc.darc2');
    expect(memeIdentifiant(' Helene.Marchetti ', 'helene.marchetti')).toBe(true);
    expect(memeIdentifiant(undefined, '')).toBe(false);
  });
  it('ne conserve qu’une empreinte du mot de passe, stable et distincte', () => {
    expect(empreinte('demo')).toBe(empreinte('demo'));
    expect(empreinte('demo')).not.toBe(empreinte('Demo'));
    expect(empreinte('demo')).not.toContain('demo');
  });
  it('distingue le titulaire principal du titulaire secondaire', () => {
    const second = data.personnes.find((p) => p.id === 'p_antoine');
    if (!second) throw new Error('titulaire secondaire absent du jeu de démonstration');
    const d = data;
    expect(libelleRole(d, d.personnes[0])).toBe('Titulaire principal');
    expect(libelleRole(d, second)).toBe('Titulaire secondaire');
    expect(espaceDe(d, second)).toBe('pharmacien');
    expect(espaceDe(d, { ...second, gestion: true })).toBe('responsable');
    expect(peutGerer(d, second)).toBe(false);
    expect(peutGerer(d, { ...second, gestion: true })).toBe(true);
  });
  it('donne un identifiant et un mot de passe à chaque membre de l’exemple', () => {
    const internes = data.personnes.filter((p) => !p.externe);
    expect(internes.every((p) => p.identifiant && p.code)).toBe(true);
    expect(new Set(internes.map((p) => p.identifiant)).size).toBe(internes.length);
  });
});

describe('demandes de remplacement', () => {
  it('compte une demande ouverte parmi les décisions du jour', () => {
    const d = decisions(data, TODAY);
    expect(d.remplacements).toHaveLength(data.remplacements.filter((r) => r.statut === 'ouverte' && r.date >= TODAY).length);
    expect(d.remplacements.length).toBeGreaterThan(0);
  });
  it('réserve le poste d’un pharmacien à un pharmacien', () => {
    const karim = data.personnes.find((p) => p.id === 'p_karim');
    const prep = data.personnes.find((p) => p.qualification === 'preparateur');
    const helene = data.personnes.find((p) => p.id === 'p_helene');
    if (!karim || !prep || !helene) throw new Error('jeu de démonstration incomplet');
    const r = { id: 'r', shiftId: 'x', demandeur: karim.id, date: SUIVANT, start: 540, end: 1020, creeLe: '', volontaires: [], statut: 'ouverte' as const };
    expect(peutRemplacer(data, r, prep)).toBe(false);
    expect(peutRemplacer(data, r, helene)).toBe(true);
    expect(peutRemplacer(data, r, karim)).toBe(false);
  });
  it('refuse un volontaire absent ou déjà en poste, sans rien modifier', () => {
    const jour = addDays(SUIVANT, 2);
    const a = poste('p_karim', jour, 540, 1020);
    const b = poste('p_helene', jour, 600, 1080);
    const d: AppData = { ...data, shifts: [a, b], absences: [], remplacements: [] };
    const r = { id: 'r', shiftId: a.id, demandeur: 'p_karim', date: jour, start: a.start, end: a.end, creeLe: '', volontaires: ['p_helene', 'p_lea'], statut: 'ouverte' as const };
    const occupe = evaluerRemplacement(d, r, 'p_helene');
    expect(occupe.ok).toBe(false);
    expect(occupe.raisons.length).toBeGreaterThan(0);
    const absent = evaluerRemplacement({ ...d, absences: [{ id: 'z', personId: 'p_lea', from: jour, to: jour, type: 'conge', statut: 'approuvee', createdAt: '' }] }, r, 'p_lea');
    expect(absent.ok).toBe(false);
    expect(absent.raisons).toContain('Absence déjà prévue ce jour-là.');
    expect(d.shifts[0].personId).toBe('p_karim');
  });
});
