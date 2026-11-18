import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { mondayOf } from '../domain/time';
import type { AppData, Shift } from '../domain/types';
import { pharmacienSeulEnRendezVous, trousPharmacienExpliques } from './core';
import { validateWeek } from './validate';

const LUNDI = '2026-11-23';
const poste = (personId: string, start: number, end: number, extra: Partial<Shift> = {}): Shift => ({ id: `s_${personId}_${start}`, personId, date: LUNDI, start, end, activite: 'comptoir', ...extra }) as Shift;
const semaine = (shifts: Shift[]): AppData => ({ ...seed('2026-11-18', -99), shifts, absences: [], missions: [], semaines: { [mondayOf(LUNDI)]: { statut: 'brouillon' } as AppData['semaines'][string] } });

describe('un titulaire en poste est un pharmacien présent', () => {
  // La titulaire travaille de 8 h 30 à 16 h 30, pause de 12 h 30 à 13 h 30 ; la pharmacie ferme à 19 h 30.
  const d = semaine([poste('p_helene', 510, 990, { pauseStart: 750, pauseEnd: 810 })]);

  it('il ne manque personne pendant son poste, pause comprise : seule la fin de journée reste à couvrir', () => {
    const { aucun, trous } = trousPharmacienExpliques(d, LUNDI);
    expect(aucun).toBe(false);
    expect(trous).toHaveLength(1);
    expect(trous[0].start).toBe(990);
    expect(trous[0].raison).toBe('après le départ de Caroline');
  });

  it('sa pause ne déclenche pas l’alerte « seul pharmacien pris par un rendez-vous »', () => {
    expect(pharmacienSeulEnRendezVous(d, LUNDI)).toEqual([]);
    expect(validateWeek(d, LUNDI).some((i) => i.regle === 'pharmacie.rdv' && i.date === LUNDI)).toBe(false);
  });

  it('le message dit ce qui se passe et quoi faire, sans parler de pharmacien absent', () => {
    const m = validateWeek(d, LUNDI).find((i) => i.regle === 'pharmacie.presence' && i.date === LUNDI)?.message ?? '';
    expect(m).toContain('de 16 h 30 à 19 h 30, aucun pharmacien n\'est présent');
    expect(m).toContain('la pharmacie reste ouverte après le départ de Caroline');
    expect(m).toContain('Prolongez son poste ou posez un autre pharmacien');
  });

  it('un rendez-vous pris par le seul pharmacien reste signalé', () => {
    const occupe = { ...d, missions: [{ id: 'm', personId: 'p_helene', date: LUNDI, start: 600, end: 630, type: 'vaccination' }] as AppData['missions'] };
    expect(pharmacienSeulEnRendezVous(occupe, LUNDI)).toEqual([{ start: 600, end: 630 }]);
  });
});
