import { describe, expect, it } from 'vitest';
import { momentDuJour } from './time';

describe('momentDuJour', () => {
  it('découpe la journée en cinq moments', () => {
    expect([5, 8, 10].map(momentDuJour)).toEqual(['matin', 'matin', 'matin']);
    expect([11, 13].map(momentDuJour)).toEqual(['midi', 'midi']);
    expect([14, 17].map(momentDuJour)).toEqual(['apres-midi', 'apres-midi']);
    expect([18, 20].map(momentDuJour)).toEqual(['soir', 'soir']);
    expect([21, 23, 0, 4].map(momentDuJour)).toEqual(['nuit', 'nuit', 'nuit', 'nuit']);
  });
});
