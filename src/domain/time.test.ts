import { describe, expect, it } from 'vitest';
import { anciennete, momentDuJour } from './time';

describe('momentDuJour', () => {
  it('découpe la journée en cinq moments', () => {
    expect([5, 8, 10].map(momentDuJour)).toEqual(['matin', 'matin', 'matin']);
    expect([11, 13].map(momentDuJour)).toEqual(['midi', 'midi']);
    expect([14, 17].map(momentDuJour)).toEqual(['apres-midi', 'apres-midi']);
    expect([18, 20].map(momentDuJour)).toEqual(['soir', 'soir']);
    expect([21, 23, 0, 4].map(momentDuJour)).toEqual(['nuit', 'nuit', 'nuit', 'nuit']);
  });
});

describe('anciennete', () => {
  it('dit le temps passé en années et en mois', () => {
    expect(anciennete('2023-07-15', '2026-11-19')).toBe('3 ans et 4 mois');
    expect(anciennete('2025-11-19', '2026-11-19')).toBe('1 an');
    expect(anciennete('2026-04-20', '2026-11-19')).toBe('6 mois');
    expect(anciennete('2026-11-02', '2026-11-19')).toBe('moins d’un mois');
    expect(anciennete('2026-12-01', '2026-11-19')).toBe('pas encore arrivé');
  });
});
