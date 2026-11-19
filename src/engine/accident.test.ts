import { describe, expect, it } from 'vitest';
import type { Absence } from '../domain/types';
import { declarationsAFaire, delaiDeclaration, echeanceDeclaration } from './accident';

const accident = (id: string, connuLe: string, plus: Partial<Absence> = {}): Absence => ({
  id,
  personId: 'p1',
  from: connuLe,
  to: connuLe,
  type: 'accident',
  statut: 'approuvee',
  createdAt: `${connuLe}T08:00:00.000Z`,
  accident: { jour: connuLe, ou: 'travail', connuLe },
  ...plus,
});

describe('déclaration d’un accident du travail', () => {
  it('laisse deux jours, en semaine', () => {
    // Connu un lundi : à déclarer au plus tard le mercredi.
    expect(echeanceDeclaration('2026-11-16')).toBe('2026-11-18');
  });
  it('ne compte pas le dimanche', () => {
    // Connu un vendredi : samedi compte, dimanche non, donc lundi.
    expect(echeanceDeclaration('2026-11-20')).toBe('2026-11-23');
    // Connu un samedi : lundi et mardi.
    expect(echeanceDeclaration('2026-11-21')).toBe('2026-11-24');
  });
  it('ne compte pas les jours fériés', () => {
    // Connu le mardi 10 novembre : le 11 est férié, donc jeudi 12 et vendredi 13.
    expect(echeanceDeclaration('2026-11-10')).toBe('2026-11-13');
    // Connu le 23 décembre : le 24 compte, le 25 est férié, le 26 (samedi) compte.
    expect(echeanceDeclaration('2026-12-23')).toBe('2026-12-26');
  });
  it('liste les déclarations à faire, la plus pressée d’abord', () => {
    const absences = [
      accident('a1', '2026-11-17'),
      accident('a2', '2026-11-13'),
      accident('a3', '2026-11-16', { accident: { jour: '2026-11-16', ou: 'trajet', connuLe: '2026-11-16', declareLe: '2026-11-17' } }),
      accident('a4', '2026-11-17', { statut: 'refusee' }),
      { ...accident('a5', '2026-11-17'), type: 'maladie' as const },
    ];
    const liste = declarationsAFaire({ absences }, '2026-11-18');
    expect(liste.map((x) => x.absence.id)).toEqual(['a2', 'a1']);
    expect(liste[0].jours).toBeLessThan(0);
    expect(liste[1]).toMatchObject({ echeance: '2026-11-19', jours: 1 });
  });
  it('dit le délai simplement', () => {
    expect(delaiDeclaration(0)).toBe('à faire aujourd’hui');
    expect(delaiDeclaration(1)).toBe('à faire avant demain soir');
    expect(delaiDeclaration(2)).toBe('encore 2 jours');
    expect(delaiDeclaration(-1)).toBe('délai dépassé depuis 1 jour');
    expect(delaiDeclaration(-3)).toBe('délai dépassé depuis 3 jours');
  });
});
