import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays, mondayOf } from '../domain/time';
import type { AppData, AvisRetard, Shift } from '../domain/types';
import { arriveePrevue, avisPour, dureeRetard, effetsRetard, posteAPrevenir, superieurs } from './retard';

const LUNDI = '2026-11-16';
const poste = (personId: string, date: string, start: number, end: number, extra: Partial<Shift> = {}): Shift => ({ id: `s_${personId}_${date}_${start}`, personId, date, start, end, ...extra }) as Shift;
/** Une semaine publiée, vidée, où l'on pose ce que le test décrit. */
const base = (shifts: Shift[]): AppData => {
  const d = seed(LUNDI, -99);
  return { ...d, shifts, absences: [], semaines: { [mondayOf(LUNDI)]: { statut: 'publie' } as AppData['semaines'][string] } };
};

describe('avis de retard', () => {
  it('dit une durée comme on la dit', () => {
    expect(dureeRetard(15)).toBe('15 min');
    expect(dureeRetard(60)).toBe('1 h');
    expect(arriveePrevue({ start: 510, minutes: 15 })).toBe(525);
  });

  it('concerne le poste du jour qui n’est pas terminé, sinon le premier de demain', () => {
    const d = base([poste('p_camille', LUNDI, 510, 780), poste('p_camille', LUNDI, 840, 1140), poste('p_camille', addDays(LUNDI, 1), 540, 1020)]);
    const demain = addDays(LUNDI, 1);
    expect(posteAPrevenir(d, 'p_camille', LUNDI, demain, 480)?.start).toBe(510);
    // Le matin est terminé : c'est l'après-midi qui est concerné.
    expect(posteAPrevenir(d, 'p_camille', LUNDI, demain, 800)?.start).toBe(840);
    // La journée est finie : le poste de demain.
    expect(posteAPrevenir(d, 'p_camille', LUNDI, demain, 1200)?.date).toBe(demain);
  });

  it('ne propose rien sans planning publié, ni pendant une absence approuvée', () => {
    const d = base([poste('p_camille', LUNDI, 510, 780)]);
    expect(posteAPrevenir({ ...d, semaines: {} }, 'p_camille', LUNDI, addDays(LUNDI, 1), 0)).toBeNull();
    const absent = { ...d, absences: [{ id: 'a', personId: 'p_camille', from: LUNDI, to: LUNDI, type: 'conge', statut: 'approuvee' }] as AppData['absences'] };
    expect(posteAPrevenir(absent, 'p_camille', LUNDI, addDays(LUNDI, 1), 0)).toBeNull();
  });

  it('prévient les titulaires et ceux à qui la gestion est confiée, jamais soi-même', () => {
    const d = base([]);
    const chefs = superieurs(d, 'p_camille');
    expect(chefs).toContain('p_helene');
    expect(chefs).toContain('p_antoine');
    expect(chefs).not.toContain('p_camille');
    expect(superieurs(d, 'p_helene')).not.toContain('p_helene');
    const delegue = { ...d, personnes: d.personnes.map((p) => (p.id === 'p_karim' ? { ...p, gestion: true } : p)) };
    expect(superieurs(delegue, 'p_camille')).toContain('p_karim');
  });

  it('retrouve l’avis donné pour un poste', () => {
    const avis: AvisRetard = { id: 'r1', personId: 'p_camille', date: LUNDI, start: 510, minutes: 20, at: '' };
    const d = { ...base([poste('p_camille', LUNDI, 510, 780)]), retards: [avis] };
    expect(avisPour(d, 'p_camille', { date: LUNDI, start: 510 })?.minutes).toBe(20);
    expect(avisPour(d, 'p_camille', { date: LUNDI, start: 840 })).toBeUndefined();
  });

  it('signale un comptoir sans pharmacien, ou sans personne, le temps du retard', () => {
    const retard = (personId: string): AvisRetard => ({ id: 'r', personId, date: LUNDI, start: 510, minutes: 30, at: '' });
    // La pharmacienne est seule pharmacienne à l'ouverture : le préparateur est là, mais pas de pharmacien.
    const seule = base([poste('p_helene', LUNDI, 510, 1020), poste('p_camille', LUNDI, 510, 1020)]);
    expect(effetsRetard(seule, retard('p_helene'))[0]).toMatch(/Aucun autre pharmacien/);
    // Un autre pharmacien couvre : rien à signaler.
    const couverte = base([poste('p_helene', LUNDI, 510, 1020), poste('p_antoine', LUNDI, 480, 1020)]);
    expect(effetsRetard(couverte, retard('p_helene'))).toEqual([]);
    // Le préparateur en retard, avec un pharmacien présent : rien à signaler.
    expect(effetsRetard(seule, retard('p_camille'))).toEqual([]);
    // Personne d'autre à l'ouverture.
    const vide = base([poste('p_camille', LUNDI, 510, 1020), poste('p_helene', LUNDI, 600, 1020)]);
    expect(effetsRetard(vide, retard('p_camille'))[0]).toMatch(/Personne d’autre/);
    // Un collègue en pause pendant le retard ne tient pas le comptoir.
    const enPause = base([poste('p_camille', LUNDI, 510, 1020), poste('p_helene', LUNDI, 480, 1020, { pauseStart: 500, pauseEnd: 530 })]);
    expect(effetsRetard(enPause, retard('p_camille'))[0]).toMatch(/Personne d’autre/);
  });
});
