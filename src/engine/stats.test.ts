import { beforeAll, describe, expect, it } from 'vitest';
import { seed, vierge } from '../data/seed';
import { addDays, anciennete, dayIndex, mondayOf } from '../domain/time';
import type { AppData, CompetenceId, Garde, Person } from '../domain/types';
import { COMPETENCE_LABEL, contratDe } from '../domain/types';
import { minutesSemaine } from './core';
import { equite } from './equity';
import { POINTS_FORTS, statsEquipe } from './stats';
import { pointsForts } from './suivi';

const TODAY = '2026-11-18';
const LUNDI = mondayOf(TODAY);
let data: AppData;

beforeAll(() => {
  data = seed(TODAY, 2);
});

const internes = (d: AppData): Person[] => d.personnes.filter((p) => !p.externe);
/** L'équipe d'exemple, avec une modification par personne. */
const avec = (d: AppData, fn: (p: Person) => Person): AppData => ({ ...d, personnes: d.personnes.map(fn) });

describe('statistiques d’équipe', () => {
  it('compose l’équipe interne : effectif par fonction, équivalents temps plein plafonnés, temps partiels et contrats', () => {
    const { composition: c } = statsEquipe(data, TODAY);
    const equipe = internes(data);
    expect(c.effectif).toBe(equipe.length);
    expect(c.externes).toBe(data.personnes.length - equipe.length);
    // Chaque personne est comptée une fois, dans sa fonction et dans son contrat ; aucun remplaçant extérieur.
    expect(c.parFonction.reduce((t, f) => t + f.effectif, 0)).toBe(equipe.length);
    expect(c.parContrat.reduce((t, x) => t + x.effectif, 0)).toBe(equipe.length);
    expect(c.parFonction.flatMap((f) => f.personnes).some((id) => id.startsWith('x_'))).toBe(false);
    for (const f of c.parFonction) expect(f.effectif).toBe(equipe.filter((p) => p.qualification === f.qualification).length);
    for (const x of c.parContrat) expect(x.personnes.every((id) => contratDe(equipe.find((p) => p.id === id)!) === x.contrat)).toBe(true);
    expect(c.parContrat.find((x) => x.contrat === 'non_salarie')?.label).toBe('Titulaire (non salarié)');
    // Un contrat de plus de 35 heures compte pour un seul temps plein.
    const etp = equipe.reduce((t, p) => t + Math.min(1, p.heuresHebdo / 35), 0);
    expect(c.etp).toBeCloseTo(etp, 2);
    expect(c.etp).toBeLessThanOrEqual(c.effectif);
    const titulaires = c.parFonction.find((f) => f.qualification === 'titulaire')!;
    expect(titulaires.label).toBe(titulaires.effectif > 1 ? 'Titulaires' : 'Titulaire');
    expect(titulaires.etp).toBeLessThanOrEqual(titulaires.effectif);
    // Le temps partiel ne concerne que les salariés : un titulaire à temps réduit n'en fait pas partie.
    expect(c.salaries).toBe(equipe.filter((p) => p.salarie).length);
    expect(c.tempsPartiels).toBe(equipe.filter((p) => p.salarie && p.heuresHebdo < 35).length);
  });

  it('ne calcule l’ancienneté moyenne que sur les jours d’entrée renseignés', () => {
    // Deux personnes seulement ont un jour d'entrée : 800 jours et 400 jours, soit 600 jours en moyenne.
    const d = avec(data, (p) => ({ ...p, entreeLe: p.id === 'p_karim' ? addDays(TODAY, -800) : p.id === 'p_lea' ? addDays(TODAY, -400) : undefined }));
    const a = statsEquipe(d, TODAY).composition.anciennete;
    expect(a.renseignees).toBe(2);
    expect(a.manquantes).toBe(internes(d).length - 2);
    expect(a.moyenneJours).toBe(600);
    expect(a.moyenneDepuis).toBe(addDays(TODAY, -600));
    expect(a.moyenne).toBe(anciennete(addDays(TODAY, -600), TODAY));
    expect(a.parPersonne.map((x) => x.personId).sort()).toEqual(['p_karim', 'p_lea']);
    // Sans aucun jour d'entrée, rien n'est inventé ; une arrivée à venir ne compte pas encore.
    const sans = statsEquipe(avec(data, (p) => ({ ...p, entreeLe: p.id === 'p_karim' ? addDays(TODAY, 30) : undefined })), TODAY).composition.anciennete;
    expect(sans.renseignees).toBe(0);
    expect(sans.moyenne).toBeNull();
    expect(sans.moyenneJours).toBeNull();
  });

  it('couvre les compétences : signale celles que personne ne détient et celles d’une seule personne', () => {
    // Une seule personne en orthopédie, personne en homéopathie, deux en vaccination ; un remplaçant ne couvre rien.
    const choisies: Record<string, CompetenceId[]> = { p_camille: ['orthopedie', 'vaccination'], p_lea: ['vaccination'], x_paul: ['homeo', 'orthopedie'] };
    const d = avec(data, (p) => ({ ...p, competences: choisies[p.id] ?? [] }));
    const k = statsEquipe(d, TODAY).competences;
    const toutes = k.familles.flatMap((f) => f.competences);
    expect(toutes.map((x) => x.cle).sort()).toEqual(Object.keys(COMPETENCE_LABEL).sort());
    expect(k.total).toBe(Object.keys(COMPETENCE_LABEL).length);
    expect(k.couvertes).toBe(2);
    expect(k.fragiles.map((x) => x.cle)).toEqual(['orthopedie']);
    expect(k.fragiles[0].detenteurs).toEqual(['p_camille']);
    expect(k.fragiles[0].renforts).toEqual(['x_paul']);
    expect(k.absentes).toHaveLength(k.total - 2);
    const homeo = toutes.find((x) => x.cle === 'homeo')!;
    expect(homeo).toMatchObject({ nombre: 0, etat: 'absente', label: COMPETENCE_LABEL.homeo, renforts: ['x_paul'] });
    const vaccination = toutes.find((x) => x.cle === 'vaccination')!;
    expect(vaccination).toMatchObject({ nombre: 2, etat: 'couverte' });
    expect(vaccination.detenteurs.sort()).toEqual(['p_camille', 'p_lea']);
    expect(k.familles.reduce((t, f) => t + f.couvertes, 0)).toBe(k.couvertes);
  });

  it('reprend les points forts de chacun, hors titulaires, par ordre alphabétique, avec un total par nature', () => {
    const f = statsEquipe(data, TODAY).pointsForts;
    const suivis = internes(data).filter((p) => p.qualification !== 'titulaire');
    expect(f.parPersonne.map((x) => x.personId).sort()).toEqual(suivis.map((p) => p.id).sort());
    // Ni note ni classement : l'ordre est celui des prénoms.
    const prenoms = f.parPersonne.map((x) => data.personnes.find((p) => p.id === x.personId)!.prenom);
    expect(prenoms).toEqual([...prenoms].sort((a, b) => a.localeCompare(b, 'fr')));
    for (const x of f.parPersonne) expect(x.points).toEqual(pointsForts(data, x.personId, TODAY));
    // Les quatre natures sont toujours présentes, même quand personne n'est concerné.
    expect(f.totaux.map((t) => t.cle)).toEqual(POINTS_FORTS.map((t) => t.cle));
    for (const t of f.totaux) {
      const attendus = f.parPersonne.filter((x) => x.points.some((pt) => pt.cle === t.cle)).map((x) => x.personId);
      expect(t.personnes).toEqual(attendus);
      expect(t.nombre).toBe(attendus.length);
      expect(t.titre).toBeTruthy();
    }
    expect(f.total).toBe(f.totaux.reduce((t, x) => t + x.nombre, 0));
    expect(f.avecPoint).toBe(f.parPersonne.filter((x) => x.points.length).length);
    expect(f.total).toBeGreaterThan(0);
  });

  it('ne laisse jamais un arrêt ou un congé changer les points forts', () => {
    const avant = statsEquipe(data, TODAY).pointsForts;
    const absences: AppData['absences'] = [
      { id: 'a_test_1', personId: 'p_camille', from: addDays(TODAY, -40), to: addDays(TODAY, -20), type: 'maladie', statut: 'approuvee', createdAt: `${addDays(TODAY, -41)}T08:00:00.000Z` },
      { id: 'a_test_2', personId: 'p_lea', from: addDays(TODAY, -30), to: addDays(TODAY, -25), type: 'conge', statut: 'approuvee', createdAt: `${addDays(TODAY, -60)}T08:00:00.000Z` },
    ];
    const apres = statsEquipe({ ...data, absences: data.absences.concat(absences) }, TODAY).pointsForts;
    expect(apres.totaux).toEqual(avant.totaux);
    expect(apres.parPersonne).toEqual(avant.parPersonne);
  });

  it('compare les heures planifiées aux contrats sur les quatre dernières semaines publiées', () => {
    const h = statsEquipe(data, TODAY).activite.heures;
    // L'exemple publie deux semaines d'avance : elles ne sont pas encore « dernières ».
    expect(data.semaines[addDays(LUNDI, 7)]?.statut).toBe('publie');
    expect(h.semaines).toEqual([addDays(LUNDI, -21), addDays(LUNDI, -14), addDays(LUNDI, -7), LUNDI]);
    // Les salariés seulement : un titulaire non salarié est hors décompte.
    const salaries = internes(data).filter((p) => p.salarie);
    expect(h.parPersonne.map((x) => x.personId).sort()).toEqual(salaries.map((p) => p.id).sort());
    for (const x of h.parPersonne) {
      expect(x.planifie).toBe(h.semaines.reduce((t, m) => t + minutesSemaine(data, x.personId, m), 0));
      expect(x.ecart).toBe(x.planifie - x.contrat);
    }
    // Sans absence, le contrat vaut quatre semaines pleines ; une semaine d'absence approuvée en est déduite.
    const sansAbsence = statsEquipe({ ...data, absences: [] }, TODAY).activite.heures;
    for (const x of sansAbsence.parPersonne) expect(x.contrat).toBe(4 * salaries.find((p) => p.id === x.personId)!.heuresHebdo * 60);
    const conge: AppData['absences'][number] = { id: 'a_test', personId: 'p_thomas', from: addDays(LUNDI, -7), to: addDays(LUNDI, -3), type: 'conge', statut: 'approuvee', createdAt: `${addDays(LUNDI, -40)}T08:00:00.000Z` };
    const avecConge = statsEquipe({ ...data, absences: [conge] }, TODAY).activite.heures;
    expect(avecConge.parPersonne.find((x) => x.personId === 'p_thomas')!.contrat).toBe(3 * 35 * 60);
    expect(h.planifie).toBe(h.parPersonne.reduce((t, x) => t + x.planifie, 0));
    expect(h.contrat).toBe(h.parPersonne.reduce((t, x) => t + x.contrat, 0));
    expect(h.ecart).toBe(h.planifie - h.contrat);
    expect(h.planifie).toBeGreaterThan(0);
  });

  it('compte samedis, fermetures, gardes et dépannages sur douze mois, comme la mémoire d’équité', () => {
    const garde = (id: string, date: string, personId: string | null): Garde => ({ id, date, start: 20 * 60, end: 8 * 60, type: 'volets_fermes', personId, interventions: [] });
    const base: AppData = { ...data, gardes: [garde('g1', addDays(TODAY, -10), 'p_lea'), garde('g2', addDays(TODAY, -200), 'p_lea'), garde('g3', addDays(TODAY, -30), 'p_karim'), garde('g4', addDays(TODAY, -400), 'p_karim'), garde('g5', addDays(TODAY, 12), 'p_karim'), garde('g6', addDays(TODAY, 40), null)] };
    const a = statsEquipe(base, TODAY).activite;
    expect(a.periode).toMatchObject({ from: addDays(TODAY, -365), to: TODAY });
    expect(dayIndex(a.periode.premierPoste!)).toBeGreaterThanOrEqual(dayIndex(a.periode.from));
    const de = (id: string) => a.compteurs.find((x) => x.personId === id)!;
    // Une garde de plus d'un an ou à venir ne compte pas ; une garde à venir sans personne est signalée à part.
    expect(de('p_lea').gardes).toBe(2);
    expect(de('p_karim').gardes).toBe(1);
    expect(a.totaux.gardes).toBe(3);
    expect(a.gardesAVenir).toEqual({ total: 2, sansPersonne: 1 });
    // Les décomptes sont ceux de la mémoire d'équité, relue sur douze mois.
    const lignes = equite(base, addDays(TODAY, -365), TODAY);
    expect(a.compteurs.map((x) => x.personId).sort()).toEqual(lignes.map((l) => l.personId).sort());
    for (const l of lignes) expect(de(l.personId)).toMatchObject({ samedis: l.reel.samedis, fermetures: l.reel.fermetures, gardes: l.reel.gardes, depannages: l.reel.depannages });
    expect(a.totaux.samedis).toBe(lignes.reduce((t, l) => t + l.reel.samedis, 0));
    expect(a.totaux.samedis).toBeGreaterThan(0);
    // Un poste repris au pied levé devient un dépannage.
    const poste = base.shifts.find((s) => s.personId === 'p_ines' && s.date < TODAY)!;
    const repris = statsEquipe({ ...base, shifts: base.shifts.map((s) => (s.id === poste.id ? { ...s, origine: 'reparation' as const } : s)) }, TODAY).activite;
    expect(repris.compteurs.find((x) => x.personId === 'p_ines')!.depannages).toBe(de('p_ines').depannages + 1);
    expect(repris.totaux.depannages).toBe(a.totaux.depannages + 1);
    // Les demandes de remplacement de l'exemple sont comptées, pourvues ou non.
    expect(a.remplacements.demandes).toBe(base.remplacements.filter((r) => r.statut !== 'annulee').length);
    expect(a.remplacements.pourvues + a.remplacements.enCours).toBeLessThanOrEqual(a.remplacements.demandes);
  });

  it('reste à zéro sur une officine vierge, sans rien inventer', () => {
    const s = statsEquipe(vierge(), TODAY);
    expect(s.composition).toMatchObject({ effectif: 0, etp: 0, tempsPartiels: 0, parFonction: [], parContrat: [] });
    expect(s.composition.anciennete.moyenne).toBeNull();
    expect(s.competences.couvertes).toBe(0);
    expect(s.competences.absentes).toHaveLength(s.competences.total);
    expect(s.pointsForts).toMatchObject({ parPersonne: [], total: 0, avecPoint: 0 });
    expect(s.pointsForts.totaux.every((t) => t.nombre === 0)).toBe(true);
    expect(s.activite.heures).toMatchObject({ semaines: [], planifie: 0, contrat: 0, parPersonne: [] });
    expect(s.activite.periode.premierPoste).toBeNull();
    expect(s.activite.totaux).toEqual({ samedis: 0, fermetures: 0, gardes: 0, depannages: 0 });
  });
});
