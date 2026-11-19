import { describe, expect, it } from 'vitest';
import { decrirePauses, pausesProposees, pausesValides, phrasePauses } from './pauses';

const H = (h: number, m = 0): number => h * 60 + m;

describe('pause déjeuner et pauses courtes', () => {
  it('propose une pause courte au milieu de chaque demi-journée assez longue', () => {
    // 8 h 30 – 16 h 30, déjeuner de 12 h 30 à 13 h 30 : une pause le matin, une l'après-midi.
    expect(pausesProposees({ start: H(8, 30), end: H(16, 30), pauseStart: H(12, 30), pauseEnd: H(13, 30) })).toEqual([
      { start: H(10, 30), end: H(10, 45) },
      { start: H(15), end: H(15, 15) },
    ]);
    // Une matinée seule.
    expect(pausesProposees({ start: H(8, 30), end: H(13) })).toHaveLength(1);
    // Deux heures de travail : pas de pause proposée.
    expect(pausesProposees({ start: H(9), end: H(11) })).toEqual([]);
    expect(pausesProposees({ start: H(9), end: H(13) }, 20)[0]).toEqual({ start: H(10, 45), end: H(11, 5) });
  });

  it('écarte une pause hors du poste, pendant le déjeuner, ou qui en chevauche une autre', () => {
    const poste = { start: H(8, 30), end: H(16, 30), pauseStart: H(12, 30), pauseEnd: H(13, 30) };
    expect(
      pausesValides(poste, [
        { start: H(15), end: H(15, 15) },
        { start: H(10, 30), end: H(10, 45) },
        { start: H(10, 40), end: H(10, 55) },
        { start: H(12, 45), end: H(13) },
        { start: H(17), end: H(17, 15) },
        { start: H(9), end: H(10) },
      ]),
    ).toEqual([
      { start: H(10, 30), end: H(10, 45) },
      { start: H(15), end: H(15, 15) },
    ]);
    expect(pausesValides(poste, undefined)).toEqual([]);
  });

  it('les dit en mots, sans les confondre', () => {
    const poste = { start: H(8, 30), end: H(16, 30), pauseStart: H(12, 30), pauseEnd: H(13, 30), pauses: [{ start: H(10, 30), end: H(10, 45) }, { start: H(15), end: H(15, 15) }] };
    expect(decrirePauses(poste)).toEqual({ dejeuner: '12 h 30 – 13 h 30', courtes: '10 h 30, 15 h (15 min)' });
    expect(phrasePauses(poste)).toBe('pause déjeuner 12 h 30 – 13 h 30 · pauses courtes à 10 h 30, 15 h (15 min)');
    expect(phrasePauses({ start: H(9), end: H(13), pauses: [{ start: H(11), end: H(11, 10) }] })).toBe('pause courte à 11 h (10 min)');
    expect(phrasePauses({ start: H(9), end: H(13) })).toBe('');
  });
});
