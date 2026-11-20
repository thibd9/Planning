import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays, mondayOf } from '../domain/time';
import type { AppData } from '../domain/types';
import { demandesDuJour, partSuivie, tirerAuSort } from './souhaits';

const TODAY = '2026-11-19';
const base = (): AppData => seed(TODAY, 2);

describe('préférences du jour et tirage au sort', () => {
  it('range les préférences d’un jour par forme, sans les remplaçants extérieurs', () => {
    const d = base();
    const jour = addDays(mondayOf(TODAY), 8);
    d.souhaits = [
      { personId: 'p_ines', date: jour, choix: 'matin' },
      { personId: 'p_jules', date: jour, choix: 'matin' },
      { personId: 'p_thomas', date: jour, choix: 'repos' },
      { personId: 'x_paul', date: jour, choix: 'matin' },
    ];
    const r = demandesDuJour(d, jour);
    expect(r.matin).toEqual(['p_ines', 'p_jules']);
    expect(r.repos).toEqual(['p_thomas']);
    expect(r.journee).toEqual([]);
  });

  it('mesure la part des préférences suivies sur les semaines publiées', () => {
    const d = base();
    const lundi = addDays(mondayOf(TODAY), -7);
    const postes = d.shifts.filter((x) => x.personId === 'p_ines' && x.date >= lundi && x.date < addDays(lundi, 7));
    expect(postes.length).toBeGreaterThan(0);
    // Un repos demandé un jour travaillé n'est pas suivi ; un repos demandé un jour libre l'est.
    const travaille = postes[0].date;
    const libre = [0, 1, 2, 3, 4, 5].map((i) => addDays(lundi, i)).find((x) => !postes.some((p) => p.date === x))!;
    d.souhaits = [
      { personId: 'p_ines', date: travaille, choix: 'repos' },
      { personId: 'p_ines', date: libre, choix: 'repos' },
    ];
    expect(partSuivie(d, 'p_ines', TODAY)).toEqual({ suivies: 1, total: 2, part: 0.5 });
    expect(partSuivie(d, 'p_jules', TODAY).part).toBe(1);
  });

  it('départage en donnant plus de chances à celui dont les préférences ont été le moins suivies', () => {
    const d = base();
    const lundi = addDays(mondayOf(TODAY), -7);
    const travaille = d.shifts.find((x) => x.personId === 'p_ines' && x.date >= lundi && x.date < addDays(lundi, 7))!.date;
    d.souhaits = [{ personId: 'p_ines', date: travaille, choix: 'repos' }];
    const t = tirerAuSort(d, ['p_ines', 'p_jules'], TODAY, 0)!;
    // Inès : aucune préférence suivie, 3 parts ; Jules : rien à rattraper, 1 part.
    expect(t.chances).toEqual([
      { personId: 'p_ines', pourcent: 75, suivies: 0, total: 1 },
      { personId: 'p_jules', pourcent: 25, suivies: 0, total: 0 },
    ]);
    expect(tirerAuSort(d, ['p_ines', 'p_jules'], TODAY, 0.74)!.gagnant).toBe('p_ines');
    expect(tirerAuSort(d, ['p_ines', 'p_jules'], TODAY, 0.76)!.gagnant).toBe('p_jules');
    expect(tirerAuSort(d, ['p_ines', 'p_jules'], TODAY, 1)!.gagnant).toBe('p_jules');
  });

  it('un seul candidat gagne toujours, aucun candidat ne donne rien', () => {
    const d = base();
    expect(tirerAuSort(d, ['p_thomas'], TODAY, 0.5)!.gagnant).toBe('p_thomas');
    expect(tirerAuSort(d, [], TODAY, 0.5)).toBeNull();
  });
});
